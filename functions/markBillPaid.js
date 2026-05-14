'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Realwise</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 32px; text-align: center; max-width: 360px; width: 90%; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #10b981; margin: 0 0 8px; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 24px; }
    a { display: inline-block; padding: 12px 28px; background: #10b981; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 700; }
    .brand { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #10b981; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Realwise</div>
    <div class="icon">✅</div>
    <h1>Conta marcada como paga!</h1>
    <p>Tudo certo. Seu registro foi atualizado no Realwise.</p>
    <a href="https://realwise.com.br/login">Ver todas as contas →</a>
  </div>
</body>
</html>`;

const ALREADY_PAID_HTML = SUCCESS_HTML
  .replace('Conta marcada como paga!', 'Conta já estava paga')
  .replace('Tudo certo. Seu registro foi atualizado no Realwise.', 'Esta conta já foi marcada como paga anteriormente.');

const ERROR_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Realwise</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 32px; text-align: center; max-width: 360px; width: 90%; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #ef4444; margin: 0 0 8px; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 24px; }
    a { display: inline-block; padding: 12px 28px; background: #10b981; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 700; }
    .brand { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #10b981; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Realwise</div>
    <div class="icon">⚠️</div>
    <h1>Link expirado</h1>
    <p>Este link já expirou ou é inválido. Acesse o app para marcar a conta como paga.</p>
    <a href="https://realwise.com.br/login">Abrir o Realwise →</a>
  </div>
</body>
</html>`;

exports.markBillPaid = functions.https.onRequest(async (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.status(400).send(ERROR_HTML);
    return;
  }

  const tokenRef = db.collection('bill_action_tokens').doc(token);
  const tokenSnap = await tokenRef.get();

  if (!tokenSnap.exists) {
    res.status(404).send(ERROR_HTML);
    return;
  }

  const { billId, userId, expiresAt, used } = tokenSnap.data();

  if (used) {
    res.status(200).send(ALREADY_PAID_HTML);
    return;
  }

  if (new Date() > expiresAt.toDate()) {
    res.status(410).send(ERROR_HTML);
    return;
  }

  await db.collection('bills').doc(billId).update({
    status: 'paid',
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    paidVia: 'email_reminder',
  });

  await tokenRef.update({ used: true });

  console.log(`[markBillPaid] Bill ${billId} marked as paid by user ${userId} via email`);
  res.status(200).send(SUCCESS_HTML);
});
