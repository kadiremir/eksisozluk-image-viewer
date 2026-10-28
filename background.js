/* MV3 worker: public viewer requests only; no account/session access. */
importScripts('urls.js', 'html-fields.js', 'providers/eksi.js', 'providers/imgbb.js',
  'providers/imgur.js', 'providers/resmim.js', 'providers/direct.js', 'providers/index.js',
  'transport.js', 'resolver.js');
chrome.runtime.onMessage.addListener(
  EksiResolver.createMessageHandler(chrome.runtime.id, EksiResolver.createResolver())
);
