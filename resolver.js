/* Shared worker dispatcher; no provider HTML rules belong here. */
(() => {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const U = node ? require('./urls.js') : globalThis.EksiInlineUrls;
  const P = node ? require('./providers/index.js') : globalThis.EksiProviders;
  const T = node ? require('./transport.js') : globalThis.EksiTransport;
  function createResolver(fetchImpl = globalThis.fetch) {
    const cached = T.memoizeAsync(async source => {
      const provider = P.validateSource(source, 'worker');
      const request = provider.buildRequest(source);
      async function resolve(url) {
        const html = await T.fetchHtml(url, {}, fetchImpl, request.allowResponseUrl);
        return P.normalizeResult(provider, provider.parseResponse(html, url));
      }
      try { return await resolve(request.url); }
      catch (error) {
        if (request.fallback && (error.status === 404 || error.code === 'NO_PHOTO')) return resolve(request.fallback);
        throw error;
      }
    });
    return source => {
      P.validateSource(source, 'worker');
      // IDs, not caller URLs or fragments, control requests and cache identity.
      return cached(`${source.provider}:${source.kind}:${source.id}`, {
        provider: source.provider, kind: source.kind, id: source.id
      });
    };
  }
  function validSender(sender, extensionId) {
    const url = U.parseUrl(sender?.url);
    return sender?.id === extensionId && Number.isInteger(sender?.tab?.id) && sender?.frameId === 0 &&
      url?.protocol === 'https:' && ['eksisozluk.com', 'www.eksisozluk.com'].includes(url.hostname);
  }
  function createMessageHandler(extensionId, resolve) {
    return (message, sender, reply) => {
      if (message?.type !== 'resolveExternalImage') return false;
      Promise.resolve().then(() => {
        if (!validSender(sender, extensionId)) throw U.failure('INVALID_SENDER', 'Unsupported request sender');
        return resolve(message.source);
      }).then(result => reply({ ok: true, result }), error => reply({ ok: false,
        error: { code: error.code || 'NETWORK', message: error.message || 'Viewer request failed', status: error.status || 0 } }));
      return true;
    };
  }
  const api = Object.freeze({ createResolver, validSender, createMessageHandler });
  if (node) module.exports = api;
  else globalThis.EksiResolver = api;
})();
