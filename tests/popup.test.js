'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function run(file, context) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
}
function page() {
  let listener;
  const classes = new Set();
  run('content.js', {
    EksiTransport: { memoizeAsync: fn => fn },
    EksiScanner: {},
    chrome: { runtime: { id: 'test', onMessage: { addListener(fn) { listener = fn; } } } },
    document: {
      querySelectorAll: () => [], body: {},
      documentElement: { classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } } }
    },
    IntersectionObserver: class {},
    MutationObserver: class { observe() {} }
  });
  return {
    classes,
    message(message, sender = { id: 'test' }) {
      let response;
      listener(message, sender, value => { response = value; });
      return response;
    }
  };
}
async function popup(sendMessage, tabs = [{ id: 7 }]) {
  const elements = Object.fromEntries(['status', 'toggle', 'hint', 'open-site'].map(id => [id, {
    hidden: ['toggle', 'open-site'].includes(id),
    setAttribute(name, value) { this[name] = value; },
    addEventListener(_type, fn) { this.click = fn; }
  }]));
  run('popup.js', {
    document: { getElementById: id => elements[id] },
    chrome: { tabs: { query: async () => tabs, sendMessage } }
  });
  await new Promise(resolve => setImmediate(resolve));
  return elements;
}

test('popup toggles page visibility and reads the existing state when reopened', async () => {
  const content = page();
  const send = async (id, message) => {
    assert.equal(id, 7);
    return content.message(message);
  };
  const elements = await popup(send);
  assert.equal(elements.toggle.textContent, 'Fotoğrafları gizle');
  await elements.toggle.click();
  assert.ok(content.classes.has('eksi-inline-hidden'));
  assert.equal(elements.toggle.textContent, 'Fotoğrafları göster');
  assert.equal(elements.toggle['aria-pressed'], 'false');
  const reopened = await popup(send);
  assert.equal(reopened.toggle.textContent, 'Fotoğrafları göster');
  await reopened.toggle.click();
  assert.ok(!content.classes.has('eksi-inline-hidden'));
  assert.equal(reopened.toggle.textContent, 'Fotoğrafları gizle');
});

test('page ignores unrelated senders, unknown commands, and invalid toggle values', () => {
  const content = page();
  assert.equal(content.message({ type: 'setInlinePhotosEnabled', enabled: false }, { id: 'other' }), undefined);
  assert.equal(content.message({ type: 'unknown' }), undefined);
  assert.equal(content.message({ type: 'setInlinePhotosEnabled', enabled: 'false' }), undefined);
  assert.equal(content.message({ type: 'getInlinePhotosState' }).enabled, true);
  assert.equal(content.classes.size, 0);
});

test('unsupported or stale pages show guidance and an Ekşi link', async () => {
  for (const send of [async () => { throw new Error('No receiver'); }, async () => undefined]) {
    const elements = await popup(send);
    assert.equal(elements.toggle.hidden, true);
    assert.equal(elements.hint.hidden, true);
    assert.equal(elements['open-site'].hidden, false);
    assert.match(elements.status.textContent, /yenileyip tekrar deneyin/);
  }
});

test('navigation during a toggle shows guidance instead of leaving a stuck button', async () => {
  let connected = true;
  const elements = await popup(async () => {
    if (!connected) throw new Error('Tab navigated');
    return { enabled: true };
  });
  connected = false;
  await elements.toggle.click();
  assert.equal(elements.toggle.hidden, true);
  assert.equal(elements.toggle.disabled, false);
  assert.equal(elements['open-site'].hidden, false);
});
