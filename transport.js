(() => {
  'use strict';
  const U = typeof module !== 'undefined' && module.exports ? require('./urls.js') : globalThis.EksiInlineUrls;
  const MAX_BYTES = 2 * 1024 * 1024;
  async function fetchHtml(url, options = {}, fetchImpl = globalThis.fetch, allowResponseUrl) {
    let response;
    try {
      response = await fetchImpl(url, { credentials: 'omit', referrerPolicy: 'no-referrer',
        ...options, redirect: allowResponseUrl ? 'follow' : 'error', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw U.failure('HTTP', `Viewer HTTP ${response.status}`, response.status);
      const acceptedUrl = allowResponseUrl ? allowResponseUrl(response.url || url) :
        !response.redirected && (!response.url || new URL(response.url).origin === new URL(url).origin);
      if (!acceptedUrl) {
        throw U.failure('REDIRECT', 'Unexpected viewer redirect');
      }
      if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') || '')) {
        throw U.failure('CONTENT_TYPE', 'Viewer did not return HTML');
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw U.failure('TOO_LARGE', 'Viewer response too large');
      const reader = response.body?.getReader();
      if (!reader) throw U.failure('EMPTY_RESPONSE', 'Empty viewer response');
      const decoder = new TextDecoder();
      let bytes = 0, text = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) throw U.failure('TOO_LARGE', 'Viewer response too large');
          text += decoder.decode(value, { stream: true });
        }
        return text + decoder.decode();
      } finally { await reader.cancel().catch(() => {}); }
    } catch (error) {
      // Cancel unread bodies on header/status failures too.
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
      if (['TimeoutError', 'AbortError'].includes(error?.name)) throw U.failure('TIMEOUT', 'Viewer timeout');
      throw error;
    }
  }
  function memoizeAsync(loader, { limit = 256, ttl = 600000, now = Date.now } = {}) {
    const cache = new Map();
    return function cached(key, value) {
      const previous = cache.get(key);
      if (previous && previous.expires > now()) return previous.pending;
      cache.delete(key);
      while (cache.size >= limit) cache.delete(cache.keys().next().value);
      const record = { expires: now() + ttl };
      record.pending = Promise.resolve().then(() => loader(value)).catch(error => {
        if (cache.get(key) === record) cache.delete(key);
        throw error;
      });
      cache.set(key, record);
      return record.pending;
    };
  }
  const api = Object.freeze({ MAX_BYTES, fetchHtml, memoizeAsync });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.EksiTransport = api;
})();
