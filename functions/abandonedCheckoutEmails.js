'use strict';

const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const {
  checkoutReminderTemplate,
  checkoutCouponTemplate,
  checkoutLastChanceTemplate,
} = require('./emailTemplates');

const emailUser = defineSecret('EMAIL_USER');
const emailPassword = defineSecret('EMAIL_PASSWORD');
const emailHost = defineSecret('EMAIL_HOST');
const emailPort = defineSecret('EMAIL_PORT');

const db = admin.firestore();

const STAGES = { CREATED: 0, REMINDER_SENT: 1, COUPON_SENT: 2, LAST_CHANCE_SENT: 3 };
const DELAY_4H  = 4  * 60 * 60 * 1000;
const DELAY_24H = 24 * 60 * 60 * 1000;
const DELAY_48H = 48 * 60 * 60 * 1000;
const COUPON_TTL_MS = 24 * 60 * 60 * 1000;
const DISCOUNT_PERCENT = 10;
const CHECKOUT_URL = 'https://realwise.com.br/#pricing';

function emailToUsername(email) {
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function getTransporter() {
  try {
    const user = emailUser.value();
    const pass = emailPassword.value();
    const host = emailHost.value() || 'smtp.umbler.com';
    const port = Number(emailPort.value() || 587);
    if (!user || !pass) return null;
    return { transporter: nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } }), from: user };
  } catch (err) {
    console.error('[abandonedCheckout] Failed to load email secrets:', err);
    return null;
  }
}

async function upsertCoupon(email) {
  const code = emailToUsername(email);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + COUPON_TTL_MS);

  const existing = await db.collection('coupons')
    .where('email', '==', email)
    .where('source', '==', 'abandoned_checkout')
    .limit(1)
    .get();

  if (!existing.empty) {
    await existing.docs[0].ref.update({ issuedAt, expiresAt, usedCount: 0 });
    return { code, expiresAt };
  }

  await db.collection('coupons').add({
    code,
    email,
    issuedAt,
    expiresAt,
    discountPercent: DISCOUNT_PERCENT,
    maxUses: 1,
    usedCount: 0,
    source: 'abandoned_checkout',
  });
  return { code, expiresAt };
}

async function sendStageEmail(transporter, from, session, stage) {
  const { email, name } = session;
  const displayName = name || email.split('@')[0];

  if (stage === STAGES.REMINDER_SENT) {
    await transporter.sendMail({
      from: `"Realwise" <${from}>`,
      to: email,
      subject: `${displayName}, você esqueceu algo 👀`,
      html: checkoutReminderTemplate(displayName, CHECKOUT_URL),
    });
    return { expiresAt: null };
  }

  if (stage === STAGES.COUPON_SENT || stage === STAGES.LAST_CHANCE_SENT) {
    const { code, expiresAt } = await upsertCoupon(email);
    const subject = stage === STAGES.COUPON_SENT
      ? `🎁 Seu cupom especial: ${code.toUpperCase()} — ${DISCOUNT_PERCENT}% off`
      : `⏰ Última chance: cupom ${code.toUpperCase()} expira hoje`;
    const html = stage === STAGES.COUPON_SENT
      ? checkoutCouponTemplate(displayName, code, DISCOUNT_PERCENT, expiresAt, CHECKOUT_URL)
      : checkoutLastChanceTemplate(displayName, code, expiresAt, CHECKOUT_URL);
    await transporter.sendMail({ from: `"Realwise" <${from}>`, to: email, subject, html });
    return { expiresAt };
  }
}

/**
 * Scheduled: every 6 hours, processes all pending checkout sessions.
 * Sends 4h reminder, 24h coupon, 48h last-chance emails.
 */
exports.abandonedCheckoutReminders = functions
  .runWith({ secrets: [emailUser, emailPassword, emailHost, emailPort] })
  .pubsub
  .schedule('0 0,6,12,18 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    console.log('[abandonedCheckout] Scheduled run starting...');
    const result = await getTransporter();
    if (!result) {
      console.log('[abandonedCheckout] Email secrets unavailable — aborting');
      return null;
    }
    const { transporter, from } = result;
    const now = Date.now();

    const snap = await db.collection('checkout_sessions')
      .where('stage', '<', STAGES.LAST_CHANCE_SENT)
      .get();

    let sent = 0;
    await Promise.all(snap.docs.map(async (doc) => {
      const session = { id: doc.id, ...doc.data() };
      const createdAt = session.createdAt?.toMillis ? session.createdAt.toMillis() : now;
      const elapsed = now - createdAt;

      // Clean up if lead has already paid
      const leadSnap = await db.collection('leads').doc(session.email).get();
      if (leadSnap.exists) {
        const state = leadSnap.data().state;
        if (!['pending', 'not_paid'].includes(state)) {
          await doc.ref.delete();
          console.log(`[abandonedCheckout] Cleaned session for ${session.email} (state: ${state})`);
          return;
        }
      }

      let nextStage = null;
      if (session.stage === STAGES.CREATED && elapsed >= DELAY_4H) nextStage = STAGES.REMINDER_SENT;
      if (session.stage === STAGES.REMINDER_SENT && elapsed >= DELAY_24H) nextStage = STAGES.COUPON_SENT;
      if (session.stage === STAGES.COUPON_SENT && elapsed >= DELAY_48H) nextStage = STAGES.LAST_CHANCE_SENT;

      if (nextStage === null) return;

      try {
        await sendStageEmail(transporter, from, session, nextStage);
        await doc.ref.update({ stage: nextStage, lastSentAt: admin.firestore.FieldValue.serverTimestamp() });
        sent++;
        console.log(`[abandonedCheckout] Sent stage ${nextStage} to ${session.email}`);
      } catch (err) {
        console.error(`[abandonedCheckout] Error sending to ${session.email}:`, err);
      }
    }));

    console.log(`[abandonedCheckout] Done. Sent ${sent} email(s).`);
    return null;
  });

/**
 * Callable: manual trigger from admin dashboard.
 * stage: 1 = reminder, 2 = coupon, 3 = last chance
 */
exports.sendAbandonedCheckoutEmail = functions
  .runWith({ secrets: [emailUser, emailPassword, emailHost, emailPort] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) throw new functions.https.HttpsError('permission-denied', 'Not an admin');

    const { email, stage } = data;
    if (!email || !Number.isInteger(stage) || stage < 1 || stage > 3) {
      throw new functions.https.HttpsError('invalid-argument', 'email and stage (1-3) are required');
    }

    const result = await getTransporter();
    if (!result) throw new functions.https.HttpsError('internal', 'Email not configured');
    const { transporter, from } = result;

    const sessionRef = db.collection('checkout_sessions').doc(email);
    const leadSnap = await db.collection('leads').doc(email).get();
    const name = leadSnap.exists ? (leadSnap.data().name || '') : '';

    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      await sessionRef.set({
        email,
        name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        stage: stage - 1,
        lastSentAt: null,
      });
    }

    const session = { email, name };
    await sendStageEmail(transporter, from, session, stage);
    await sessionRef.set({ stage, lastSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    return { success: true, email, stage };
  });
