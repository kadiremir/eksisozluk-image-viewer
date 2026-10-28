(() => {
  'use strict';
  const status = document.getElementById('status');
  const toggle = document.getElementById('toggle');
  const hint = document.getElementById('hint');
  const openSite = document.getElementById('open-site');
  let tabId, enabled;

  function render(state) {
    if (typeof state?.enabled !== 'boolean') throw new Error('Page unavailable');
    enabled = state.enabled;
    status.textContent = `Bu sayfada fotoğraflar ${enabled ? 'gösteriliyor' : 'gizli'}.`;
    toggle.textContent = enabled ? 'Fotoğrafları gizle' : 'Fotoğrafları göster';
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.hidden = false;
  }
  function unavailable() {
    status.textContent = 'Fotoğraf önizlemelerini kullanmak için bir Ekşisözlük sayfası açın. Sayfa zaten açıksa yenileyip tekrar deneyin.';
    toggle.hidden = true;
    hint.hidden = true;
    openSite.hidden = false;
  }
  toggle.addEventListener('click', async () => {
    toggle.disabled = true;
    try {
      render(await chrome.tabs.sendMessage(tabId, { type: 'setInlinePhotosEnabled', enabled: !enabled }));
    } catch { unavailable(); }
    finally { toggle.disabled = false; }
  });
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!Number.isInteger(tab?.id)) throw new Error('No active tab');
      tabId = tab.id;
      render(await chrome.tabs.sendMessage(tabId, { type: 'getInlinePhotosState' }));
    } catch { unavailable(); }
  })();
})();
