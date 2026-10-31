import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { computeAccess } from '../billing/access';
import { StripeClient } from '../billing/stripe-client';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { attachments, users } from '../db/schema';
import { StorageService } from '../storage/storage.service';

const FOREIGN_KEY_VIOLATION = '23503';
const MAX_PASSES = 12;

type Db = PostgresJsDatabase<typeof schema>;

interface OwnedTable {
  name: string;
  /** Boolean SQL expression, valid inside `DELETE FROM <name> WHERE ...` / `SELECT ... FROM <name> WHERE ...`. */
  where: SQL;
}

interface ForeignKeyRow extends Record<string, unknown> {
  child: string;
  child_column: string;
  parent: string;
  parent_column: string;
}

function errorCode(error: unknown): string | undefined {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code ?? candidate?.cause?.code;
}

/**
 * Permanently erases a user and everything that belongs to them.
 *
 * Tables are discovered from the catalog instead of listed by hand, so a table added by a later migration is
 * covered automatically: every table with a `user_id` column, plus tables that only point at those rows through a
 * foreign key. Deletion runs inside one transaction with a savepoint per statement; a statement that trips a
 * foreign key is retried on the next pass, once the rows that reference it are gone.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly stripe: StripeClient,
    private readonly storage: StorageService,
  ) {}

  async deleteUser(userId: string): Promise<void> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId));
    const user = rows[0];
    if (!user) throw new NotFoundException('User not found');
    if (computeAccess(user, new Date()).state === 'owner') {
      throw new ForbiddenException('Owner and admin accounts cannot be deleted.');
    }

    // Stop billing first: if Stripe fails we keep the data, so the user can retry instead of paying for nothing.
    await this.cancelStripeSubscription(user.stripeSubscriptionId);

    const objectKeys = (
      await this.db.select({ key: attachments.objectKey }).from(attachments).where(eq(attachments.userId, userId))
    ).map((row) => row.key);

    await this.db.transaction(async (tx) => {
      // Notas fiscais must be kept for tax purposes: unlink them from the account so the generic erase below skips them.
      await tx.execute(sql`UPDATE fiscal_invoices SET user_id = NULL WHERE user_id = ${userId}`);
      const tables = await this.discoverOwnedTables(tx, userId);
      await this.deleteWithRetries(tx, tables);

      // Rows that are keyed by e-mail instead of user id.
      await tx.execute(
        sql`DELETE FROM purchases WHERE lower(email) = lower(${user.email}) AND client_id = ${user.clientId}`,
      );
      await tx.execute(sql`DELETE FROM leads WHERE lower(email) = lower(${user.email})`);
      await tx.execute(sql`DELETE FROM support_messages WHERE lower(email) = lower(${user.email})`);

      await tx.delete(users).where(eq(users.id, userId));
    });

    // Files live outside Postgres; a failure here must not undo an erasure that already committed.
    await Promise.all(
      objectKeys.map((key) =>
        this.storage.deleteObject(key).catch((error) => {
          this.logger.error(`Failed to delete stored object ${key}: ${String(error)}`);
        }),
      ),
    );
    this.logger.log(`Deleted account ${userId} (${objectKeys.length} stored files).`);
  }

  private async cancelStripeSubscription(subscriptionId: string | null): Promise<void> {
    if (!subscriptionId || !process.env.STRIPE_SECRET_KEY) return;
    try {
      await this.stripe.get().subscriptions.cancel(subscriptionId);
    } catch (error) {
      const code = (error as { code?: string }).code;
      const message = String((error as { message?: string }).message ?? '');
      // Already gone or already cancelled: nothing left to stop.
      if (code === 'resource_missing' || /already been canceled|already canceled/i.test(message)) return;
      this.logger.error(`Failed to cancel Stripe subscription ${subscriptionId}: ${message}`);
      throw new BadGatewayException('Could not cancel the subscription. Nothing was deleted; please try again.');
    }
  }

  /** Every table whose rows belong to the user, with the condition that selects them. */
  private async discoverOwnedTables(tx: Db, userId: string): Promise<OwnedTable[]> {
    const direct = await tx.execute<{ table_name: string }>(sql`
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND c.table_name <> 'users'
      ORDER BY c.table_name
    `);

    const owned = new Map<string, OwnedTable>();
    for (const row of direct) {
      owned.set(row.table_name, { name: row.table_name, where: sql`user_id = ${userId}` });
    }

    // Tables without a user_id that reference owned rows through a foreign key (repeat for nested chains).
    const foreignKeys = await tx.execute<ForeignKeyRow>(sql`
      SELECT cl.relname AS child, ca.attname AS child_column, pl.relname AS parent, pa.attname AS parent_column
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_class pl ON pl.oid = con.confrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
      JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = con.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1
    `);

    let grew = true;
    while (grew) {
      grew = false;
      for (const fk of foreignKeys) {
        const parent = owned.get(fk.parent);
        if (!parent || owned.has(fk.child) || fk.child === 'users') continue;
        owned.set(fk.child, {
          name: fk.child,
          where: sql`${sql.identifier(fk.child_column)} IN (SELECT ${sql.identifier(fk.parent_column)} FROM ${sql.identifier(fk.parent)} WHERE ${parent.where})`,
        });
        grew = true;
      }
    }
    return [...owned.values()];
  }

  private async deleteWithRetries(tx: Db, tables: OwnedTable[]): Promise<void> {
    let pending = tables;
    for (let pass = 1; pass <= MAX_PASSES && pending.length > 0; pass++) {
      const blocked: OwnedTable[] = [];
      let lastError: unknown = null;

      for (const table of pending) {
        try {
          // A savepoint per statement keeps one foreign key failure from aborting the whole transaction.
          await tx.transaction(async (savepoint) => {
            await savepoint.execute(sql`DELETE FROM ${sql.identifier(table.name)} WHERE ${table.where}`);
          });
        } catch (error) {
          if (errorCode(error) !== FOREIGN_KEY_VIOLATION) throw error;
          blocked.push(table);
          lastError = error;
        }
      }

      if (blocked.length === pending.length) {
        // No progress in a full pass: something outside the discovered set still references these rows.
        this.logger.error(`Account deletion is stuck on: ${blocked.map((t) => t.name).join(', ')}`);
        throw lastError;
      }
      pending = blocked;
    }
    if (pending.length > 0) {
      throw new Error(`Account deletion did not converge; still pending: ${pending.map((t) => t.name).join(', ')}`);
    }
  }
}
