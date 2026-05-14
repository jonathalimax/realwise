const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const { welcomeTemplate } = require('./emailTemplates');

const db = admin.firestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const emailUser = defineSecret('EMAIL_USER');
const emailPassword = defineSecret('EMAIL_PASSWORD');

/**
 * Stripe webhook — handles checkout.session.completed:
 *   1. Marks lead as paid in Firestore
 *   2. Records purchase in `purchases` collection
 *   3. Emails developer with buyer name, email, WhatsApp
 *
 * Secrets required:
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *   firebase functions:secrets:set EMAIL_USER
 *   firebase functions:secrets:set EMAIL_PASSWORD
 */
exports.stripeWebhook = functions
  .runWith({ secrets: [stripeSecretKey, stripeWebhookSecret, emailUser, emailPassword] })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const secretKey = stripeSecretKey.value();
    const webhookSecret = stripeWebhookSecret.value();

    if (!secretKey || !webhookSecret) {
      console.error('Stripe secrets not set');
      res.status(500).send('Configuration error');
      return;
    }

    const stripe = Stripe(secretKey);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Track abandoned checkout — fires when user opens the Stripe checkout page
    if (event.type === 'checkout.session.created') {
      const session = event.data.object;
      const email = session.customer_email?.toLowerCase();
      const name = session.metadata?.name || '';
      if (email) {
        await db.collection('checkout_sessions').doc(email).set({
          email,
          name,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          stage: 0,
          lastSentAt: null,
          stripeSessionId: session.id,
        }, { merge: false });
        console.log(`[stripeWebhook] Checkout session created for ${email}`);
      }
      res.status(200).send('OK');
      return;
    }

    if (event.type !== 'checkout.session.completed') {
      res.status(200).send('OK');
      return;
    }

    const session = event.data.object;
    const email = session.customer_email?.toLowerCase();
    const name = session.metadata?.name || '';
    const whatsapp = session.metadata?.whatsapp || '';
    const amountTotal = session.amount_total;

    if (!email) {
      console.error('No customer_email in session');
      res.status(200).send('OK');
      return;
    }

    try {
      await db.collection('leads').doc(email).set(
        {
          paid: true,
          state: 'paid',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          stripeSessionId: session.id,
          amountTotal,
        },
        { merge: true }
      );

      await db.collection('purchases').add({
        email,
        name,
        whatsapp,
        amountTotal,
        stripeSessionId: session.id,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Clean up abandoned checkout tracking now that payment succeeded
      await db.collection('checkout_sessions').doc(email).delete().catch(() => {});

      await sendPurchaseEmail({ name, email, whatsapp, amountTotal });

      console.log('=== NOVA COMPRA (Stripe) ===');
      console.log('Nome:', name);
      console.log('Email:', email);
      console.log('WhatsApp:', whatsapp);
      console.log('Valor: R$', (amountTotal / 100).toFixed(2));
      console.log('Session:', session.id);
      console.log('===========================');

      res.status(200).send('OK');
    } catch (err) {
      console.error('Error handling checkout.session.completed:', err);
      res.status(500).send('Internal error');
    }
  });

async function sendPurchaseEmail({ name, email, whatsapp, amountTotal }) {
  const user = emailUser.value();
  const pass = emailPassword.value();

  if (!user || !pass) {
    console.log('Email secrets not set — purchase only logged to Firestore');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const amountStr = `R$ ${(amountTotal / 100).toFixed(2)}`;

  // 1. Email to Developer (Notification)
  await transporter.sendMail({
    from: user,
    to: 'jonathalimax@gmail.com',
    subject: `💰 Nova Compra Realwise — ${amountStr}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#10b981,#059669);padding:20px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:24px">💰 Nova Compra Realizada!</h1>
        </div>
        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none">
          <h2 style="color:#374151;margin-top:0">Dados do Cliente</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Nome:</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#111827">${name || 'Não informado'}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">E-mail:</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#111827">${email}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">WhatsApp:</td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#111827">${whatsapp || 'Não informado'}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7280">Valor:</td>
              <td style="padding:10px 0;font-weight:bold;color:#10b981;font-size:18px">${amountStr}</td>
            </tr>
          </table>
        </div>
        <div style="background:#fef3c7;padding:15px;border:1px solid #fcd34d;border-top:none;border-radius:0 0 12px 12px">
          <p style="margin:0;color:#92400e;font-size:14px">
            <strong>⚡ Ação necessária:</strong> Configure o acesso para <strong>${email}</strong>.
            WhatsApp do cliente: <strong>${whatsapp}</strong>
          </p>
        </div>
      </div>
    `,
  });

  // 2. Email to Customer (Welcome)
  if (email) {
    try {
      await transporter.sendMail({
        from: user,
        to: email,
        subject: 'Bem-vindo ao Realwise! 🚀',
        html: welcomeTemplate(name || 'Cliente'),
      });
      console.log(`Welcome email sent to ${email}`);
    } catch (err) {
      console.error(`Error sending welcome email to ${email}:`, err);
    }
  }
}
