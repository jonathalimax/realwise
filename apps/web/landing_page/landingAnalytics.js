let utmParams = {};
const seenSections = new Set();
const seenScrollDepths = new Set();

function readUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get('utm_source') || 'direct',
    utm_medium: p.get('utm_medium') || undefined,
    utm_campaign: p.get('utm_campaign') || undefined,
  };
}

function gtag(...args) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

function attachScrollListener() {
  const milestones = [25, 50, 75, 100];
  function onScroll() {
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    const pct = Math.floor((scrolled / total) * 100);
    for (const m of milestones) {
      if (pct >= m && !seenScrollDepths.has(m)) {
        seenScrollDepths.add(m);
        gtag('event', 'scroll_depth', { depth: m, ...utmParams });
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
}

function attachSectionObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const name = entry.target.dataset.section;
        if (!name || seenSections.has(name)) continue;
        seenSections.add(name);
        gtag('event', 'section_viewed', { section_name: name, ...utmParams });
      }
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
}

export const landingAnalytics = {
  init(measurementId) {
    if (typeof window === 'undefined') return;
    utmParams = readUtmParams();

    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: true });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        attachScrollListener();
        attachSectionObserver();
      });
    } else {
      attachScrollListener();
      attachSectionObserver();
    }
  },

  trackCtaClicked(label, section) {
    gtag('event', 'cta_clicked', { cta_label: label, section, ...utmParams });
  },

  trackCheckoutOpened(section) {
    gtag('event', 'checkout_opened', { section, ...utmParams });
  },

  trackCheckoutClosed(reason, fieldsFilled) {
    gtag('event', 'checkout_closed', { reason, fields_filled: fieldsFilled, ...utmParams });
  },

  trackFieldFocused(fieldName) {
    gtag('event', 'checkout_field_focused', { field_name: fieldName, ...utmParams });
  },

  trackFieldCompleted(fieldName) {
    gtag('event', 'checkout_field_completed', { field_name: fieldName, ...utmParams });
  },

  trackFormSubmitted() {
    gtag('event', 'checkout_submitted', { ...utmParams });
  },

  trackFormError(errorType) {
    gtag('event', 'checkout_error', { error_type: errorType, ...utmParams });
  },

  getUtmSource() {
    return utmParams.utm_source || 'direct';
  },
};
