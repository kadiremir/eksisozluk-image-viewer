'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../providers/index.js');
const T = require('../transport.js');
const { createResolver } = require('../resolver.js');

const shortUrl = 'https://resmim.net/i/HwuzCC';
const canonicalUrl = 'https://resmim.net/i/9528.HwuzCC';
const imageUrl = 'https://resmim.net/cdn/2026/10/28/HwuzCC.jpg';
const html = `<meta property="og:image" content="${imageUrl}">`;

function viewerResponse(url, redirected = true, body = html) {
  const response = new Response(body, { headers: { 'content-type': 'text/html' } });
  Object.defineProperties(response, { url: { value: url }, redirected: { value: redirected } });
  return response;
}

test('Resmim short links resolve through their canonical viewer redirect', async () => {
  const resolve = createResolver(async (url, options) => {
    assert.equal(url, shortUrl);
    assert.equal(options.redirect, 'follow');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return viewerResponse(canonicalUrl);
  });
  const result = await resolve(P.classify(shortUrl));
  assert.equal(result.images[0].url, imageUrl);
  assert.deepEqual(await resolve(P.classify(canonicalUrl)), result);
});

test('Resmim rejects redirect responses outside the requested viewer', async () => {
  for (const url of [
    'https://example.com/i/9528.HwuzCC',
    'http://resmim.net/i/9528.HwuzCC',
    'https://resmim.net/i/9528.OtherID',
    'https://resmim.net/login',
    `${canonicalUrl}?redirect=1`,
    'https://user:pass@resmim.net/i/9528.HwuzCC'
  ]) {
    const resolve = createResolver(async () => viewerResponse(url));
    await assert.rejects(resolve(P.classify(shortUrl)), { code: 'REDIRECT' });
  }
});

test('other providers continue to reject redirects', async () => {
  const resolve = createResolver(async (_url, options) => {
    assert.equal(options.redirect, 'error');
    return viewerResponse('https://ibb.co/other');
  });
  await assert.rejects(resolve(P.classify('https://ibb.co/example')),
    { code: 'REDIRECT' });
});

test('Resmim still reports missing viewers and rejects unrelated images', async () => {
  const missing = createResolver(async () => new Response('', { status: 404 }));
  await assert.rejects(missing(P.classify(shortUrl)), { code: 'HTTP', status: 404 });
  const unrelated = createResolver(async () => viewerResponse(canonicalUrl, true,
    '<meta property="og:image" content="https://example.com/photo.jpg">'));
  await assert.rejects(unrelated(P.classify(shortUrl)), { code: 'NO_PHOTO' });
});

test('transport keeps redirects disabled by default', async () => {
  const result = await T.fetchHtml(shortUrl, {}, async (_url, options) => {
    assert.equal(options.redirect, 'error');
    return viewerResponse(shortUrl, false);
  });
  assert.equal(result, html);
});

