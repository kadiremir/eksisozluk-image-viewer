(() => {
  'use strict';
  const U = typeof module !== 'undefined' && module.exports ? require('../urls.js') : globalThis.EksiInlineUrls;
  const api = {
    id: 'direct', label: 'Image', context: 'image',
    match(url) { return url.protocol === 'https:' && U.imagePath.test(url.pathname) ? { provider: 'direct', kind: 'direct', url: url.href } : null; },
    isImageUrlAllowed(value) { const url = U.parseUrl(value); return url?.protocol === 'https:' && U.imagePath.test(url.pathname) ? url.href : null; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (globalThis.EksiProviderModules ||= {}).direct = api;
})();
