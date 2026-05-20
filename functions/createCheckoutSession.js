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

      const { name, email, whatsapp, clientId, couponCode, utmSource } = req.body;

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

        const createStripeCoupon = async () => {
          const params = { id: `rw_${couponDoc.id}_${Date.now()}`, duration: 'once' };
          if (cd.discountType === 'percentage') params.percent_off = cd.discountValue;
          else { params.amount_off = cd.discountValue; params.currency = 'brl'; }
          const sc = await stripe.coupons.create(params);
          // Also create a Promotion Code so users can type it in Stripe's checkout UI (raw HTTP — SDK v22 rejects 'coupon' param)
          try {
            const axios = require('axios');
            const { URLSearchParams } = require('url');
            const p = new URLSearchParams();
            p.append('coupon', sc.id);
            p.append('code', cd.code);
            await axios.post('https://api.stripe.com/v1/promotion_codes', p, {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              auth: { username: stripeSecretKey.value(), password: '' },
            });
          } catch (e) {
            console.warn('[createCheckoutSession] promotionCode create skipped:', e.response?.data?.error?.message || e.message);
          }
          await couponDoc.ref.update({ stripeCouponId: sc.id });
          return sc.id;
        };

        let stripeCouponId = cd.stripeCouponId;
        if (!stripeCouponId) {
          stripeCouponId = await createStripeCoupon();
        } else {
          // Verify the cached Stripe coupon still exists; recreate if deleted
          try {
            await stripe.coupons.retrieve(stripeCouponId);
          } catch (e) {
            if (e.code === 'resource_missing') {
              stripeCouponId = await createStripeCoupon();
            } else {
              throw e;
            }
          }
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

        // Increment daily landing_stats checkout counter (fire-and-forget)
        const today = new Date().toISOString().slice(0, 10);
        const source = (utmSource && typeof utmSource === 'string') ? utmSource : 'direct';
        db.collection('landing_stats').doc(today).set(
          {
            checkout_started: admin.firestore.FieldValue.increment(1),
            [`sources.${source}`]: admin.firestore.FieldValue.increment(1),
          },
          { merge: true }
        ).catch(err => console.error('[createCheckoutSession] landing_stats increment failed:', err));

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
          payment_method_types: ['card', 'pix'],
          payment_method_options: {
            card: {
              installments: { enabled: true },
            },
            pix: {
              expires_after_seconds: 3600,
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
