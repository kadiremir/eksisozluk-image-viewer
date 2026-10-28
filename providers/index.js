(() => {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const U = node ? require('../urls.js') : globalThis.EksiInlineUrls;
  const providers = node ? ['eksi', 'imgbb', 'imgur', 'resmim', 'direct'].map(name => require(`./${name}.js`)) :
    ['eksi', 'imgbb', 'imgur', 'resmim', 'direct'].map(name => globalThis.EksiProviderModules[name]);
  const byId = new Map(providers.map(provider => [provider.id, provider]));
  function classify(value, base) {
    const url = U.parseUrl(value, base);
    if (!url) return null;
    for (const provider of providers) { const source = provider.match(url); if (source) return source; }
    return null;
  }
  function get(id) { return byId.get(id); }
  function validateSource(source, context) {
    const provider = get(source?.provider);
    if (!source || typeof source.id !== 'string' || !provider || provider.context !== context) throw U.failure('INVALID_SOURCE', 'Unsupported image source');
    provider.buildRequest(source);
    return provider;
  }
  function normalizeResult(provider, result) {
    if (!result || !Array.isArray(result.images)) throw U.failure('NO_PHOTO', 'Viewer returned no photos');
    const seen = new Set();
    const images = result.images.slice(0, 100).flatMap(image => {
      const url = typeof image?.url === 'string' && provider.isImageUrlAllowed(image.url);
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [{ url, id: typeof image.id === 'string' ? image.id.slice(0, 100) : '', alt: typeof image.alt === 'string' ? image.alt.slice(0, 300) : '' }];
    });
    if (!images.length) throw U.failure('NO_PHOTO', 'Viewer returned no allowed photos');
    return { images, total: Math.max(images.length, Number.isSafeInteger(result.total) ? result.total : images.length),
      skipped: Number.isSafeInteger(result.skipped) ? result.skipped : 0,
      truncated: Boolean(result.truncated || result.images.length > 100) };
  }
  const api = Object.freeze({ classify, get, validateSource, normalizeResult });
  if (node) module.exports = api;
  else globalThis.EksiProviders = api;
})();
