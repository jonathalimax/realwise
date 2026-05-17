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

      const { name, email, whatsapp, clientId, couponCode } = req.body;

      if (!email) {
        res.status(400).json({ error: 'email é obrigatório.' });
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

      // Validate coupon if provided
      let stripeDiscounts = [];
      if (couponCode) {
        const snap = await admin.firestore().collection('coupons')
          .where('code', '==', couponCode.toUpperCase())
          .limit(1)
          .get();

        if (snap.empty) {
          res.status(400).json({ error: 'Cupom não encontrado.' });
          return;
        }

        const couponDoc = snap.docs[0];
        const cd = couponDoc.data();
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

        let stripeCouponId = cd.stripeCouponId;
        if (!stripeCouponId) {
          const params = { id: `rw_${couponDoc.id}`, duration: 'once' };
          if (cd.discountType === 'percentage') params.percent_off = cd.discountValue;
          else { params.amount_off = cd.discountValue; params.currency = 'brl'; }
          const sc = await stripe.coupons.create(params);
          stripeCouponId = sc.id;
          await couponDoc.ref.update({ stripeCouponId });
        }
        stripeDiscounts = [{ coupon: stripeCouponId }];
      }

      try {
        // Upsert lead before hitting Stripe — captures abandons if they never complete payment
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

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: emailLower,
          // allow_promotion_codes and discounts are mutually exclusive in Stripe
          ...(stripeDiscounts.length > 0
            ? { discounts: stripeDiscounts }
            : { allow_promotion_codes: true }),
          line_items: [
            {
              price_data: {
                currency: 'brl',
                unit_amount: 47988, // R$479,88 in centavos
                product_data: {
                  name: 'Realwise — Acesso Vitalício',
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
            name: name ? name.trim() : '',
            whatsapp: whatsapp ? whatsapp.trim() : '',
            email: emailLower,
            couponCode: couponCode || '',
          },
          success_url: clientId && clientId !== 'app'
            ? `https://${clientId}.realwise.com.br/purchase-success`
            : 'https://realwise.com.br/purchase-success',
          cancel_url: clientId && clientId !== 'app'
            ? `https://${clientId}.realwise.com.br/`
            : 'https://realwise.com.br/',
        });

        res.json({ url: session.url });
      } catch (err) {
        console.error('Stripe createCheckoutSession error:', err);
        res.status(500).json({ error: 'Erro ao criar sessão de pagamento.' });
      }
    });
  });
