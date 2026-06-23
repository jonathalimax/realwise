const pushDataLayerEvent = (eventName, params = {}) => {
  if (typeof window === 'undefined') return;

  if (window.dataLayer && Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};

export const analytics = {
  pageView(pageName) {
    pushDataLayerEvent('page_view', { page: pageName });
  },

  purchaseStart(amount, couponCode = null, contribution = 0) {
    pushDataLayerEvent('purchase_start', {
      amount,
      coupon_code: couponCode,
      contribution,
    });
  },

  purchaseComplete(amount, couponCode = null, contribution = 0) {
    pushDataLayerEvent('purchase_complete', {
      amount,
      coupon_code: couponCode,
      contribution,
    });
  },
};

