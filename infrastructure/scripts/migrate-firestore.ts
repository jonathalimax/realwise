import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

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
) {
  summary[collectionName].attempted++;
  try {
    const result = await db
      .insert(table)
      .values(row as any)
      .onConflictDoUpdate({
        target: conflictTarget.map((c) => (table as any)[c]),
        set: row as any,
      });
    if ((result as any).rowCount === 0) {
      summary[collectionName].updated++;
    } else {
      summary[collectionName].inserted++;
    }
  } catch (err) {
    summary[collectionName].errors++;
    console.warn(`  WARN [${collectionName}] doc error:`, (err as Error).message);
  }
}

// ─── Tenant migration ────────────────────────────────────────────────────────

async function migrateTenant(clientId: string, db_: ReturnType<typeof getFirestore>) {
  console.log(`\n→ Migrating tenant: ${clientId}`);

  // 1. Users — keyed by firebase uid (doc id)
  initStats('users');
  const userDocs = await db_.collection('users').get();
  const userIdMap: Record<string, string> = {};

  for (const doc of userDocs.docs) {
    const row = transformUser(doc.id, doc.data(), clientId);
    try {
      const inserted = await sql`
        INSERT INTO users ${sql(row as any)}
        ON CONFLICT (client_id, email) DO UPDATE SET
          firebase_uid = EXCLUDED.firebase_uid,
          name = EXCLUDED.name,
          updated_at = now()
        RETURNING id, firebase_uid
      `;
      userIdMap[doc.id] = inserted[0].id;
      summary['users'].attempted++;
      summary['users'].inserted++;
    } catch (err) {
      summary['users'].attempted++;
      summary['users'].errors++;
      console.warn(`  WARN [users] ${doc.id}:`, (err as Error).message);
    }
  }

  // Helper: resolve user UUID from firebase uid or userId field
  function resolveUserId(data: Record<string, any>): string {
    return userIdMap[data.userId as string] ?? userIdMap[data.uid as string] ?? '';
  }

  // 2. Accounts (userBanks)
  initStats('accounts');
  const accountDocs = await db_.collection('userBanks').get();
  for (const doc of accountDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['accounts'].errors++; continue; }
    await upsertRow('accounts', accounts, transformAccount(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 3. Categories
  initStats('categories');
  const catDocs = await db_.collection('categories').get();
  for (const doc of catDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['categories'].errors++; continue; }
    await upsertRow('categories', categories, transformCategory(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 4. Transactions
  initStats('transactions');
  const txDocs = await db_.collection('transactions').get();
  for (const doc of txDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['transactions'].errors++; continue; }
    await upsertRow('transactions', transactions, transformTransaction(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 5. Bills
  initStats('bills');
  const billDocs = await db_.collection('bills').get();
  for (const doc of billDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bills'].errors++; continue; }
    await upsertRow('bills', bills, transformBill(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 6. Bill reminders
  initStats('bill_reminders');
  const reminderDocs = await db_.collection('bill_reminders').get();
  for (const doc of reminderDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bill_reminders'].errors++; continue; }
    await upsertRow('bill_reminders', billReminders, transformBillReminder(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 7. Reminder logs (merged into bill_reminders with sent: true)
  const reminderLogs = await db_.collection('reminder_logs').get();
  for (const doc of reminderLogs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bill_reminders'].errors++; continue; }
    await upsertRow('bill_reminders', billReminders, transformReminderLog(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
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

  // 11. Planner (single doc per user)
  initStats('planner');
  const plannerDocs = await db_.collection('planner').get();
  for (const doc of plannerDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['planner'].errors++; continue; }
    await upsertRow('planner', planner, transformPlanner(doc.data(), clientId, userId), ['clientId', 'userId']);
  }

  // 12. Settings (single doc per user)
  initStats('settings');
  const settingsDocs = await db_.collection('settings').get();
  for (const doc of settingsDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['settings'].errors++; continue; }
    await upsertRow('settings', settings, transformSettings(doc.data(), clientId, userId), ['clientId', 'userId']);
  }

  // 13. Categorization rules
  initStats('categorization_rules');
  const ruleDocs = await db_.collection('userCategorizationRules').get();
  for (const doc of ruleDocs.docs) {
    const userId = resolveUserId(doc.data());
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
      await migrateTenant(clientId, firestore);
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
