const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const emailUserSecret = defineSecret('EMAIL_USER');
const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');
const emailHostSecret = defineSecret('EMAIL_HOST');
const emailPortSecret = defineSecret('EMAIL_PORT');

const APP_BASE_URL = 'https://app.realwise.com.br';

exports.sendImportIssueEmail = functions
  .runWith({
    secrets: [emailUserSecret, emailPasswordSecret, emailHostSecret, emailPortSecret],
    memory: '512MB',
  })
  .firestore.document('importIssues/{issueId}')
  .onCreate(async (snap, context) => {
    const issue = snap.data();
    const issueId = context.params.issueId;

    // Download the file from Storage
    const fileBuf = (await admin.storage().bucket().file(issue.storagePath).download())[0];

    const transporter = nodemailer.createTransport({
      host: emailHostSecret.value() || 'smtp.umbler.com',
      port: Number(emailPortSecret.value() || 587),
      secure: false,
      auth: { user: emailUserSecret.value(), pass: emailPasswordSecret.value() },
    });

    const lines = [
      `Cliente: ${issue.clientId}`,
      `Usuário: ${issue.userName || '(sem nome)'} <${issue.userEmail}>`,
      `Banco escolhido: ${issue.bankType}`,
      `Parser usado: ${issue.parserUsed}`,
      `Headers detectados: ${(issue.detectedHeaders || []).join(' | ') || '(nenhum)'}`,
      `Erro: ${issue.errorMessage || '(nenhum)'}`,
      ``,
      `Nota do usuário:`,
      issue.userNote || '(sem nota)',
      ``,
      `Abrir no admin: ${APP_BASE_URL}/admin/import-issues/${issueId}`,
    ];

    await transporter.sendMail({
      from: `"Realwise" <${emailUserSecret.value()}>`,
      to: process.env.EMAIL_IMPORT_ISSUES || process.env.EMAIL_USER,
      subject: `[Realwise] Import failed — ${issue.bankType} — ${issue.clientId}`,
      text: lines.join('\n'),
      attachments: [{ filename: issue.fileName, content: fileBuf, contentType: issue.fileMime }],
    });
  });
