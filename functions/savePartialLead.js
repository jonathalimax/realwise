const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

const PROTECTED_STATES = ['checkout_started', 'not_paid', 'paid', 'active', 'cancelled', 'refunded'];

exports.savePartialLead = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { email, name, whatsapp, utmSource } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email required' });
      return;
    }

    const emailLower = email.toLowerCase().trim();
    const today = new Date().toISOString().slice(0, 10);
    const source = (utmSource && typeof utmSource === 'string') ? utmSource : 'direct';

    try {
      const leadRef = db.collection('leads').doc(emailLower);
      const snap = await leadRef.get();
      const existing = snap.data();

      if (existing && PROTECTED_STATES.includes(existing.state)) {
        if (whatsapp && !existing.whatsapp) {
          await leadRef.update({ whatsapp: whatsapp.trim(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        res.status(200).json({ status: 'existing' });
        return;
      }

      await leadRef.set(
        {
          email: emailLower,
          ...(name ? { name: name.trim() } : {}),
          ...(whatsapp ? { whatsapp: whatsapp.trim() } : {}),
          state: 'form_partial',
          source,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(!snap.exists && { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );

      // Increment daily landing_stats (fire-and-forget — never block the response)
      db.collection('landing_stats').doc(today).set(
        {
          partial_leads: admin.firestore.FieldValue.increment(1),
          [`sources.${source}`]: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      ).catch(err => console.error('[savePartialLead] landing_stats increment failed:', err));

      res.status(200).json({ status: 'saved' });
    } catch (err) {
      console.error('[savePartialLead]', err);
      res.status(500).json({ error: 'internal' });
    }
  });
});
