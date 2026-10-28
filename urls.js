/* Common, DOM-free helpers shared by the extension and Node tests. */
(() => {
  'use strict';
  const imagePath = /\.(?:jpe?g|png|gif|webp|avif)$/i;
  function parseUrl(value, base) {
    if (typeof value !== 'string' || value.length > 4096) return null;
    try {
      const url = new URL(value, base);
      return ['http:', 'https:'].includes(url.protocol) &&
        !url.username && !url.password && !url.port ? url : null;
    } catch { return null; }
  }
  function imageUrl(value, base, hosts, path = imagePath) {
    const url = parseUrl(value, base);
    return url && url.protocol === 'https:' && hosts.includes(url.hostname) &&
      path.test(url.pathname) ? url.href : null;
  }
  function failure(code, message, status = 0) {
    return Object.assign(new Error(message), { code, status });
  }
  function previewSize(width, height) {
    if (!(width > 0 && height > 0)) throw new Error('Invalid image dimensions');
    const portrait = height > width;
    const scale = 360 / (portrait ? height : width);
    return { width: width * scale, height: height * scale, orientation: portrait ? 'portrait' : 'landscape' };
  }
  function textUrls(text) {
    const found = [];
    for (const match of text.matchAll(/https?:\/\/[^\s<>"'“”]+/gi)) {
      let value = match[0].replace(/[.,;!?]+$/, '');
      for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
        while (value.endsWith(close) && value.split(close).length > value.split(open).length) value = value.slice(0, -1);
      }
      value = value.replace(/[.,;!?]+$/, '');
      found.push({ value, start: match.index, end: match.index + value.length });
    }
    return found;
  }
  const api = Object.freeze({ parseUrl, imageUrl, imagePath, failure, previewSize, textUrls });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.EksiInlineUrls = api;
})();
