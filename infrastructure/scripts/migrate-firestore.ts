import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps, deleteApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

dotenv.config({ path: path.resolve(__dirname, '../migration/.env') });

import {
  transformUser,
  transformAccount,
  transformCategory,
  transformTransaction,
  transformBill,
  transformBillReminder,
  transformReminderLog,
  transformBudget,
  transformGoal,
  transformInvestment,
  transformPlanner,
  transformSettings,
  transformCategorizationRule,
  transformImport,
  transformLead,
  transformPurchase,
  transformCoupon,
  transformImportIssue,
} from '../../apps/api/src/db/migration/transforms';

import {
  users,
  accounts,
  categories,
  transactions,
  bills,
  billReminders,
  budgets,
  goals,
  investments,
  planner,
  settings,
  categorizationRules,
  imports,
  leads,
  purchases,
  coupons,
  importIssues,
} from '../../apps/api/src/db/schema';

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const clientFlag = args.indexOf('--client');
const onlyClient = clientFlag !== -1 ? args[clientFlag + 1] : null;

// ─── DB connection ──────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var is required');
  process.exit(1);
}

const ssl = process.env.DATABASE_SSL === 'true' ? true : false;
const sql = postgres(DATABASE_URL, { ssl });
const db = drizzle(sql);

// ─── Summary tracking ───────────────────────────────────────────────────────

type CollectionStats = { attempted: number; inserted: number; updated: number; errors: number };
const summary: Record<string, CollectionStats> = {};

function initStats(name: string) {
  summary[name] = { attempted: 0, inserted: 0, updated: 0, errors: 0 };
}

async function upsertRow<T extends Record<string, unknown>>(
  collectionName: string,
  table: any,
  row: T,
  conflictTarget: string[],
): Promise<string | null> {
  summary[collectionName].attempted++;
  try {
    const result = await db
      .insert(table)
      .values(row as any)
      .onConflictDoUpdate({
        target: conflictTarget.map((c) => (table as any)[c]),
        set: row as any,
      })
      .returning({ id: table.id });
    if (result.length === 0) {
      summary[collectionName].updated++;
    } else {
      summary[collectionName].inserted++;
    }
    return result[0]?.id ?? null;
  } catch (err) {
    summary[collectionName].errors++;
    console.warn(`  WARN [${collectionName}] doc error:`, (err as Error).message);
    return null;
  }
}

// ─── Tenant migration ────────────────────────────────────────────────────────

async function migrateTenant(clientId: string, db_: ReturnType<typeof getFirestore>, app: App) {
  console.log(`\n→ Migrating tenant: ${clientId}`);

  // 1. Users — seeded from Firebase Auth (no Firestore users collection in this app)
  initStats('users');
  const auth_ = getAuth(app);
  const userIdMap: Record<string, string> = {};  // firebaseUid → pgUUID
  const emailToUserIdMap: Record<string, string> = {};  // email → pgUUID

  let nextPageToken: string | undefined;
  do {
    const listResult = await auth_.listUsers(1000, nextPageToken);
    for (const authUser of listResult.users) {
      if (!authUser.email) { summary['users'].attempted++; summary['users'].errors++; continue; }
      const row = transformUser(authUser.uid, { email: authUser.email, name: authUser.displayName ?? null }, clientId);
      // Sanitize: replace any undefined values with null to avoid postgres-js UNDEFINED_VALUE errors
      const safeRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === undefined ? null : v])) as typeof row;
      try {
        const inserted = await db
          .insert(users)
          .values(safeRow as any)
          .onConflictDoUpdate({
            target: [users.clientId, users.email],
            set: { firebaseUid: safeRow.firebaseUid, name: safeRow.name },
          })
          .returning({ id: users.id, firebaseUid: users.firebaseUid });
        userIdMap[authUser.uid] = inserted[0].id;
        emailToUserIdMap[authUser.email] = inserted[0].id;
        summary['users'].attempted++;
        summary['users'].inserted++;
      } catch (err) {
        summary['users'].attempted++;
        summary['users'].errors++;
        console.warn(`  WARN [users] ${authUser.uid}:`, (err as Error).message);
      }
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  // Alias custom-auth UIDs (no email, no provider) to the primary email user.
  // The UID named after the clientId is a legacy dev account; its data belongs to the
  // email user whose address starts with the clientId (e.g. jonathalimax@gmail.com).
  if (!userIdMap[clientId]) {
    const primaryPgId =
      emailToUserIdMap[`${clientId}@gmail.com`] ??
      Object.values(emailToUserIdMap).find((_, i) => i === 0);
    if (primaryPgId) {
      userIdMap[clientId] = primaryPgId;
      console.log(`  INFO aliased custom UID '${clientId}' → PG user ${primaryPgId}`);
    }
  }

  // Helper: resolve user UUID from firebase uid or userId field
  function resolveUserId(data: Record<string, any>): string {
    return userIdMap[data.userId as string] ?? userIdMap[data.uid as string] ?? '';
  }

  // 2. Accounts (userBanks)
  initStats('accounts');
  const accountIdMap: Record<string, string> = {};
  const accountDocs = await db_.collection('userBanks').get();
  for (const doc of accountDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['accounts'].errors++; continue; }
    const id = await upsertRow('accounts', accounts, transformAccount(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
    if (id) accountIdMap[doc.id] = id;
  }

  // 3. Categories
  initStats('categories');
  const categoryIdMap: Record<string, string> = {};
  const catDocs = await db_.collection('categories').get();
  for (const doc of catDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['categories'].errors++; continue; }
    const id = await upsertRow('categories', categories, transformCategory(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
    if (id) categoryIdMap[doc.id] = id;
  }

  // 4. Transactions — resolve FK references to PG UUIDs
  initStats('transactions');
  const txDocs = await db_.collection('transactions').get();
  for (const doc of txDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['transactions'].errors++; continue; }
    const data = doc.data();
    const row = transformTransaction(doc.id, data, clientId, userId);
    // Resolve Firestore doc IDs → PG UUIDs; fall back to null if not found
    const resolvedRow = {
      ...row,
      categoryId: (row.categoryId && categoryIdMap[row.categoryId]) ? categoryIdMap[row.categoryId] : null,
      accountId: (row.accountId && accountIdMap[row.accountId]) ? accountIdMap[row.accountId] : null,
    };
    await upsertRow('transactions', transactions, resolvedRow, ['firebaseDocId']);
  }

  // 5. Bills — resolve categoryId FK
  initStats('bills');
  const billIdMap: Record<string, string> = {};
  const billDocs = await db_.collection('bills').get();
  for (const doc of billDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bills'].errors++; continue; }
    const row = transformBill(doc.id, doc.data(), clientId, userId);
    const resolvedRow = {
      ...row,
      categoryId: (row.categoryId && categoryIdMap[row.categoryId]) ? categoryIdMap[row.categoryId] : null,
    };
    const id = await upsertRow('bills', bills, resolvedRow, ['firebaseDocId']);
    if (id) billIdMap[doc.id] = id;
  }

  // 6. Bill reminders — resolve billId FK
  initStats('bill_reminders');
  const reminderDocs = await db_.collection('bill_reminders').get();
  for (const doc of reminderDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bill_reminders'].errors++; continue; }
    const row = transformBillReminder(doc.id, doc.data(), clientId, userId);
    const resolvedRow = { ...row, billId: (row.billId && billIdMap[row.billId]) ? billIdMap[row.billId] : null };
    await upsertRow('bill_reminders', billReminders, resolvedRow, ['firebaseDocId']);
  }

  // 7. Reminder logs (merged into bill_reminders with sent: true)
  const reminderLogs = await db_.collection('reminder_logs').get();
  for (const doc of reminderLogs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bill_reminders'].errors++; continue; }
    const logRow = transformReminderLog(doc.id, doc.data(), clientId, userId);
    const resolvedBillId = logRow.billId ? billIdMap[logRow.billId] : null;
    if (!resolvedBillId) continue; // orphaned log — bill was deleted/replaced; skip silently
    await upsertRow('bill_reminders', billReminders, { ...logRow, billId: resolvedBillId }, ['firebaseDocId']);
  }

  // 8. Budgets
  initStats('budgets');
  const budgetDocs = await db_.collection('budgets').get();
  for (const doc of budgetDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['budgets'].errors++; continue; }
    await upsertRow('budgets', budgets, transformBudget(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 9. Goals
  initStats('goals');
  const goalDocs = await db_.collection('goals').get();
  for (const doc of goalDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['goals'].errors++; continue; }
    await upsertRow('goals', goals, transformGoal(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 10. Investments
  initStats('investments');
  const invDocs = await db_.collection('investments').get();
  for (const doc of invDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['investments'].errors++; continue; }
    await upsertRow('investments', investments, transformInvestment(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 11. Planner — doc ID is the Firebase UID (not a userId field inside the document)
  initStats('planner');
  const plannerDocs = await db_.collection('planner').get();
  for (const doc of plannerDocs.docs) {
    const userId = userIdMap[doc.id] ?? '';
    if (!userId) { summary['planner'].errors++; continue; }
    await upsertRow('planner', planner, transformPlanner(doc.data(), clientId, userId), ['clientId', 'userId']);
  }

  // 12. Settings — doc ID is the Firebase UID
  initStats('settings');
  const settingsDocs = await db_.collection('settings').get();
  for (const doc of settingsDocs.docs) {
    const userId = userIdMap[doc.id] ?? '';
    if (!userId) { summary['settings'].errors++; continue; }
    await upsertRow('settings', settings, transformSettings(doc.data(), clientId, userId), ['clientId', 'userId']);
  }

  // 13. Categorization rules — doc ID pattern: {userId}_{ruleId}; userId field may also exist
  initStats('categorization_rules');
  const ruleDocs = await db_.collection('userCategorizationRules').get();
  for (const doc of ruleDocs.docs) {
    const userId = resolveUserId(doc.data()) || userIdMap[doc.id] || '';
    if (!userId) { summary['categorization_rules'].errors++; continue; }
    await upsertRow('categorization_rules', categorizationRules, transformCategorizationRule(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 14. Imports
  initStats('imports');
  const importDocs = await db_.collection('imports').get();
  for (const doc of importDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['imports'].errors++; continue; }
    await upsertRow('imports', imports, transformImport(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }
}

// ─── Admin migration ─────────────────────────────────────────────────────────

async function migrateAdmin(db_: ReturnType<typeof getFirestore>) {
  console.log('\n→ Migrating admin collections');

  initStats('leads');
  const leadDocs = await db_.collection('leads').get();
  for (const doc of leadDocs.docs) {
    await upsertRow('leads', leads, transformLead(doc.id, doc.data()), ['firebaseDocId']);
  }

  initStats('purchases');
  const purchaseDocs = await db_.collection('purchases').get();
  for (const doc of purchaseDocs.docs) {
    await upsertRow('purchases', purchases, transformPurchase(doc.id, doc.data()), ['firebaseDocId']);
  }

  initStats('coupons');
  const couponDocs = await db_.collection('coupons').get();
  for (const doc of couponDocs.docs) {
    await upsertRow('coupons', coupons, transformCoupon(doc.id, doc.data()), ['firebaseDocId']);
  }

  initStats('import_issues');
  const issueDocs = await db_.collection('importIssues').get();
  for (const doc of issueDocs.docs) {
    await upsertRow('import_issues', importIssues, transformImportIssue(doc.id, doc.data()), ['firebaseDocId']);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const clientsConfigPath = path.resolve(__dirname, '../migration/clients.json');
  const clientsConfig: Record<string, string> = JSON.parse(
    fs.readFileSync(clientsConfigPath, 'utf8'),
  );

  const clientEntries = Object.entries(clientsConfig).filter(
    ([id]) => !onlyClient || id === onlyClient,
  );

  if (clientEntries.length === 0) {
    console.error(`No matching client found for --client ${onlyClient}`);
    process.exit(1);
  }

  for (const [clientId, credPath] of clientEntries) {
    const absoluteCredPath = path.resolve(path.dirname(clientsConfigPath), credPath);
    const serviceAccount = JSON.parse(fs.readFileSync(absoluteCredPath, 'utf8'));

    const existingApp = getApps().find((a) => a.name === clientId);
    if (existingApp) await deleteApp(existingApp);

    const app = initializeApp({ credential: cert(serviceAccount) }, clientId);
    const firestore = getFirestore(app);

    if (clientId === 'admin') {
      await migrateAdmin(firestore);
    } else {
      await migrateTenant(clientId, firestore, app);
    }

    await deleteApp(app);
  }

  // Print summary
  console.log('\n─── Migration Summary ─────────────────────────────────────');
  console.log(
    'Collection'.padEnd(30) + 'Attempted'.padEnd(12) + 'Inserted'.padEnd(12) + 'Updated'.padEnd(12) + 'Errors',
  );
  console.log('─'.repeat(72));
  let totalErrors = 0;
  for (const [name, stats] of Object.entries(summary)) {
    totalErrors += stats.errors;
    console.log(
      name.padEnd(30) +
        String(stats.attempted).padEnd(12) +
        String(stats.inserted).padEnd(12) +
        String(stats.updated).padEnd(12) +
        String(stats.errors),
    );
  }
  console.log('─'.repeat(72));

  await sql.end();

  if (totalErrors > 0) {
    console.error(`\n✖ Migration completed with ${totalErrors} errors`);
    process.exit(1);
  } else {
    console.log('\n✔ Migration completed successfully');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
