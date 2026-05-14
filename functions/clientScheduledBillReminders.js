'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const nodemailer = require('nodemailer');
const { billReminderTemplate } = require('./emailTemplates');
const { collectClientUserIds, collectUserBillGroups } = require('./billReminders');

const SHARED_PROJECT = 'moneywise-ad9ec';
const smClient = new SecretManagerServiceClient();

async function getSharedSecret(name) {
  const [version] = await smClient.accessSecretVersion({
    name: `projects/${SHARED_PROJECT}/secrets/${name}/versions/latest`,
  });
  return version.payload.data.toString();
}

async function getEmailTransporter() {
  try {
    const [user, pass, host, port] = await Promise.all([
      getSharedSecret('EMAIL_USER'),
      getSharedSecret('EMAIL_PASSWORD'),
      getSharedSecret('EMAIL_HOST').catch(() => 'smtp.umbler.com'),
      getSharedSecret('EMAIL_PORT').catch(() => '587'),
    ]);
    return { transporter: nodemailer.createTransport({ host, port: Number(port), secure: false, auth: { user, pass } }), user };
  } catch (err) {
    console.error('[clientBillReminders] Failed to load email secrets:', err);
    return null;
  }
}

function formatCurrency(val) {
  const num = parseFloat(val);
  return `R$ ${(isNaN(num) ? 0 : num).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

async function sendBillReminderEmail(transporter, from, to, name, billGroups, billsUrl) {
  const allBills = [...billGroups.overdue, ...billGroups.dueToday, ...(billGroups.dueSoon || []), ...(billGroups.upcoming || [])];
  const grandTotal = allBills.reduce((sum, b) => sum + (b.cardOutcomesAmount != null ? b.cardOutcomesAmount : (b.amount || 0)), 0);
  let subject;
  if (billGroups.overdue.length > 0) {
    subject = `⚠️ ${billGroups.overdue.length} conta(s) atrasada(s) · ${formatCurrency(grandTotal)}`;
  } else if (billGroups.dueToday.length > 0) {
    subject = `📅 Vence hoje · ${formatCurrency(grandTotal)}`;
  } else {
    subject = `🔵 ${(billGroups.dueSoon || []).length} conta(s) nos próximos dias · ${formatCurrency(grandTotal)}`;
  }
  await transporter.sendMail({ from: `"Realwise" <${from}>`, to, subject, html: billReminderTemplate(name, billGroups, billsUrl) });
}

exports.scheduledBillReminders = functions
  .pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    console.log('[clientBillReminders] Starting...');

    const result = await getEmailTransporter();
    if (!result) {
      console.log('[clientBillReminders] Email secrets unavailable — aborting');
      return null;
    }
    const { transporter, user: emailFrom } = result;

    const db = admin.firestore();
    const auth = admin.auth();

    const userIds = await collectClientUserIds(db);
    console.log(`[clientBillReminders] ${userIds.length} user(s) with actionable bills`);

    let totalSent = 0;
    await Promise.all(userIds.map(async (userId) => {
      try {
        const settingsDoc = await db.collection('settings').doc(userId).get();
        if (settingsDoc.exists && settingsDoc.data().billReminders === false) {
          console.log(`[clientBillReminders] Skipping ${userId} — reminders disabled`);
          return;
        }

        let authUser;
        try {
          authUser = await auth.getUser(userId);
        } catch (authErr) {
          console.log(`[clientBillReminders] Skipping ${userId} — Auth lookup failed: ${authErr.message}`);
          return;
        }
        // Owner accounts (custom UID) have no email in Auth — fall back to access/allowed_emails
        let email = authUser.email;
        if (!email) {
          const accessDoc = await db.collection('access').doc('allowed_emails').get();
          email = accessDoc.exists ? (accessDoc.data().emails || [])[0] : null;
        }
        if (!email) {
          console.log(`[clientBillReminders] Skipping ${userId} — no email in Auth or access list`);
          return;
        }
        authUser = { ...authUser, email };

        const userName = settingsDoc.exists
          ? (settingsDoc.data().name || authUser.displayName)
          : authUser.displayName;

        const billGroups = await collectUserBillGroups(db, userId);
        console.log(`[clientBillReminders] ${userId}: overdue=${billGroups.overdue.length} dueToday=${billGroups.dueToday.length}`);
        const hasBillsToNotify = billGroups.overdue.length > 0 || billGroups.dueToday.length > 0 || (billGroups.dueSoon || []).length > 0;
        if (!hasBillsToNotify) {
          console.log(`[clientBillReminders] Skipping ${userId} — no overdue/today/soon bills`);
          return;
        }

        const billsUrl = `https://realwise.com.br/${authUser.email.split('@')[0]}/bills`;
        await sendBillReminderEmail(transporter, emailFrom, authUser.email, userName || 'Cliente', billGroups, billsUrl);

        const batch = db.batch();
        for (const bill of [...billGroups.overdue, ...billGroups.dueToday, ...(billGroups.dueSoon || [])].slice(0, 10)) {
          batch.set(db.collection('reminder_logs').doc(), {
            userId,
            billId: bill.id,
            billName: bill.name || bill.description || 'Conta',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            sentVia: 'email',
          });
        }
        await batch.commit();
        totalSent++;
      } catch (err) {
        console.error(`[clientBillReminders] Error for user ${userId}:`, err);
      }
    }));

    console.log(`[clientBillReminders] Done. Sent ${totalSent} email(s).`);
    return null;
  });
