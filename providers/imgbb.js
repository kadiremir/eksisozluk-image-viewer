(() => {
  'use strict';
  const U = typeof module !== 'undefined' && module.exports ? require('../urls.js') : globalThis.EksiInlineUrls;
  const H = typeof module !== 'undefined' && module.exports ? require('../html-fields.js') : globalThis.EksiHtmlFields;
  const hosts = ['i.ibb.co'];
  const api = {
    id: 'imgbb', label: 'ImgBB', context: 'worker',
    match(url) {
      if (!['ibb.co', 'www.ibb.co'].includes(url.hostname)) return null;
      const id = url.pathname.match(/^\/([a-z0-9]{1,32})\/?$/i);
      return id ? { provider: 'imgbb', kind: 'viewer', id: id[1], url: `https://ibb.co/${id[1]}` } : null;
    },
    buildRequest(source) {
      if (source.kind !== 'viewer' || !/^[a-z0-9]{1,32}$/i.test(source.id)) throw U.failure('INVALID_SOURCE', 'Invalid ImgBB image');
      return { url: `https://ibb.co/${source.id}`, context: 'worker' };
    },
    isImageUrlAllowed(value) { return U.imageUrl(value, undefined, hosts); },
    parseResponse(html, base) {
      const fields = H.tags(html);
      // The viewer img may be a smaller copy; prefer the original download.
      const candidates = fields.filter(t => t.name === 'a' && 'download' in t.attrs).map(t => t.attrs.href)
        .concat(fields.filter(t => t.name === 'link' && t.attrs.rel === 'image_src').map(t => t.attrs.href), H.metadata(fields, 'og:image'));
      const url = candidates.map(value => U.imageUrl(value, base, hosts)).find(Boolean);
      if (!url) throw U.failure('NO_PHOTO', 'ImgBB viewer returned no photo');
      return { images: [{ url }], total: 1 };
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (globalThis.EksiProviderModules ||= {}).imgbb = api;
})();
