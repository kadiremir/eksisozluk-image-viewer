(() => {
  'use strict';
  const U = globalThis.EksiInlineUrls;
  const P = globalThis.EksiProviders;
  const T = globalThis.EksiTransport;
  const S = globalThis.EksiScanner;
  const records = new Map();
  const pendingTargets = new Set();
  const queue = [];
  let active = 0, enabled = true, toolbar, toggle, scanTimer;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting && enabled) schedule(entry.target);
  }, { rootMargin: '350px' });

  function button(text, handler) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.addEventListener('click', handler);
    return element;
  }
  function setEnabled(value) {
    enabled = value;
    document.documentElement.classList.toggle('eksi-inline-hidden', !enabled);
    refreshToolbar();
    if (enabled) {
      for (const target of pendingTargets) {
        if (!target.isConnected) { pendingTargets.delete(target); observer.unobserve(target); continue; }
        if (target.dataset.state === 'waiting') { observer.unobserve(target); observer.observe(target); }
      }
      pump();
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message?.type === 'setInlinePhotosEnabled' && typeof message.enabled === 'boolean') {
      setEnabled(message.enabled);
    } else if (message?.type !== 'getInlinePhotosState') return false;
    reply({ enabled });
    return false;
  });
  function refreshToolbar() {
    let count = 0;
    for (const { group } of records.values()) {
      if (group.isConnected) count += group.querySelectorAll('.eksi-inline-image').length || 1;
    }
    if (!count) { toolbar?.remove(); toolbar = null; return; }
    if (!toolbar?.isConnected) {
      const list = document.querySelector('#entry-item-list');
      if (!list) return;
      toolbar = document.createElement('div');
      toolbar.className = 'eksi-inline-toolbar';
      const label = document.createElement('strong');
      label.textContent = 'Sayfa içi fotoğraflar';
      toggle = button('', () => setEnabled(!enabled));
      toolbar.append(label, toggle);
      list.before(toolbar);
    }
    const text = `${enabled ? 'Fotoğrafları gizle' : 'Fotoğrafları göster'} (${count})`;
    if (toggle.textContent !== text) toggle.textContent = text;
    toggle.setAttribute('aria-pressed', String(enabled));
  }
  const resolveNative = T.memoizeAsync(async source => {
    const provider = P.validateSource(source, 'page');
    const request = provider.buildRequest(source);
    const url = new URL(new URL(request.url).pathname, location.origin).href;
    const html = await T.fetchHtml(url, { credentials: 'same-origin', referrerPolicy: 'same-origin' });
    return P.normalizeResult(provider, provider.parseResponse(html, url));
  });
  const resolveExternal = T.memoizeAsync(async source => {
    let timer;
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: 'resolveExternalImage', source: { provider: source.provider, kind: source.kind, id: source.id } }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(U.failure('TIMEOUT', 'Viewer timeout')), 27000); })
      ]);
      if (!response?.ok) throw U.failure(response?.error?.code || 'WORKER', response?.error?.message || 'Reload the extension and refresh this page', response?.error?.status);
      return P.normalizeResult(P.get(source.provider), response.result);
    } finally { clearTimeout(timer); }
  });
  function resolveSource(source) {
    const provider = P.get(source.provider);
    const key = `${source.provider}:${source.kind}:${source.id}`;
    if (provider.context === 'image') return Promise.resolve(P.normalizeResult(provider, { images: [{ url: source.url }] }));
    return provider.context === 'page' ? resolveNative(key, source) : resolveExternal(key, source);
  }
  function watch(target, job) {
    target._job = job;
    target.dataset.state = 'waiting';
    pendingTargets.add(target);
    observer.observe(target);
  }
  function schedule(target) {
    if (!enabled || !target.isConnected || target.dataset.state !== 'waiting') return;
    target.dataset.state = 'queued';
    observer.unobserve(target);
    queue.push(target);
    pump();
  }
  function pump() {
    while (enabled && active < 3 && queue.length) {
      const target = queue.shift();
      pendingTargets.delete(target);
      if (!target.isConnected) continue;
      active++;
      target.dataset.state = 'loading';
      Promise.resolve().then(() => target._job()).then(() => {
        if (target.isConnected) target.dataset.state = 'loaded';
      }, error => { if (target.isConnected) showFailure(target, error); })
        .finally(() => { active--; pump(); });
    }
  }
  function showFailure(target, error) {
    const status = target.querySelector('.eksi-inline-status');
    status.hidden = false;
    if (error?.status === 404 || error?.status === 410) {
      target.dataset.state = 'unavailable';
      status.textContent = 'Fotoğraf kaynaktan kaldırılmış veya bulunamadı.';
      return;
    }
    target.dataset.state = 'error';
    const detail = error?.status === 403 ? 'Kaynak site isteği engelledi' : error?.status === 429 ? 'Kaynak site istek sınırına ulaştı; daha sonra tekrar deneyin' : error?.message || 'İstek başarısız oldu';
    const retry = button('Yeniden dene', () => {
      if (!enabled) return;
      target.dataset.state = 'waiting';
      schedule(target);
    });
    status.replaceChildren(document.createTextNode(`Fotoğraf yüklenemedi (${detail}). `), retry);
  }
  function loadImage(img, url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('Image timeout')), 20000);
      function finish(error) {
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        if (error) { img.removeAttribute('src'); reject(error); }
        else resolve();
      }
      img.onload = () => finish();
      img.onerror = () => finish(new Error('Image unavailable'));
      img.src = url;
    });
  }
  function photoPlaceholder(image, provider, label) {
    const target = document.createElement('span');
    target.className = 'eksi-inline-image';
    const shadow = target.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      a { all: initial; display: block; max-width: 100%; height: auto;
          overflow: visible; cursor: zoom-in; }
      img { all: initial; display: block; width: 100%; height: auto;
            object-fit: contain; border-radius: 6px; }
      a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
    `;
    shadow.append(style, document.createElement('slot'));
    const status = document.createElement('span');
    status.className = 'eksi-inline-status';
    status.textContent = 'Kaydırdıkça fotoğraf yüklenir…';
    target.append(status);
    watch(target, async () => {
      status.replaceChildren(document.createTextNode('Fotoğraf yükleniyor…'));
      const img = document.createElement('img');
      img.alt = image.alt || label || 'Bağlantılı fotoğraf';
      img.decoding = 'async';
      img.referrerPolicy = provider.context === 'page' ? 'strict-origin-when-cross-origin' : 'no-referrer';
      await loadImage(img, image.url);
      if (!target.isConnected) return;
      const size = U.previewSize(img.naturalWidth, img.naturalHeight);
      target.dataset.orientation = size.orientation;
      const full = document.createElement('a');
      full.href = image.url;
      full.target = '_blank';
      full.rel = 'noopener noreferrer';
      full.title = 'Tam boy fotoğrafı aç';
      full.style.width = `${size.width}px`;
      img.width = img.naturalWidth;
      img.height = img.naturalHeight;
      full.append(img);
      shadow.insertBefore(full, shadow.querySelector('slot'));
      status.hidden = true;
    });
    return target;
  }
  function sourceGroup(source, label) {
    const group = document.createElement('span');
    group.className = 'eksi-inline-photo';
    group.dataset.provider = source.provider;
    const status = document.createElement('span');
    status.className = 'eksi-inline-status';
    status.textContent = 'Kaydırdıkça fotoğraf yüklenir…';
    const original = document.createElement('a');
    original.href = source.url + (source.selected ? `#${source.selected}` : '');
    original.target = '_blank';
    original.rel = 'noopener noreferrer';
    original.className = 'eksi-inline-original';
    original.textContent = 'Görsele git';
    group.append(status, original);
    watch(group, async () => {
      status.replaceChildren(document.createTextNode('Fotoğraflar bulunuyor…'));
      const result = await resolveSource(source);
      if (!group.isConnected) return;
      const provider = P.get(source.provider);
      const images = result.images;
      const selected = Math.max(0, images.findIndex(image => image.id === source.selected));
      const remaining = images.filter((_, index) => index !== selected);
      group.insertBefore(photoPlaceholder(images[selected], provider, label), original);
      status.hidden = true;
      if (images.length > 1 || result.skipped || result.truncated) {
        const controls = document.createElement('span');
        controls.className = 'eksi-inline-album-controls';
        const count = document.createElement('span');
        const more = button('Daha fazla fotoğraf göster', () => {
          if (!enabled) return;
          for (const image of remaining.splice(0, 3)) group.insertBefore(photoPlaceholder(image, provider, label), controls);
          updateCount();
          refreshToolbar();
        });
        function updateCount() {
          count.textContent = `${images.length} fotoğraftan ${images.length - remaining.length} tanesi gösteriliyor` +
            (result.skipped ? ` · Desteklenmeyen ${result.skipped} öğe atlandı` : '') +
            (result.truncated ? ' · Albümün bir kısmı gösteriliyor; tüm fotoğraflar için kaynağı açın' : '');
          more.hidden = !remaining.length;
        }
        controls.append(count, more);
        group.insertBefore(controls, original);
        updateCount();
      }
      refreshToolbar();
    });
    return group;
  }
  function forget(record) {
    for (const target of [record.group, ...record.group.querySelectorAll('.eksi-inline-image')]) {
      observer.unobserve(target);
      pendingTargets.delete(target);
    }
    record.group.remove();
  }
  function scan() {
    const found = new Set();
    const contents = [...document.querySelectorAll('#entry-item-list .content')];
    for (const content of contents) {
      for (const { node, source } of S.sources(content, location.href)) {
        if (!source) continue;
        found.add(node);
        const signature = JSON.stringify(source);
        const previous = records.get(node);
        if (previous?.signature === signature && previous.group.isConnected) continue;
        if (previous) forget(previous);
        const group = sourceGroup(source, node.textContent.trim());
        node.after(group);
        records.set(node, { signature, group });
      }
    }
    for (const [node, record] of records) {
      if (!found.has(node) || !node.isConnected) { forget(record); records.delete(node); }
    }
    for (const content of contents) content.classList.toggle('eksi-inline-expanded', Boolean(content.querySelector('.eksi-inline-photo')));
    refreshToolbar();
  }
  scan();
  new MutationObserver(mutations => {
    if (!mutations.some(S.meaningfulMutation)) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 120);
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
})();
