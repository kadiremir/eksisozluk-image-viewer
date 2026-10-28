(() => {
  'use strict';
  const U = typeof module !== 'undefined' && module.exports ? require('../urls.js') : globalThis.EksiInlineUrls;
  const H = typeof module !== 'undefined' && module.exports ? require('../html-fields.js') : globalThis.EksiHtmlFields;
  const api = {
    id: 'eksi', label: 'Ekşi', context: 'page',
    match(url) {
      const short = ['soz.lk', 'www.soz.lk'].includes(url.hostname);
      if (!short && !['eksisozluk.com', 'www.eksisozluk.com'].includes(url.hostname)) return null;
      const id = url.pathname.match(short ? /^\/i\/([a-z0-9_-]+)\/?$/i : /^\/img\/([a-z0-9_-]+)\/?$/i);
      return id ? { provider: 'eksi', kind: 'viewer', id: id[1], url: `https://eksisozluk.com/img/${id[1]}` } : null;
    },
    buildRequest(source) {
      if (source.kind !== 'viewer' || !/^[a-z0-9_-]{1,150}$/i.test(source.id)) throw U.failure('INVALID_SOURCE', 'Invalid Ekşi image');
      return { url: `https://eksisozluk.com/img/${source.id}`, context: 'page' };
    },
    isImageUrlAllowed(value) { return U.imageUrl(value, undefined, ['cdn.eksisozluk.com'], /^\//); },
    parseResponse(html, base) {
      const fields = H.tags(html);
      const candidates = fields.filter(t => (t.name === 'a' && t.attrs.id === 'image-zoom') || (t.name === 'img' && t.attrs.id === 'image'))
        .map(t => t.attrs.href || t.attrs.src).concat(H.metadata(fields, 'og:image'));
      const url = candidates.map(value => U.imageUrl(value, base, ['cdn.eksisozluk.com'], /^\//)).find(Boolean);
      if (!url) throw U.failure('NO_PHOTO', 'Ekşi viewer returned no photo');
      return { images: [{ url }], total: 1 };
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (globalThis.EksiProviderModules ||= {}).eksi = api;
})();
