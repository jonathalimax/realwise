const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

const db = admin.firestore();
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

/**
 * Creates a reusable standalone Stripe coupon code with usage limits and optional expiry.
 * Admin-only callable.
 *
 * Input:
 *   discountType: 'percent' | 'fixed'
 *   discountPct: number (1-100, required when type='percent')
 *   discountAmount: number (BRL, required when type='fixed')
 *   maxRedemptions: number (>= 1)
 *   code: string (optional, e.g. 'SAVE30'; auto-generated if omitted)
 *   expiresAt: number (optional Unix timestamp in seconds)
 *
 * Output:
 *   promoCodeId: string (Stripe Promotion Code ID)
 *   code: string (the coupon code)
 *   couponId: string (Stripe Coupon ID)
 *   firestoreId: string (Firestore document ID in coupons collection)
 */
exports.createStandaloneCoupon = functions
  .runWith({ secrets: [stripeSecretKey] })
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Admin check
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Not an admin');
    }

    // Input validation
    const { discountType, discountPct, discountAmount, maxRedemptions, code, expiresAt } = data;

    if (!discountType || !['percent', 'fixed'].includes(discountType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'discountType must be "percent" or "fixed"'
      );
    }

    if (discountType === 'percent') {
      if (typeof discountPct !== 'number' || discountPct < 1 || discountPct > 100) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'discountPct must be a number between 1 and 100'
        );
      }
    } else if (discountType === 'fixed') {
      if (typeof discountAmount !== 'number' || discountAmount <= 0) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'discountAmount must be a positive number (BRL)'
        );
      }
    }

    if (typeof maxRedemptions !== 'number' || maxRedemptions < 1) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'maxRedemptions must be a number >= 1'
      );
    }

    if (code !== undefined) {
      if (typeof code !== 'string' || code.length < 3 || code.length > 20) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'code must be a string between 3 and 20 characters'
        );
      }
    }

    if (expiresAt !== undefined && expiresAt !== null) {
      if (typeof expiresAt !== 'number' || expiresAt <= 0) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'expiresAt must be a positive Unix timestamp (seconds)'
        );
      }
    }

    const stripe = Stripe(stripeSecretKey.value());

    try {
      // 1. Create Stripe Coupon (the discount definition)
      const couponParams = {
        duration: 'once',
        max_redemptions: maxRedemptions,
        ...(expiresAt ? { redeem_by: expiresAt } : {}),
      };

      if (discountType === 'percent') {
        couponParams.percent_off = discountPct;
      } else {
        // Fixed amount in centavos (multiply by 100)
        couponParams.amount_off = Math.round(discountAmount * 100);
        couponParams.currency = 'brl';
      }

      const coupon = await stripe.coupons.create(couponParams);
      console.log('Created coupon:', coupon.id);

      // 2. Create Stripe Promotion Code via REST API
      const axios = require('axios');
      const URLSearchParams = require('url').URLSearchParams;

      const promoPayload = new URLSearchParams();
      promoPayload.append('coupon', coupon.id);
      promoPayload.append('max_redemptions', maxRedemptions);
      if (code) promoPayload.append('code', code.toUpperCase());
      if (expiresAt) promoPayload.append('expires_at', expiresAt);

      let promoCode;
      try {
        console.log('Creating promotion code with coupon:', coupon.id);
        const response = await axios.post('https://api.stripe.com/v1/promotion_codes', promoPayload, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: stripeSecretKey.value(),
            password: '',
          },
        });
        promoCode = response.data;
      } catch (err) {
        // Clean up the orphaned coupon if promo code creation fails
        await stripe.coupons.del(coupon.id).catch(() => {});
        console.error('Promo code error:', {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
        });
        if (err.response?.data?.error?.code === 'resource_already_exists') {
          throw new functions.https.HttpsError(
            'already-exists',
            'That coupon code already exists in Stripe'
          );
        }
        throw new functions.https.HttpsError('internal', `Failed to create promotion code: ${err.message}`);
      }

      // 3. Write to Firestore `coupons` collection
      const couponDoc = {
        code: promoCode.code,
        stripeCouponId: coupon.id,
        stripePromoCodeId: promoCode.id,
        discountType,
        ...(discountType === 'percent' && { discountPct }),
        ...(discountType === 'fixed' && { discountAmount }),
        maxRedemptions,
        expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(new Date(expiresAt * 1000)) : null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerEmail,
        active: true,
      };

      const docRef = await db.collection('coupons').add(couponDoc);

      return {
        promoCodeId: promoCode.id,
        code: promoCode.code,
        couponId: coupon.id,
        firestoreId: docRef.id,
      };
    } catch (err) {
      // If it's already a FirebaseError, re-throw it
      if (err.code && err.code.startsWith('invalid-argument') || err.code === 'unauthenticated' || err.code === 'permission-denied') {
        throw err;
      }
      console.error('createStandaloneCoupon error:', err.message, err.statusCode, err.raw);
      throw new functions.https.HttpsError('internal', `Failed to create coupon: ${err.message}`);
    }
  });
