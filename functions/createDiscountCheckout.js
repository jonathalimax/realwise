// functions/createDiscountCheckout.js
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const db = admin.firestore();

exports.createDiscountCheckout = functions
  .runWith({ secrets: [stripeSecretKey] })
  .https.onCall(async (data, context) => {
    const { email, discountPct } = data;

    if (!email || typeof discountPct !== 'number' || discountPct <= 0 || discountPct > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'email and discountPct (1-100) required');
    }

    const secretKey = stripeSecretKey.value();
    if (!secretKey) throw new functions.https.HttpsError('internal', 'Stripe not configured');

    const stripe = Stripe(secretKey);
    const emailLower = email.toLowerCase().trim();

    // One-time coupon locked to this email via metadata (Stripe doesn't enforce email, but we track it)
    const coupon = await stripe.coupons.create({
      percent_off: discountPct,
      duration: 'once',
      max_redemptions: 1,
      metadata: { email: emailLower },
    });

    // Upsert lead so they exist in Firestore
    await db.collection('leads').doc(emailLower).set(
      { email: emailLower, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: emailLower,
      discounts: [{ coupon: coupon.id }],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: 47988,
            product_data: {
              name: 'Moneywise — Acesso Vitalício',
              description: 'Acesso completo, suporte vitalício, sem mensalidade.',
            },
          },
          quantity: 1,
        },
      ],
      payment_method_types: ['card'],
      payment_method_options: { card: { installments: { enabled: true } } },
      metadata: { email: emailLower, discountPct: String(discountPct), couponId: coupon.id },
      success_url: 'https://mymoneywise.web.app/purchase-success',
      cancel_url: 'https://mymoneywise.web.app/',
    });

    return { url: session.url, couponId: coupon.id };
  });
