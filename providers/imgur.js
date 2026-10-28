(() => {
  'use strict';
  const U = typeof module !== 'undefined' && module.exports ? require('../urls.js') : globalThis.EksiInlineUrls;
  const H = typeof module !== 'undefined' && module.exports ? require('../html-fields.js') : globalThis.EksiHtmlFields;
  const api = {
    id: 'imgur', label: 'Imgur', context: 'worker',
    match(url) {
      if (!['imgur.com', 'www.imgur.com', 'm.imgur.com'].includes(url.hostname)) return null;
      const match = url.pathname.match(/^\/(?:(a|gallery)\/)?([a-z0-9]{5,10})(?:\.(?:jpe?g|png|gif|webp|avif))?\/?$/i);
      if (!match) return null;
      const kind = match[1] === 'a' ? 'album' : match[1] === 'gallery' ? 'gallery' : 'viewer';
      const selected = /^[a-z0-9]{5,10}$/i.test(url.hash.slice(1)) ? url.hash.slice(1) : '';
      return { provider: 'imgur', kind, id: match[2], selected, url: `https://imgur.com/${match[1] ? match[1] + '/' : ''}${match[2]}` };
    },
    buildRequest(source) {
      if (!['viewer', 'album', 'gallery'].includes(source.kind) || !/^[a-z0-9]{5,10}$/i.test(source.id)) throw U.failure('INVALID_SOURCE', 'Invalid Imgur image');
      // The public embed has ordered JSON; the main page only exposes a cover.
      const url = `https://imgur.com/${source.kind === 'viewer' ? '' : 'a/'}${source.id}/embed?pub=true`;
      return { url, context: 'worker', fallback: source.kind === 'gallery' ? `https://imgur.com/${source.id}/embed?pub=true` : undefined };
    },
    isImageUrlAllowed(value) { return U.imageUrl(value, undefined, ['i.imgur.com']); },
    parseResponse(html, base) {
      const data = H.jsonAssignment(html, 'images');
      if (data && Array.isArray(data.images)) {
        const images = [];
        let skipped = 0;
        for (const item of data.images.slice(0, 100)) {
          if (!item || !/^[a-z0-9]{5,10}$/i.test(item.hash) || !/^\.(?:jpe?g|png|gif|webp|avif)$/i.test(item.ext)) { skipped++; continue; }
          images.push({ id: item.hash, url: `https://i.imgur.com/${item.hash}${item.ext}`, alt: typeof item.title === 'string' ? item.title.slice(0, 300) : '' });
        }
        const total = Math.max(data.images.length, Number.isSafeInteger(data.count) ? data.count : 0);
        if (!images.length) throw U.failure(skipped ? 'UNSUPPORTED_MEDIA' : 'NO_PHOTO', skipped ? 'Imgur post contains no supported photos' : 'Imgur album returned no photos');
        return { images, total, skipped, truncated: total > data.images.slice(0, 100).length };
      }
      const fields = H.tags(html);
      const single = new URL(base).pathname.match(/^\/([a-z0-9]{5,10})\/embed$/i);
      if (!single) throw U.failure('NO_PHOTO', 'Imgur album metadata unavailable');
      const image = fields.find(t => t.name === 'img' && t.attrs.id === 'image-element');
      const parsed = image && U.parseUrl(image.attrs.src, base);
      const match = parsed?.pathname.match(/^\/([a-z0-9]+)\.(jpe?g|png|gif|webp|avif)$/i);
      // Remove the embed's thumbnail suffix only when it matches the requested ID.
      if (parsed?.hostname !== 'i.imgur.com' || !match || ![single[1], single[1] + 'l'].includes(match[1])) {
        throw U.failure('NO_PHOTO', 'Imgur returned no supported photo');
      }
      return { images: [{ id: single[1], url: `https://i.imgur.com/${single[1]}.${match[2]}` }], total: 1 };
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (globalThis.EksiProviderModules ||= {}).imgur = api;
})();
