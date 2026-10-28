/* Entry discovery is independent of provider parsers and preview rendering. */
(() => {
  'use strict';
  const U = globalThis.EksiInlineUrls;
  const P = globalThis.EksiProviders;
  const skip = 'a, script, style, textarea, input, button, [contenteditable]:not([contenteditable="false"]), .eksi-inline-photo, .eksi-inline-source';
  function markTextUrls(content, base) {
    for (const marker of content.querySelectorAll('.eksi-inline-source')) {
      if (!P.classify(marker.textContent, base)) marker.replaceWith(document.createTextNode(marker.textContent));
    }
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const matches = U.textUrls(node.data).filter(match => P.classify(match.value, base));
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        fragment.append(document.createTextNode(node.data.slice(offset, match.start)));
        const marker = document.createElement('span');
        marker.className = 'eksi-inline-source';
        marker.textContent = node.data.slice(match.start, match.end);
        fragment.append(marker);
        offset = match.end;
      }
      fragment.append(document.createTextNode(node.data.slice(offset)));
      node.replaceWith(fragment);
    }
  }
  function sources(content, base) {
    markTextUrls(content, base);
    return [...content.querySelectorAll('a[href], .eksi-inline-source')].filter(node =>
      !node.closest('.eksi-inline-photo') && !node.querySelector('img') && !node.isContentEditable
    ).map(node => ({ node, source: P.classify(node.matches('a') ? node.getAttribute('href') : node.textContent, base) }));
  }
  function meaningfulMutation(mutation) {
    const element = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
    return !element?.closest('.eksi-inline-photo, .eksi-inline-toolbar');
  }
  globalThis.EksiScanner = Object.freeze({ sources, meaningfulMutation });
})();
