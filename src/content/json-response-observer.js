(function installPgyJsonResponseObserver() {
  'use strict';

  if (window.__PGY_CART_JSON_RESPONSE_OBSERVER__) return;
  const subscribers = new Set();
  const notify = (payload, sourceUrl) => {
    for (const subscriber of subscribers) {
      try { subscriber(payload, sourceUrl || ''); } catch { /* A parser must not affect the page response. */ }
    }
  };
  window.__PGY_CART_JSON_RESPONSE_OBSERVER__ = {
    subscribe(subscriber) {
      if (typeof subscriber !== 'function') return () => {};
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    }
  };

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = function pgyCartFetch(...args) {
      return originalFetch.apply(this, args).then(response => {
        try {
          const contentType = response.headers && response.headers.get ? response.headers.get('content-type') || '' : '';
          if (!contentType || /json/i.test(contentType)) {
            response.clone().json().then(payload => notify(payload, response.url || String(args[0] || ''))).catch(() => {});
          }
        } catch { /* Keep the original response untouched. */ }
        return response;
      });
    };
  }

  if (typeof XMLHttpRequest === 'function') {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    if (typeof originalOpen === 'function') {
      XMLHttpRequest.prototype.open = function pgyCartOpen(method, url, ...args) {
        this.__pgyCartRequestUrl = String(url || '');
        return originalOpen.call(this, method, url, ...args);
      };
    }
    XMLHttpRequest.prototype.send = function pgyCartSend(...args) {
      this.addEventListener('load', () => {
        try {
          const contentType = this.getResponseHeader('content-type') || '';
          if (contentType && !/json/i.test(contentType)) return;
          const payload = this.responseType === 'json' ? this.response : JSON.parse(this.responseText || 'null');
          notify(payload, this.responseURL || this.__pgyCartRequestUrl || '');
        } catch { /* Ignore non-JSON responses. */ }
      }, { once: true });
      return originalSend.apply(this, args);
    };
  }
})();
