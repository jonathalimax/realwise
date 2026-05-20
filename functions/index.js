const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const emailUserSecret = defineSecret('EMAIL_USER');
const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');
const emailHostSecret = defineSecret('EMAIL_HOST');
const emailPortSecret = defineSecret('EMAIL_PORT');
const mpAccessTokenSecret = defineSecret('MP_ACCESS_TOKEN');
const mpPublicKeySecret = defineSecret('MP_PUBLIC_KEY');
const mpWebhookSecretSecret = defineSecret('MP_WEBHOOK_SECRET');

// Initialize Firebase Admin BEFORE importing other modules that depend on it
admin.initializeApp();

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const cors = require('cors')({ origin: true });
const nodemailer = require('nodemailer');
const { welcomeTemplate, accessGrantedTemplate, billReminderTemplate, newLeadTemplate } = require('./emailTemplates');
const axios = require('axios');

// Import processor functions (must come after admin.initializeApp())
const importProcessor = require('./importProcessor');
const { runB3Sync } = require('./b3Sync');

const db = admin.firestore();

// Initialize Mercado Pago with access token from Secret Manager
const getMercadoPagoClient = () => {
  const accessToken = mpAccessTokenSecret.value();
  if (!accessToken) {
    throw new Error('Mercado Pago access token not configured');
  }
  return new MercadoPagoConfig({ accessToken });
};

// Create email transporter
const getEmailTransporter = () => {
  try {
    const user = emailUserSecret.value();
    const pass = emailPasswordSecret.value();
    const host = emailHostSecret.value() || 'smtp.umbler.com';
    const port = Number(emailPortSecret.value() || 587);

    if (!user || !pass) {
      console.log('Email secrets not set — skipping email transporter creation');
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
  } catch (err) {
    console.error('Error getting email transporter:', err);
    return null;
  }
};

// Send purchase notification email (optional - works without email config)
const sendPurchaseNotification = async (purchaseData) => {
  const transporter = getEmailTransporter();

  // Log purchase details (visible in Firebase Console > Functions > Logs)
  console.log('=== NEW PURCHASE ===');
  console.log('Name:', purchaseData.name || 'Not provided');
  console.log('Email:', purchaseData.email);
  console.log('Amount: R$', purchaseData.amount.toFixed(2));
  console.log('Coupon:', purchaseData.couponCode || 'None');
  console.log('Payment ID:', purchaseData.paymentId);
  console.log('====================');

  if (!transporter) {
    console.log('Email not configured - check Firebase Console logs for purchase details');
    return;
  }

  const mailOptions = {
    from: `"Realwise" <${emailUserSecret.value()}>`,
    to: 'financeiro@realwise.com.br',
    subject: `💰 Nova Compra - Realwise - R$ ${purchaseData.amount.toFixed(2)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">💰 Nova Compra Realizada!</h1>
        </div>

        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #374151; margin-top: 0;">Detalhes do Cliente</h2>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Nome:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #111827;">${purchaseData.name || 'Não informado'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #111827;">${purchaseData.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Valor:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #10b981; font-size: 18px;">R$ ${purchaseData.amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Cupom:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #111827;">${purchaseData.couponCode || 'Nenhum'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">ID Pagamento:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-family: monospace; color: #6b7280;">${purchaseData.paymentId}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280;">Data:</td>
              <td style="padding: 10px 0; color: #111827;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
            </tr>
          </table>
        </div>

        <div style="background: #fef3c7; padding: 15px; border: 1px solid #fcd34d; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>⚡ Ação necessária:</strong> Execute o onboarding para provisionar o projeto Firebase do cliente:
          </p>
          <pre style="margin: 10px 0 0; background: #1e293b; color: #86efac; padding: 12px; border-radius: 8px; font-size: 13px; overflow-x: auto;">node scripts/onboard-user.cjs ${purchaseData.email}</pre>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Realwise - Sistema de Finanças Pessoais
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Purchase notification email sent to', adminEmail);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

/**
 * Initialize payment - returns public key for Mercado Pago Bricks
 * Called from the frontend to get the public key
 */
exports.createPayment = functions
  .runWith({ secrets: [mpAccessTokenSecret, mpPublicKeySecret] })
  .https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { email, name, whatsapp, couponCode, utmSource } = req.body;

      if (!email) {
        res.status(400).json({ error: 'email é obrigatório.' });
        return;
      }

      const publicKey = mpPublicKeySecret.value();
      if (!publicKey) {
        res.status(500).json({ error: 'Configuração de pagamento ausente.' });
        return;
      }

      const emailLower = email.toLowerCase().trim();
      const BASE_AMOUNT = 479;
      let amount = BASE_AMOUNT;

      // Validate coupon if provided
      if (couponCode && typeof couponCode === 'string') {
        const snap = await db.collection('coupons')
          .where('code', '==', couponCode.toUpperCase())
          .limit(1)
          .get();

        if (snap.empty) {
          res.status(400).json({ error: 'Cupom não encontrado.' });
          return;
        }

        const cd = snap.docs[0].data();
        const now = new Date();

        if (!cd.enabled) {
          res.status(400).json({ error: 'Cupom desabilitado.' });
          return;
        }
        if (cd.maxUses !== null && cd.maxUses !== undefined && (cd.currentUses || 0) >= cd.maxUses) {
          res.status(400).json({ error: 'Cupom atingiu o limite de usos.' });
          return;
        }
        if (cd.validUntil && cd.validUntil.toDate() < now) {
          res.status(400).json({ error: 'Cupom expirado.' });
          return;
        }
        if (cd.validFrom && cd.validFrom.toDate() > now) {
          res.status(400).json({ error: 'Cupom ainda não é válido.' });
          return;
        }

        if (cd.discountType === 'percentage') {
          amount = parseFloat((BASE_AMOUNT * (1 - cd.discountValue / 100)).toFixed(2));
        } else {
          amount = parseFloat((BASE_AMOUNT - cd.discountValue / 100).toFixed(2));
        }
      }

      // Upsert lead
      const leadRef = db.collection('leads').doc(emailLower);
      const leadSnap = await leadRef.get();
      const isNew = !leadSnap.exists;
      await leadRef.set(
        {
          name: name ? name.trim() : (leadSnap.data()?.name ?? ''),
          email: emailLower,
          ...(whatsapp ? { whatsapp: whatsapp.trim() } : {}),
          paid: false,
          state: leadSnap.data()?.state ?? 'checkout_started',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(isNew && { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );

      // Increment landing_stats
      const today = new Date().toISOString().slice(0, 10);
      const source = (utmSource && typeof utmSource === 'string') ? utmSource : 'direct';
      db.collection('landing_stats').doc(today).set(
        {
          checkout_started: admin.firestore.FieldValue.increment(1),
          [`sources.${source}`]: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      ).catch(err => console.error('[createPayment] landing_stats failed:', err));

      // Save pending payment
      await db.collection('pending_payments').add({
        email: emailLower,
        name: name || '',
        amount,
        couponCode: couponCode || null,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ publicKey, amount });
    } catch (error) {
      console.error('[createPayment] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * Process payment - handles the actual payment from Mercado Pago Bricks
 */
exports.processPayment = functions
  .runWith({ secrets: [mpAccessTokenSecret, emailUserSecret, emailPasswordSecret, emailHostSecret, emailPortSecret] })
  .https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const {
        token,
        issuer_id,
        payment_method_id,
        transaction_amount,
        installments,
        payer,
        email,
        name,
        couponCode,
        contribution
      } = req.body;

      console.log('[processPayment] body:', JSON.stringify({ payment_method_id, token: !!token, payer, transaction_amount }));

      const client = getMercadoPagoClient();
      const payment = new Payment(client);

      const isTicket = !token; // boleto/ticket payments don't use card tokens
      // Pass the full payer object from MP Bricks (contains address, identification, etc.)
      // and fill in any gaps from the step-1 form fields
      const payerData = {
        ...(payer || {}),
        email: payer?.email || email,
        first_name: payer?.first_name || name?.split(' ')[0] || '',
        last_name: payer?.last_name || name?.split(' ').slice(1).join(' ') || '',
      };
      const paymentData = {
        transaction_amount: parseFloat(transaction_amount),
        ...(token && { token }),
        description: 'Realwise - Acesso Completo',
        installments: parseInt(installments) || 1,
        payment_method_id: payment_method_id,
        ...(isTicket && { payment_type_id: 'ticket' }),
        ...(isTicket && { date_of_expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() }),
        ...(issuer_id && { issuer_id }),
        payer: payerData,
        external_reference: JSON.stringify({
          email: (payer?.email || email).toLowerCase(),
          name: name || '',
          couponCode: couponCode || null,
          contribution: parseFloat(contribution) || 0,
          timestamp: Date.now(),
        }),
        statement_descriptor: 'REALWISE',
      };

      console.log('[processPayment] paymentData:', JSON.stringify(paymentData));
      const mpAccessToken = mpAccessTokenSecret.value();
      let response;
      try {
        if (isTicket) {
          // Call MP REST API directly for ticket/boleto — SDK may strip nested fields
          const fetch = require('node-fetch');
          const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mpAccessToken}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': require('crypto').randomUUID(),
            },
            body: JSON.stringify(paymentData),
          });
          const mpBody = await mpRes.json();
          console.log('[processPayment] direct API response:', JSON.stringify(mpBody));
          if (!mpRes.ok) throw Object.assign(new Error(mpBody.message || 'MP API error'), { status: mpRes.status, cause: mpBody.cause });
          response = mpBody;
        } else {
          response = await payment.create({ body: paymentData });
        }
      } catch (mpErr) {
        // MP occasionally returns internal_error without creating a payment.
        // Retry once — safe because internal_error means nothing was charged.
        if (!isTicket && mpErr?.message === 'internal_error') {
          console.warn('[processPayment] MP internal_error — retrying once', {
            payment_method_id,
            transaction_amount: paymentData.transaction_amount,
          });
          await new Promise(r => setTimeout(r, 1000));
          response = await payment.create({ body: paymentData });
        } else {
          throw mpErr;
        }
      }

      // Update pending payment status
      const pendingQuery = await db.collection('pending_payments')
        .where('email', '==', (payer?.email || email).toLowerCase())
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!pendingQuery.empty) {
        await pendingQuery.docs[0].ref.update({
          status: response.status,
          paymentId: response.id,
          statusDetail: response.status_detail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // If approved, grant access and send email
      if (response.status === 'approved') {
        const approvedEmail = (payer?.email || email).toLowerCase();
        await grantAccessAndNotify(approvedEmail, name, couponCode, parseInt(installments) || 1, response.transaction_amount || 0);

        if (couponCode && typeof couponCode === 'string') {
          const couponSnap = await db.collection('coupons')
            .where('code', '==', couponCode.toUpperCase())
            .limit(1)
            .get();
          if (!couponSnap.empty) {
            await couponSnap.docs[0].ref.update({
              currentUses: admin.firestore.FieldValue.increment(1),
            });
          }
        }
      }

      if (response.status === 'rejected') {
        console.warn('[processPayment] Payment rejected:', {
          status_detail: response.status_detail,
          payment_method_id: payment_method_id,
          id: response.id,
        });
      }

      const txData = response.point_of_interaction?.transaction_data;
      const pendingDocId = pendingQuery.empty ? null : pendingQuery.docs[0].id;
      res.json({
        id: response.id,
        status: response.status,
        status_detail: response.status_detail,
        pending_doc_id: pendingDocId,
        ...(txData?.qr_code && { pix_code: txData.qr_code }),
        ...(txData?.qr_code_base64 && { pix_qr_base64: txData.qr_code_base64 }),
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Helper function to grant access and send notification
async function grantAccessAndNotify(email, name, couponCode, installments = 1, amountBRL = 0) {
  try {
    const normalizedEmail = email.toLowerCase();

    // Dashboard's brl() formatter expects centavos (integer), MP gives decimal BRL
    const amountCentavos = Math.round(amountBRL * 100);

    // Add to purchases collection
    await db.collection('purchases').add({
      email: normalizedEmail,
      name: name || '',
      couponCode: couponCode || null,
      installments,
      amountTotal: amountCentavos,
      purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Upsert lead state — set with merge so it works even if the doc doesn't exist yet
    try {
      await db.collection('leads').doc(normalizedEmail).set({
        state: 'paid',
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        amountTotal: amountCentavos,
      }, { merge: true });
    } catch (leadErr) {
      console.warn(`[grantAccess] Could not update lead state for ${normalizedEmail}:`, leadErr.message);
    }

    // Send welcome email
    const transporter = getEmailTransporter();
    if (transporter) {
      const fromAddr = emailUserSecret.value() || 'contato@realwise.com.br';
      await transporter.sendMail({
        from: `"Realwise" <${fromAddr}>`,
        to: normalizedEmail,
        subject: 'Bem-vindo ao Realwise! 🎉',
        html: welcomeTemplate(name || 'Cliente'),
      });
      console.log(`[grantAccess] Welcome email sent to ${normalizedEmail}`);
    } else {
      console.warn('[grantAccess] Email transporter not available — welcome email skipped');
    }
  } catch (error) {
    console.error('Error granting access:', error);
  }
}

/**
 * Webhook to receive Mercado Pago payment notifications
 */
exports.mercadoPagoWebhook = functions
  .runWith({ secrets: [mpAccessTokenSecret, mpWebhookSecretSecret, emailUserSecret, emailPasswordSecret, emailHostSecret, emailPortSecret] })
  .https.onRequest(async (req, res) => {
  try {
    // Validate MP webhook signature
    const webhookSecret = mpWebhookSecretSecret.value();
    if (webhookSecret) {
      const xSignature = req.headers['x-signature'];
      const xRequestId = req.headers['x-request-id'];
      const paymentId = req.body?.data?.id;

      if (!xSignature || !xRequestId) {
        console.warn('[mercadoPagoWebhook] Missing signature headers');
        res.status(401).send('Unauthorized');
        return;
      }

      // Parse ts and v1 from x-signature header (format: "ts=<ts>,v1=<hash>")
      // Split only on the first '=' to preserve base64 padding in the hash value
      const parts = {};
      xSignature.split(',').forEach(segment => {
        const idx = segment.indexOf('=');
        if (idx > -1) parts[segment.slice(0, idx)] = segment.slice(idx + 1);
      });
      const ts = parts['ts'];
      const v1 = parts['v1'];

      if (!ts || !v1) {
        console.warn('[mercadoPagoWebhook] Malformed x-signature header');
        res.status(401).send('Unauthorized');
        return;
      }

      const crypto = require('crypto');
      const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
      const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

      if (expected !== v1) {
        console.warn('[mercadoPagoWebhook] Signature mismatch');
        res.status(401).send('Unauthorized');
        return;
      }
    }

    const { type, data } = req.body;

    // Only process payment notifications
    if (type !== 'payment') {
      res.status(200).send('OK');
      return;
    }

    const paymentId = data?.id;
    if (!paymentId) {
      res.status(400).send('Missing payment ID');
      return;
    }

    const client = getMercadoPagoClient();
    const payment = new Payment(client);

    // Get payment details from Mercado Pago
    const paymentData = await payment.get({ id: paymentId });

    console.log('Payment received:', {
      id: paymentId,
      status: paymentData.status,
      external_reference: paymentData.external_reference,
    });

    // Only process approved or in_process payments
    if (paymentData.status === 'approved' || paymentData.status === 'in_process') {
      let externalRef;
      try {
        externalRef = JSON.parse(paymentData.external_reference);
      } catch (e) {
        console.error('Error parsing external reference:', e);
        res.status(200).send('OK');
        return;
      }

      const email = externalRef.email?.toLowerCase();
      const name = externalRef.name || '';

      if (!email) {
        console.error('No email in external reference');
        res.status(200).send('OK');
        return;
      }

      // Update pending payment status
      const pendingQuery = await db.collection('pending_payments')
        .where('email', '==', email)
        .where('status', 'in', ['pending', 'in_process']) // Also check for 'in_process'
        .limit(1)
        .get();

      if (!pendingQuery.empty) {
        if (paymentData.status === 'approved') {
          await pendingQuery.docs[0].ref.update({
            status: 'approved',
            paymentId: paymentId,
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else if (paymentData.status === 'in_process') {
          await pendingQuery.docs[0].ref.update({
            status: 'in_process',
            paymentId: paymentId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // If status is approved, grant access, send user email, and notify admin
      if (paymentData.status === 'approved') {
        await grantAccessAndNotify(email, name, externalRef.couponCode, 1, paymentData.transaction_amount || 0);

        await sendPurchaseNotification({
          email: email,
          name: name,
          amount: paymentData.transaction_amount,
          couponCode: externalRef.couponCode,
          paymentId: paymentId,
        });

        // If coupon was used, increment its usage count
        if (externalRef.couponCode) {
          const couponQuery = await db.collection('coupons')
            .where('code', '==', externalRef.couponCode.toUpperCase())
            .limit(1)
            .get();

          if (!couponQuery.empty) {
            await couponQuery.docs[0].ref.update({
              currentUses: admin.firestore.FieldValue.increment(1),
            });
          }
        }
      }
    } else if (paymentData.status === 'rejected') {
      let externalRef;
      try {
        externalRef = JSON.parse(paymentData.external_reference);
      } catch (e) {
        console.error('Error parsing external reference for rejected payment:', e);
        res.status(200).send('OK');
        return;
      }

      const email = externalRef.email?.toLowerCase();
      if (!email) {
        console.error('No email in external reference for rejected payment');
        res.status(200).send('OK');
        return;
      }

      // Update pending payment status to rejected
      const pendingQuery = await db.collection('pending_payments')
        .where('email', '==', email)
        .where('status', 'in', ['pending', 'in_process'])
        .limit(1)
        .get();

      if (!pendingQuery.empty) {
        await pendingQuery.docs[0].ref.update({
          status: 'rejected',
          paymentId: paymentId,
          rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Check payment status (called from frontend after redirect)
 */
exports.checkPaymentStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { email } = req.query;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      let currentStatus = 'pending'; // Default status
      let approved = false;
      let rejected = false;

      // First, check if there's a pending payment record
      const pendingQuery = await db.collection('pending_payments')
        .where('email', '==', email.toLowerCase())
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!pendingQuery.empty) {
        const pendingPayment = pendingQuery.docs[0].data();
        currentStatus = pendingPayment.status;
        if (currentStatus === 'approved') {
          approved = true;
        } else if (currentStatus === 'rejected') {
          rejected = true;
        }
      } else {
        // If no pending payment, check if a purchase has already been completed
        const purchaseQuery = await db.collection('purchases')
          .where('email', '==', email.toLowerCase())
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!purchaseQuery.empty) {
          const purchase = purchaseQuery.docs[0].data();
          if (purchase.status === 'approved') {
            currentStatus = 'approved';
            approved = true;
          }
        }
      }

      res.json({
        status: currentStatus,
        approved: approved,
        rejected: rejected,
      });
    } catch (error) {
      console.error('Error checking payment status:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.scheduledBillReminders = require('./clientScheduledBillReminders').scheduledBillReminders;


/**
 * Sync B3 investment prices and dividends from Brapi.dev
 * Runs on 1st, 10th, and 20th of each month at 8 AM Brazil time
 */
exports.syncB3Investments = functions.pubsub
  .schedule('0 8 1,10,20 * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    try {
      console.log('[syncB3Investments] Scheduled run started');

      const snap = await db.collection('investments')
        .where('source', '==', 'b3')
        .select('userId')
        .get();

      const userIds = [...new Set(snap.docs.map(d => d.data().userId).filter(Boolean))];
      console.log(`[syncB3Investments] Found ${userIds.length} user(s) with B3 investments`);

      for (const userId of userIds) {
        try {
          await runB3Sync(userId);
        } catch (err) {
          console.error(`[syncB3Investments] Error syncing user ${userId}:`, err);
        }
      }

      return null;
    } catch (err) {
      console.error('[syncB3Investments] Fatal error:', err);
      return null;
    }
  });

/**
 * Manual sync trigger — callable from the app after a B3 CSV import.
 * Requires the caller to be authenticated.
 */
exports.syncB3InvestmentsCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;

  try {
    const result = await runB3Sync(userId);
    return { success: true, ...result };
  } catch (err) {
    console.error(`[syncB3InvestmentsCallable] Error for user ${userId}:`, err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// ============================================================
// IMPORT PROCESSOR FUNCTIONS
// ============================================================

/**
 * Process import files uploaded to Firebase Storage
 * Triggers on file upload to /imports/{userId}/{bankType}/{filename}
 */
exports.processImport = importProcessor.processImport;

/**
 * Firestore trigger to decrement pending review count when transaction is reviewed
 */
exports.onTransactionReviewed = importProcessor.onTransactionReviewed;

// ============================================================
// STRIPE PAYMENT FUNCTIONS
// ============================================================

const { createCheckoutSession } = require('./createCheckoutSession');
exports.createCheckoutSession = createCheckoutSession;

const { stripeWebhook } = require('./stripeWebhook');
exports.stripeWebhook = stripeWebhook;


// ============================================================
// SEAMLESS LOGIN
// ============================================================

const { getCustomToken } = require('./getCustomToken');
exports.getCustomToken = getCustomToken;

// ============================================================
// ADMIN SYSTEM
// ============================================================

const { onboardUser } = require('./onboardUser');
exports.onboardUser = onboardUser;

const { sendAdminEmail } = require('./sendAdminEmail');
exports.sendAdminEmail = sendAdminEmail;

const { updateLeadState } = require('./updateLeadState');
exports.updateLeadState = updateLeadState;

const { createDiscountCheckout } = require('./createDiscountCheckout');
exports.createDiscountCheckout = createDiscountCheckout;

const { createStandaloneCoupon } = require('./createStandaloneCoupon');
exports.createStandaloneCoupon = createStandaloneCoupon;

const { syncCouponToStripe } = require('./syncCouponToStripe');
exports.syncCouponToStripe = syncCouponToStripe;

const { transferClient } = require('./transferClient');
exports.transferClient = transferClient;

const { submitImportIssue } = require('./submitImportIssue');
exports.submitImportIssue = submitImportIssue;

exports.sendImportIssueEmail = require('./sendImportIssueEmail').sendImportIssueEmail;

const abandonedCheckout = require('./abandonedCheckoutEmails');
exports.abandonedCheckoutReminders = abandonedCheckout.abandonedCheckoutReminders;
exports.sendAbandonedCheckoutEmail = abandonedCheckout.sendAbandonedCheckoutEmail;

// ============================================================
// NEW LEAD NOTIFICATION
// ============================================================

exports.onNewLead = functions.firestore
  .document('leads/{leadId}')
  .onCreate(async (snap) => {
    const { name, email, whatsapp, createdAt } = snap.data();

    if (!email) {
      console.log('[onNewLead] No email on lead — skipping notification');
      return;
    }

    if (snap.data().state === 'form_partial') {
      console.log('[onNewLead] Skipping notification for form_partial lead');
      return;
    }

    const transporter = getEmailTransporter();
    if (!transporter) {
      console.log('[onNewLead] Email transporter not configured — skipping');
      return;
    }

    const adminEmail = process.env.EMAIL_LEADS || 'jonathalimax@gmail.com';

    try {
      await transporter.sendMail({
        from: `"Realwise" <${emailUserSecret.value()}>`,
        to: adminEmail,
        subject: `[Realwise] Novo lead: ${name || email}`,
        html: newLeadTemplate({ name, email, whatsapp, createdAt }),
      });
      console.log(`[onNewLead] Notification sent to ${adminEmail} for lead ${email}`);
    } catch (err) {
      console.error('[onNewLead] Failed to send notification:', err);
    }
  });

// ============================================================
// PARTIAL LEAD CAPTURE
// ============================================================
const savePartialLeadModule = require('./savePartialLead');
exports.savePartialLead = savePartialLeadModule.savePartialLead;
