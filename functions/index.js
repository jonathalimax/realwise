const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const cors = require('cors')({ origin: true });
const nodemailer = require('nodemailer');
const axios = require('axios');
const whatsappService = require('./whatsapp-service');

admin.initializeApp();

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
  const email = functions.config().email?.user;
  const password = functions.config().email?.password;

  if (!email || !password) {
    console.log('Email not configured - skipping email notification');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password, // Use App Password, not regular password
    },
  });
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
    from: functions.config().email?.user || 'noreply@limasfinance.com',
    to: adminEmail,
    subject: `💰 Nova Compra - Limas Finance - R$ ${purchaseData.amount.toFixed(2)}`,
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
          Limas Finance - Sistema de Finanças Pessoais
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
 * Create a payment preference for PIX checkout
 * Called from the frontend to get a checkout URL
 */
exports.createPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { email, name, price, couponCode } = req.body;

      if (!email || !price) {
        res.status(400).json({ error: 'Email and price are required' });
        return;
      }

      const client = getMercadoPagoClient();
      const preference = new Preference(client);

      // Get the base URL for redirects
      const baseUrl = functions.config().app?.url || 'https://limasfinance.web.app';

      const preferenceData = {
        items: [
          {
            id: 'limas-finance-lifetime',
            title: 'Limas Finance - Acesso Vitalício',
            description: 'Acesso completo ao sistema de finanças pessoais',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: parseFloat(price),
          },
        ],
        payer: {
          email: email,
          name: name || '',
        },
        payment_methods: {
          // Only allow PIX
          excluded_payment_types: [
            { id: 'credit_card' },
            { id: 'debit_card' },
            { id: 'ticket' },
            { id: 'atm' },
          ],
          installments: 1,
        },
        back_urls: {
          success: `${baseUrl}/purchase/success`,
          failure: `${baseUrl}/purchase/failure`,
          pending: `${baseUrl}/purchase/pending`,
        },
        auto_return: 'approved',
        external_reference: JSON.stringify({
          email: email.toLowerCase(),
          name: name || '',
          couponCode: couponCode || null,
          timestamp: Date.now(),
        }),
        notification_url: `${baseUrl}/api/webhook/mercadopago`,
        statement_descriptor: 'LIMAS FINANCE',
      };

      const response = await preference.create({ body: preferenceData });

      // Save pending payment to Firestore
      await db.collection('pending_payments').add({
        email: email.toLowerCase(),
        name: name || '',
        price: parseFloat(price),
        couponCode: couponCode || null,
        preferenceId: response.id,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({
        id: response.id,
        init_point: response.init_point,
        sandbox_init_point: response.sandbox_init_point,
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

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
 * WhatsApp Cloud API Webhook
 * Handles webhook verification and incoming messages from WhatsApp
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  try {
    // Webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const config = whatsappService.getWhatsAppConfig();

      if (mode === 'subscribe' && token === config.verifyToken) {
        console.log('Webhook verified successfully');
        res.status(200).send(challenge);
        return;
      } else {
        console.log('Webhook verification failed');
        res.status(403).send('Forbidden');
        return;
      }
    }

    // Handle incoming messages (POST request from Meta)
    if (req.method === 'POST') {
      const body = req.body;

      // Check if it's a WhatsApp message notification
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // Handle incoming messages
        if (value?.messages && value.messages.length > 0) {
          const message = value.messages[0];
          const from = message.from; // Sender's phone number
          const messageId = message.id;
          const messageType = message.type;

          console.log('Received WhatsApp message:', {
            from,
            messageId,
            type: messageType,
          });

          // Mark message as read
          await whatsappService.markMessageAsRead(messageId);

          // Handle text messages
          if (messageType === 'text') {
            const text = message.text.body.trim().toUpperCase();
            await handleIncomingMessage(from, text, messageId);
          }

          // Handle button replies
          if (messageType === 'interactive') {
            const buttonReply = message.interactive?.button_reply;
            if (buttonReply) {
              const buttonId = buttonReply.id;
              await handleButtonReply(from, buttonId);
            }
          }
        }

        res.status(200).send('OK');
        return;
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Handle incoming text messages from WhatsApp
 */
async function handleIncomingMessage(from, text, messageId) {
  try {
    const phoneNumber = whatsappService.formatPhoneNumber(from);

    // Find user by phone number
    const userQuery = await db.collection('users')
      .where('phoneNumber', '==', `+${phoneNumber}`)
      .limit(1)
      .get();

    if (userQuery.empty) {
      // User not found - send help message
      await whatsappService.sendTextMessage(from,
        '👋 Olá! Para usar este serviço, primeiro configure seu número no app Limas Finance.\n\n🔗 https://limas-finance.web.app'
      );
      return;
    }

    const userId = userQuery.docs[0].id;

    // Handle different commands
    if (text.includes('PAGO') || text === '1') {
      await handleMarkAsPaid(from, userId);
    } else if (text.includes('ADIAR') || text === '2') {
      await handlePostpone(from, userId);
    } else if (text.includes('VER') || text === '3') {
      await whatsappService.sendTextMessage(from,
        '🔗 Acesse seu painel: https://limas-finance.web.app'
      );
    } else if (text.includes('AJUDA') || text.includes('HELP')) {
      await whatsappService.sendTextMessage(from,
        `📱 *Comandos disponíveis:*

*PAGO* ou *1* - Marcar conta como paga
*ADIAR* ou *2* - Adiar lembrete por 2 horas
*VER* ou *3* - Ver site

🔗 https://limas-finance.web.app`
      );
    } else {
      // Unknown command
      await whatsappService.sendTextMessage(from,
        '❓ Comando não reconhecido.\n\nEnvie *AJUDA* para ver os comandos disponíveis.'
      );
    }
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
}

/**
 * Handle button replies from interactive messages
 */
async function handleButtonReply(from, buttonId) {
  try {
    const phoneNumber = whatsappService.formatPhoneNumber(from);

    const userQuery = await db.collection('users')
      .where('phoneNumber', '==', `+${phoneNumber}`)
      .limit(1)
      .get();

    if (userQuery.empty) return;

    const userId = userQuery.docs[0].id;

    if (buttonId.includes('paid')) {
      await handleMarkAsPaid(from, userId);
    } else if (buttonId.includes('postpone')) {
      await handlePostpone(from, userId);
    } else if (buttonId.includes('view')) {
      await whatsappService.sendTextMessage(from,
        '🔗 Acesse: https://limas-finance.web.app'
      );
    }
  } catch (error) {
    console.error('Error handling button reply:', error);
  }
}

/**
 * Mark the most recent unpaid bill as paid
 */
async function handleMarkAsPaid(phoneNumber, userId) {
  try {
    // Get the most recent unpaid bill
    const billsQuery = await db.collection(`users/${userId}/bills`)
      .where('status', '==', 'pending')
      .orderBy('dueDate', 'asc')
      .limit(1)
      .get();

    if (billsQuery.empty) {
      await whatsappService.sendTextMessage(phoneNumber,
        '✅ Você não tem contas pendentes no momento!'
      );
      return;
    }

    const billDoc = billsQuery.docs[0];
    const billData = billDoc.data();

    // Update bill status to paid
    await billDoc.ref.update({
      status: 'paid',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      paidVia: 'whatsapp',
    });

    await whatsappService.sendTextMessage(phoneNumber,
      `✅ *Conta marcada como paga!*

📋 ${billData.description}
💰 R$ ${billData.value.toFixed(2)}

🎉 Parabéns por manter suas finanças em dia!`
    );
  } catch (error) {
    console.error('Error marking bill as paid:', error);
    await whatsappService.sendTextMessage(phoneNumber,
      '❌ Erro ao marcar conta como paga. Tente novamente.'
    );
  }
}

/**
 * Postpone reminder for 2 hours
 */
async function handlePostpone(phoneNumber, userId) {
  try {
    // Store postponement in Firestore
    await db.collection(`users/${userId}/postponed_reminders`).add({
      phoneNumber: phoneNumber,
      postponedAt: admin.firestore.FieldValue.serverTimestamp(),
      postponedUntil: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
      ),
    });

    await whatsappService.sendTextMessage(phoneNumber,
      '⏰ Lembrete adiado por 2 horas.\n\nVocê receberá uma nova notificação em breve.'
    );
  } catch (error) {
    console.error('Error postponing reminder:', error);
    await whatsappService.sendTextMessage(phoneNumber,
      '❌ Erro ao adiar lembrete. Tente novamente.'
    );
  }
}

/**
 * Scheduled function to send WhatsApp bill reminders
 * Runs daily at 9 AM Brazil time
 */
exports.scheduledBillReminders = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    try {
      console.log('Starting scheduled bill reminders...');

      const targetPhone = '+5585992265544';
      const remindersSent = await sendBillReminders(targetPhone);

      console.log(`Scheduled reminders completed. Sent ${remindersSent} reminder(s).`);
      return null;
    } catch (error) {
      console.error('Error in scheduled reminders:', error);
      return null;
    }
  });

/**
 * Send bill reminders to a specific phone number
 */
async function sendBillReminders(phoneNumber) {
  try {
    const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber);

    // Find user by phone number
    const userQuery = await db.collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();

    if (userQuery.empty) {
      console.log('No user found with phone number:', phoneNumber);
      return 0;
    }

    const userId = userQuery.docs[0].id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Get bills that are due today or overdue
    const billsQuery = await db.collection(`users/${userId}/bills`)
      .where('status', '==', 'pending')
      .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(endOfToday))
      .orderBy('dueDate', 'asc')
      .limit(5) // Limit to 5 reminders per day
      .get();

    if (billsQuery.empty) {
      console.log('No pending bills found for user:', userId);
      return 0;
    }

    let remindersSent = 0;

    // Send reminder for each bill
    for (const billDoc of billsQuery.docs) {
      const billData = billDoc.data();
      const message = whatsappService.formatBillReminderMessage(billData, phoneNumber);

      try {
        await whatsappService.sendTextMessage(phoneNumber, message);
        remindersSent++;

        // Log the reminder in Firestore
        await db.collection(`users/${userId}/reminder_logs`).add({
          billId: billDoc.id,
          billDescription: billData.description,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          sentVia: 'whatsapp',
          phoneNumber: phoneNumber,
        });

        // Wait 2 seconds between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error sending reminder for bill:', billDoc.id, error);
      }
    }

    return remindersSent;
  } catch (error) {
    console.error('Error sending bill reminders:', error);
    throw error;
  }
}

/**
 * Manual trigger for WhatsApp reminders (for testing)
 * Usage: Call this function via HTTP to test WhatsApp integration
 */
exports.sendWhatsAppReminder = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { phoneNumber } = req.body || {};
      const targetPhone = phoneNumber || '+5585992265544';

      console.log('Manual WhatsApp reminder triggered for:', targetPhone);

      const remindersSent = await sendBillReminders(targetPhone);

      res.json({
        success: true,
        message: `Sent ${remindersSent} reminder(s) to ${targetPhone}`,
        remindersSent,
      });
    } catch (error) {
      console.error('Error in manual reminder trigger:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
});

/**
 * Test WhatsApp connection
 * Sends a simple test message to verify API configuration
 */
exports.testWhatsApp = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { phoneNumber, message } = req.body || {};
      const targetPhone = phoneNumber || '+5585992265544';
      const testMessage = message || '👋 Teste de conexão WhatsApp Cloud API - Limas Finance';

      const result = await whatsappService.sendTextMessage(targetPhone, testMessage);

      res.json({
        success: true,
        message: 'WhatsApp test message sent successfully',
        messageId: result.messages?.[0]?.id,
        to: targetPhone,
      });
    } catch (error) {
      console.error('WhatsApp test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data,
      });
    }
  });
});
