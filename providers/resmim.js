(() => {
  'use strict';
  const U = typeof module !== 'undefined' && module.exports ? require('../urls.js') : globalThis.EksiInlineUrls;
  const H = typeof module !== 'undefined' && module.exports ? require('../html-fields.js') : globalThis.EksiHtmlFields;
  const hosts = ['resmim.net', 'www.resmim.net'];
  const api = {
    id: 'resmim', label: 'Resmim', context: 'worker',
    match(url) {
      if (!hosts.includes(url.hostname)) return null;
      const id = url.pathname.match(/^\/i\/(?:[a-z0-9_%.-]+\.)?([a-z0-9]{1,32})\/?$/i);
      return id ? { provider: 'resmim', kind: 'viewer', id: id[1], url: `https://resmim.net/i/${id[1]}` } : null;
    },
    buildRequest(source) {
      if (source.kind !== 'viewer' || !/^[a-z0-9]{1,32}$/i.test(source.id)) throw U.failure('INVALID_SOURCE', 'Invalid Resmim image');
      return {
        url: `https://resmim.net/i/${source.id}`, context: 'worker',
        // Short share links redirect to /i/FILENAME.ID before returning HTML.
        // Accept only this image's viewer on the original HTTPS origin.
        allowResponseUrl(value) {
          const url = U.parseUrl(value);
          return url?.origin === 'https://resmim.net' && !url.search && !url.hash &&
            api.match(url)?.id === source.id;
        }
      };
    },
    isImageUrlAllowed(value) { return U.imageUrl(value, undefined, hosts, /^\/cdn\/.+\.(?:jpe?g|png|gif|webp|avif)$/i); },
    parseResponse(html, base) {
      const fields = H.tags(html);
      const candidates = fields.filter(t => t.name === 'a' && 'download' in t.attrs).map(t => t.attrs.href)
        .concat(fields.filter(t => t.name === 'link' && t.attrs.rel === 'image_src').map(t => t.attrs.href), H.metadata(fields, 'og:image'));
      const url = candidates.map(value => { const absolute = U.parseUrl(value, base); return absolute && api.isImageUrlAllowed(absolute.href); }).find(Boolean);
      if (!url) throw U.failure('NO_PHOTO', 'Resmim viewer returned no photo');
      return { images: [{ url }], total: 1 };
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (globalThis.EksiProviderModules ||= {}).resmim = api;
})();
