const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const emailUserSecret = defineSecret('EMAIL_USER');
const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');

// Initialize Firebase Admin BEFORE importing other modules that depend on it
admin.initializeApp();

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const cors = require('cors')({ origin: true });
const nodemailer = require('nodemailer');
const { accessGrantedTemplate, billReminderTemplate } = require('./emailTemplates');
const axios = require('axios');

// Import processor functions (must come after admin.initializeApp())
const importProcessor = require('./importProcessor');
const { runB3Sync } = require('./b3Sync');

const db = admin.firestore();

// Initialize Mercado Pago with access token from Firebase config
const getMercadoPagoClient = () => {
  const accessToken = functions.config().mercadopago?.access_token;
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

    if (!user || !pass) {
      console.log('Email secrets not set — skipping email transporter creation');
      return null;
    }

    return nodemailer.createTransport({
      service: 'gmail',
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

  const adminEmail = 'jonathalimax@gmail.com';

  const mailOptions = {
    from: functions.config().email?.user || 'noreply@mymoneywise.web.app',
    to: adminEmail,
    subject: `💰 Nova Compra - Moneywise - R$ ${purchaseData.amount.toFixed(2)}`,
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
            <strong>⚡ Ação necessária:</strong> Adicione o email <strong>${purchaseData.email}</strong> à lista de acesso nas configurações do app.
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Moneywise - Sistema de Finanças Pessoais
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
exports.createPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { email, name, price, couponCode, contribution } = req.body;

      if (!email || !price) {
        res.status(400).json({ error: 'Email and price are required' });
        return;
      }

      const publicKey = functions.config().mercadopago?.public_key;
      if (!publicKey) {
        throw new Error('Mercado Pago public key not configured');
      }

      // Save pending payment to Firestore
      await db.collection('pending_payments').add({
        email: email.toLowerCase(),
        name: name || '',
        price: parseFloat(price),
        contribution: parseFloat(contribution) || 0,
        couponCode: couponCode || null,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ publicKey });
    } catch (error) {
      console.error('Error initializing payment:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * Process payment - handles the actual payment from Mercado Pago Bricks
 */
exports.processPayment = functions.https.onRequest((req, res) => {
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

      const client = getMercadoPagoClient();
      const payment = new Payment(client);

      const paymentData = {
        transaction_amount: parseFloat(transaction_amount),
        token: token,
        description: 'Moneywise - Acesso Completo',
        installments: parseInt(installments) || 1,
        payment_method_id: payment_method_id,
        issuer_id: issuer_id,
        payer: {
          email: payer?.email || email,
          first_name: payer?.first_name || name?.split(' ')[0] || '',
          last_name: payer?.last_name || name?.split(' ').slice(1).join(' ') || '',
          identification: payer?.identification || undefined,
        },
        external_reference: JSON.stringify({
          email: (payer?.email || email).toLowerCase(),
          name: name || '',
          couponCode: couponCode || null,
          contribution: parseFloat(contribution) || 0,
          timestamp: Date.now(),
        }),
        statement_descriptor: 'MONEYWISE',
      };

      const response = await payment.create({ body: paymentData });

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
        await grantAccessAndNotify((payer?.email || email).toLowerCase(), name, couponCode);
      }

      res.json({
        id: response.id,
        status: response.status,
        status_detail: response.status_detail,
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Helper function to grant access and send notification
async function grantAccessAndNotify(email, name, couponCode) {
  try {
    // Add to purchases collection
    await db.collection('purchases').add({
      email: email.toLowerCase(),
      name: name || '',
      couponCode: couponCode || null,
      purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send notification email
    const transporter = getEmailTransporter();
    if (transporter) {
      const from = functions.config().email?.user || 'contato@mymoneywise.web.app';
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Luz Verde! Seu acesso ao Moneywise foi liberado 🟢',
        html: accessGrantedTemplate(name || 'Cliente'),
      });
      console.log(`Access granted email sent to ${email}`);
    }
  } catch (error) {
    console.error('Error granting access:', error);
  }
}

/**
 * Webhook to receive Mercado Pago payment notifications
 */
exports.mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
  try {
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

      // If status is approved, create a record of the purchase and send notifications
      if (paymentData.status === 'approved') {
        await db.collection('purchases').add({
          email: email,
          name: name,
          paymentId: paymentId,
          amount: paymentData.transaction_amount,
          couponCode: externalRef.couponCode || null,
          status: 'approved',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send email notification to admin
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
              usedCount: admin.firestore.FieldValue.increment(1),
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

/**
 * Scheduled function to send email bill reminders
 * Runs daily at 9 AM Brazil time
 */
exports.scheduledBillReminders = functions
  .runWith({ secrets: [emailUserSecret, emailPasswordSecret] })
  .pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    try {
      console.log('Starting scheduled email bill reminders...');

      const user = emailUserSecret.value();
      const pass = emailPasswordSecret.value();
      if (!user || !pass) {
        console.log('Email secrets not set - aborting reminders');
        return null;
      }

      const now = new Date();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const billsSnap = await db.collection('bills')
        .where('status', '==', 'pending')
        .get();

      const byUser = new Map();
      for (const doc of billsSnap.docs) {
        const data = doc.data();
        if (!data.userId || !data.dueDate) continue;

        const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);

        // Ignore ghost bills older than 30 days — these are likely stale data
        if (due < thirtyDaysAgo) continue;

        // Categorize
        let category = '';
        if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          category = 'overdue';
        } else if (due <= endOfToday) {
          category = 'dueToday';
        } else if (due <= nextWeek) {
          category = 'upcoming';
        } else {
          continue; // Too far in the future
        }

        if (!byUser.has(data.userId)) {
          byUser.set(data.userId, { overdue: [], dueToday: [], upcoming: [] });
        }
        byUser.get(data.userId)[category].push({ id: doc.id, ...data });
      }

      console.log(`Found ${byUser.size} user(s) with pending bills`);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });

      let totalSent = 0;
      for (const [userId, billGroups] of byUser) {
        try {
          // Skip if no overdue or due today (only upcoming doesn't trigger email daily unless we want)
          if (billGroups.overdue.length === 0 && billGroups.dueToday.length === 0) continue;

          const settingsDoc = await db.collection('settings').doc(userId).get();
          if (settingsDoc.exists && settingsDoc.data().billReminders === false) continue;

          const authUser = await admin.auth().getUser(userId);
          if (!authUser.email) continue;

          // Get name from settings if available
          const userName = settingsDoc.exists ? (settingsDoc.data().name || authUser.displayName) : authUser.displayName;

          // Normalize dueDate and daysOverdue before enrichment so template always has valid data
          const allListsBase = [billGroups.overdue, billGroups.dueToday, billGroups.upcoming];
          for (const list of allListsBase) {
            for (const bill of list) {
              const billDue = bill.dueDate.toDate ? bill.dueDate.toDate() : new Date(bill.dueDate);
              bill.dueDate = billDue.toISOString();
              if (!bill.amount) console.warn(`Bill ${bill.id} has no amount field`);
              if (billDue < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                bill.daysOverdue = Math.max(0, Math.floor((now - billDue) / (1000 * 60 * 60 * 24)));
              }
            }
          }

          // Enrich bills with card transaction totals
          try {
            // Fetch Transactions (last 45 days to cover most billing cycles)
            const transactionsSnap = await db.collection('transactions')
              .where('userId', '==', userId)
              .where('date', '>=', new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString())
              .get();
            const userTransactions = transactionsSnap.docs.map(d => d.data());

            // Fetch User Banks (to get closing dates for cards)
            const userBanksSnap = await db.collection('userBanks')
              .where('userId', '==', userId)
              .get();
            const userBanks = userBanksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const allLists = [billGroups.overdue, billGroups.dueToday, billGroups.upcoming];
            for (const list of allLists) {
              for (const bill of list) {
                const billDue = new Date(bill.dueDate); // already normalized above

                // Days overdue already set above

                // Card outcomes
                if (bill.category === 'credit_card' && bill.linkedBankId) {
                  const bank = userBanks.find(b => b.id === bill.linkedBankId);
                  if (bank && bank.hasCredit) {
                    const closingDay = bank.closingDay || 10;
                    const cycleEnd = new Date(billDue);
                    cycleEnd.setDate(closingDay);
                    // If closing day is after payment day, it likely closed in previous month
                    if (cycleEnd > billDue) cycleEnd.setMonth(cycleEnd.getMonth() - 1);
                    
                    const cycleStart = new Date(cycleEnd);
                    cycleStart.setMonth(cycleStart.getMonth() - 1);
                    cycleStart.setDate(cycleStart.getDate() + 1);

                    const cycleTxs = userTransactions.filter(tx => {
                      if (tx.cardId !== bill.linkedBankId || tx.type !== 'expense') return false;
                      const txDate = new Date(tx.date);
                      return txDate >= cycleStart && txDate <= cycleEnd;
                    });

                    bill.cardOutcomesAmount = cycleTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
                    bill.cardOutcomesCount = cycleTxs.length;
                  }
                }
              }
            }
          } catch (enrichErr) {
            console.error(`Error enriching bills for user ${userId}:`, enrichErr);
            // Continue anyway with basic bill info
          }

          await sendBillReminderEmail(transporter, user, authUser.email, userName || 'Cliente', billGroups);

          // Log reminders
          const batch = db.batch();
          const allBills = [...billGroups.overdue, ...billGroups.dueToday];
          for (const bill of allBills.slice(0, 10)) {
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
          console.error(`Error sending email reminders to user ${userId}:`, err);
        }
      }

      console.log(`Scheduled email reminders done. Sent ${totalSent} email(s).`);
      return null;
    } catch (err) {
      console.error('Error in scheduledBillReminders:', err);
      return null;
    }
  });

async function sendBillReminderEmail(transporter, from, to, name, billGroups) {
  const formatTotalCurrency = (val) => {
    const num = parseFloat(val);
    return `R$ ${(isNaN(num) ? 0 : num).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const allBills = [...billGroups.overdue, ...billGroups.dueToday, ...billGroups.upcoming];
  const grandTotal = allBills.reduce((sum, b) => {
    const amt = b.cardOutcomesAmount != null ? b.cardOutcomesAmount : (b.amount || 0);
    return sum + amt;
  }, 0);

  const subject = billGroups.overdue.length > 0
    ? `⚠️ ${billGroups.overdue.length} conta(s) atrasada(s) · ${formatTotalCurrency(grandTotal)}`
    : `📅 Vence hoje · ${formatTotalCurrency(grandTotal)}`;

  const html = billReminderTemplate(name, billGroups);

  await transporter.sendMail({ from, to, subject, html });
}
/**
 * TEMPORARY: Test function to send email templates
 * Usage: /testEmail?email=your@email.com&type=welcome|access|reminder
 */
exports.testEmail = functions
  .runWith({ secrets: [emailUserSecret, emailPasswordSecret] })
  .https.onRequest(async (req, res) => {
  const { email, type } = req.query;
  if (!email) return res.status(400).send('Missing email parameter');

  const transporter = getEmailTransporter();
  if (!transporter) return res.status(500).send('Email not configured in Firebase');

  const from = functions.config().email?.user || 'contato@mymoneywise.web.app';
  let html = '';
  let subject = '';

  try {
    if (type === 'welcome') {
      subject = 'Teste: Bem-vindo';
      html = welcomeTemplate('Usuário Teste');
    } else if (type === 'access') {
      subject = 'Teste: Luz Verde';
      html = accessGrantedTemplate('Usuário Teste');
    } else {
      subject = 'Teste: Lembrete de Contas';
      html = billReminderTemplate('Usuário Teste', {
        overdue: [{ name: 'Aluguel Atrasado', amount: 1500.00 }],
        dueToday: [{ name: 'Internet', amount: 99.90 }],
        upcoming: [{ name: 'Energia', amount: 250.00 }, { name: 'Netflix', amount: 55.90 }]
      });
    }

    await transporter.sendMail({ from, to: email, subject, html });
    res.send(`E-mail de teste do tipo "${type || 'reminder'}" enviado para ${email}`);
  } catch (error) {
    res.status(500).send('Erro ao enviar: ' + error.message);
  }
});

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

const { transferClient } = require('./transferClient');
exports.transferClient = transferClient;
exports.createDiscountCheckout = createDiscountCheckout;
