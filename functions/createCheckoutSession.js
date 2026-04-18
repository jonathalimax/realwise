const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const Stripe = require('stripe');

const db = admin.firestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

/**
 * Creates a Stripe Checkout Session and upserts a lead in Firestore.
 *
 * POST body: { name: string, email: string, whatsapp: string }
 * Response:  { url: string }  — Stripe hosted checkout URL
 *
 * Secret required: STRIPE_SECRET_KEY
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 */
exports.createCheckoutSession = functions
  .runWith({ secrets: [stripeSecretKey] })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { name, email, whatsapp, clientId } = req.body;

      if (!name || !email || !whatsapp) {
        res.status(400).json({ error: 'name, email e whatsapp são obrigatórios.' });
        return;
      }

      const emailLower = email.toLowerCase().trim();
      const secretKey = stripeSecretKey.value();

      if (!secretKey) {
        console.error('STRIPE_SECRET_KEY secret not set');
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
          success_url: clientId
            ? `https://mymoneywise.web.app/${clientId}/purchase-success`
            : 'https://mymoneywise.web.app/purchase-success',
          cancel_url: clientId
            ? `https://mymoneywise.web.app/${clientId}/`
            : 'https://mymoneywise.web.app/',
        });

        res.json({ url: session.url });
      } catch (err) {
        console.error('Stripe createCheckoutSession error:', err);
        res.status(500).json({ error: 'Erro ao criar sessão de pagamento.' });
      }
    });
  });
