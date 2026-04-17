const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');

const db = admin.firestore();

/**
 * Stripe webhook — handles checkout.session.completed:
 *   1. Marks lead as paid in Firestore
 *   2. Records purchase in `purchases` collection
 *   3. Emails developer with buyer name, email, WhatsApp
 *
 * Firebase config required:
 *   stripe.secret_key      — Stripe secret key
 *   stripe.webhook_secret  — Signing secret from Stripe Dashboard > Webhooks
 *   email.user             — Gmail address for sending notifications
 *   email.password         — Gmail App Password
 *
 * NOTE: This function requires req.rawBody. Firebase Functions Gen 1 provides
 * this automatically for HTTP functions.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const secretKey = functions.config().stripe?.secret_key;
  const webhookSecret = functions.config().stripe?.webhook_secret;

  if (!secretKey || !webhookSecret) {
    console.error('Stripe keys not configured');
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

  if (event.type !== 'checkout.session.completed') {
    res.status(200).send('OK');
    return;
  }

  const session = event.data.object;
  const email = session.customer_email?.toLowerCase();
  const name = session.metadata?.name || '';
  const whatsapp = session.metadata?.whatsapp || '';
  const amountTotal = session.amount_total; // centavos

  if (!email) {
    console.error('No customer_email in session');
    res.status(200).send('OK');
    return;
  }

  try {
    // Mark lead as paid
    await db.collection('leads').doc(email).set(
      {
        paid: true,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeSessionId: session.id,
        amountTotal,
      },
      { merge: true }
    );

    // Record in purchases collection
    await db.collection('purchases').add({
      email,
      name,
      whatsapp,
      amountTotal,
      stripeSessionId: session.id,
      purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify developer by email
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
  const emailUser = functions.config().email?.user;
  const emailPass = functions.config().email?.password;

  if (!emailUser || !emailPass) {
    console.log('Email not configured — purchase only logged to Firestore');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  });

  const amountStr = `R$ ${(amountTotal / 100).toFixed(2)}`;
  const adminEmail = 'jonathalimax@gmail.com';

  await transporter.sendMail({
    from: emailUser,
    to: adminEmail,
    subject: `💰 Nova Compra Moneywise — ${amountStr}`,
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
}
