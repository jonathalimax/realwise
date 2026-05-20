const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

const db = admin.firestore();
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

/**
 * Creates (or recreates) a Stripe Coupon + Promotion Code for a Firestore coupon doc.
 * Called by the admin UI after creating or editing a coupon.
 *
 * Input: { couponId: string } — Firestore document ID in `coupons` collection
 * Output: { stripeCouponId, stripePromoCodeId }
 */
exports.syncCouponToStripe = functions
  .runWith({ secrets: [stripeSecretKey] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Not an admin');
    }

    const { couponId } = data;
    if (!couponId) {
      throw new functions.https.HttpsError('invalid-argument', 'couponId is required');
    }

    const snap = await db.collection('coupons').doc(couponId).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Coupon not found');
    }

    const cd = snap.data();
    const stripe = Stripe(stripeSecretKey.value());

    // If a Stripe coupon already exists, verify it's still alive
    if (cd.stripeCouponId) {
      try {
        await stripe.coupons.retrieve(cd.stripeCouponId);
        // Still valid — ensure promotion code exists too
        if (cd.stripePromoCodeId) {
          return { stripeCouponId: cd.stripeCouponId, stripePromoCodeId: cd.stripePromoCodeId };
        }
        // Coupon exists but no promotion code — create it (raw HTTP — SDK v22 rejects 'coupon' param)
        let promoId = null;
        try {
          const axios = require('axios');
          const { URLSearchParams } = require('url');
          const p = new URLSearchParams();
          p.append('coupon', cd.stripeCouponId);
          p.append('code', cd.code);
          const r = await axios.post('https://api.stripe.com/v1/promotion_codes', p, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: { username: stripeSecretKey.value(), password: '' },
          });
          promoId = r.data.id;
        } catch (e) {
          console.warn('[syncCouponToStripe] promotionCode create skipped:', e.response?.data?.error?.message || e.message);
        }
        await snap.ref.update({ stripePromoCodeId: promoId });
        return { stripeCouponId: cd.stripeCouponId, stripePromoCodeId: promoId };
      } catch (e) {
        if (e.code !== 'resource_missing') throw e;
        // Stripe coupon was deleted — fall through to recreate
      }
    }

    // Create Stripe Coupon
    const couponParams = { id: `rw_${snap.id}_${Date.now()}`, duration: 'once' };
    if (cd.discountType === 'percentage') {
      couponParams.percent_off = cd.discountValue;
    } else {
      couponParams.amount_off = cd.discountValue;
      couponParams.currency = 'brl';
    }
    if (cd.maxUses) couponParams.max_redemptions = cd.maxUses;
    if (cd.validUntil) couponParams.redeem_by = Math.floor(cd.validUntil.toDate().getTime() / 1000);

    const stripeCoupon = await stripe.coupons.create(couponParams);

    // Create Stripe Promotion Code with the human-readable code (raw HTTP — SDK v22 rejects 'coupon' param)
    let stripePromoCodeId = null;
    try {
      const axios = require('axios');
      const { URLSearchParams } = require('url');
      const promoPayload = new URLSearchParams();
      promoPayload.append('coupon', stripeCoupon.id);
      promoPayload.append('code', cd.code);
      if (cd.maxUses) promoPayload.append('max_redemptions', cd.maxUses);
      const promoRes = await axios.post('https://api.stripe.com/v1/promotion_codes', promoPayload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: stripeSecretKey.value(), password: '' },
      });
      stripePromoCodeId = promoRes.data.id;
    } catch (e) {
      console.warn('[syncCouponToStripe] promotionCode create skipped:', e.response?.data?.error?.message || e.message);
    }

    await snap.ref.update({ stripeCouponId: stripeCoupon.id, stripePromoCodeId });
    return { stripeCouponId: stripeCoupon.id, stripePromoCodeId };
  });
