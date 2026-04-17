const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const Stripe = require('stripe');

const db = admin.firestore();

/**
 * Creates a Stripe Checkout Session and upserts a lead in Firestore.
 *
 * POST body: { name: string, email: string, whatsapp: string }
 * Response:  { url: string }  — Stripe hosted checkout URL
 *
 * Firebase config required:
 *   stripe.secret_key  — Stripe secret key (sk_live_... or sk_test_...)
 */
exports.createCheckoutSession = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { name, email, whatsapp } = req.body;

    if (!name || !email || !whatsapp) {
      res.status(400).json({ error: 'name, email e whatsapp são obrigatórios.' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    const secretKey = functions.config().stripe?.secret_key;
    if (!secretKey) {
      console.error('stripe.secret_key not configured');
      res.status(500).json({ error: 'Configuração de pagamento ausente.' });
      return;
    }

    const stripe = Stripe(secretKey);

    try {
      // Upsert lead — creates if not exists, updates if returning visitor
      await db.collection('leads').doc(emailLower).set(
        {
          name: name.trim(),
          email: emailLower,
          whatsapp: whatsapp.trim(),
          paid: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: emailLower,
        line_items: [
          {
            price_data: {
              currency: 'brl',
              unit_amount: 47988, // R$479,88 in centavos
              product_data: {
                name: 'Moneywise — Acesso Vitalício',
                description: 'Acesso completo, suporte vitalício, sem mensalidade.',
              },
            },
            quantity: 1,
          },
        ],
        payment_method_types: ['card'],
        payment_method_options: {
          card: {
            installments: { enabled: true },
          },
        },
        metadata: {
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          email: emailLower,
        },
        success_url: 'https://moneywise.web.app/purchase-success',
        cancel_url: 'https://moneywise.web.app/',
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error('Stripe createCheckoutSession error:', err);
      res.status(500).json({ error: 'Erro ao criar sessão de pagamento.' });
    }
  });
});
