// functions/sendAdminEmail.js
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const {
  welcomeTemplate,
  accessGrantedTemplate,
  acceptMigrationTemplate,
} = require('./emailTemplates');

const emailUserSecret = defineSecret('EMAIL_USER');
const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');

const db = admin.firestore();

const TEMPLATE_MAP = {
  welcome: (fields) => ({
    subject: 'Bem-vindo ao Moneywise!',
    html: welcomeTemplate(fields.name || 'Cliente'),
  }),
  access_granted: (fields) => ({
    subject: 'Luz Verde! Seu acesso foi liberado 🟢',
    html: accessGrantedTemplate(fields.name || 'Cliente', fields.loginUrl),
  }),
  accept_migration: (fields) => ({
    subject: 'Ação necessária: Aceite sua migração de conta',
    html: acceptMigrationTemplate(fields.name || 'Cliente', fields.migrationUrl),
  }),
};

exports.sendAdminEmail = functions
  .runWith({ secrets: [emailUserSecret, emailPasswordSecret] })
  .https.onCall(async (data, context) => {
    // Auth + admin check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Not an admin');
    }

    const { to, template, fields = {} } = data;
    if (!to || !template) {
      throw new functions.https.HttpsError('invalid-argument', 'to and template are required');
    }

    const templateFn = TEMPLATE_MAP[template];
    if (!templateFn) {
      throw new functions.https.HttpsError('invalid-argument', `Unknown template: ${template}`);
    }

    const emailUser = emailUserSecret.value();
    const emailPass = emailPasswordSecret.value();
    if (!emailUser || !emailPass) {
      throw new functions.https.HttpsError('internal', 'Email secrets not configured');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    });

    const { subject, html } = templateFn(fields);

    await transporter.sendMail({
      from: emailUser,
      to,
      subject,
      html,
    });

    // Audit log
    await db.collection('admin_email_logs').add({
      sentBy: callerEmail,
      to,
      template,
      fields,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });
