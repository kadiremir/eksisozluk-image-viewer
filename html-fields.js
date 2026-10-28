/* Read known fields as inert text; never create or execute a remote document. */
(() => {
  'use strict';
  function decode(value) {
    return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, entity => {
      const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
      if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
      const hex = entity[2].toLowerCase() === 'x';
      const code = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
    });
  }
  function tags(html) {
    const inert = html.replace(/<!--[\s\S]*?(?:-->|$)|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    return (inert.match(/<(?:a|img|meta|link|source)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) || []).map(tag => {
      const name = tag.match(/^<(\w+)/)[1].toLowerCase();
      const attrs = Object.create(null);
      for (const m of tag.slice(name.length + 1, -1).matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        const key = m[1].toLowerCase();
        if (!(key in attrs)) attrs[key] = decode(m[2] ?? m[3] ?? m[4] ?? '');
      }
      return { name, attrs };
    });
  }
  function metadata(fields, key) {
    return fields.filter(t => t.name === 'meta' && (t.attrs.property || t.attrs.name || '').toLowerCase() === key)
      .map(t => t.attrs.content).filter(Boolean);
  }
  function jsonAssignment(html, variable) {
    // Extract only a JSON object assigned to a known variable, without eval.
    const pattern = new RegExp('\\bvar\\s+' + variable + '\\s*=\\s*(\\{)', 'g');
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
      pattern.lastIndex = 0;
      const match = pattern.exec(script[1]);
      if (!match) continue;
      const start = match.index + match[0].length - 1;
      let depth = 0, quoted = false, escaped = false;
      for (let i = start; i < script[1].length; i++) {
        const c = script[1][i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') quoted = false;
        } else if (c === '"') quoted = true;
        else if (c === '{' || c === '[') depth++;
        else if ((c === '}' || c === ']') && --depth === 0) {
          try { return JSON.parse(script[1].slice(start, i + 1)); } catch { break; }
        }
      }
    }
    return null;
  }
  const api = Object.freeze({ decode, tags, metadata, jsonAssignment });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.EksiHtmlFields = api;
})();
