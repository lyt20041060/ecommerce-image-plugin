const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tools = require('../shared.js');

test('content script collects lazy, responsive, CSS and shadow images and deduplicates', async () => {
  let click, sent;
  const node = (tagName, attrs = {}, background = 'none') => ({ tagName, getAttribute: key => attrs[key] || null, background });
  const img = node('IMG', { src: '//img.alicdn.com/product.jpg_400x400.jpg', 'data-src': '//img.alicdn.com/product.jpg', srcset: 'https://img.alicdn.com/large.jpg 2x' });
  const lazy = node('IMG', { 'data-original': 'https://img.pddpic.com/detail.webp' });
  const icon = node('IMG', { src: 'https://img.alicdn.com/icon.png' });
  const blocked = node('IMG', { src: 'https://evil.test/a.jpg' });
  const background = node('DIV', {}, 'url("https://img10.360buyimg.com/background.jpg")');
  const shadow = node('DIV');
  shadow.shadowRoot = { querySelectorAll: () => [node('IMG', { src: 'https://img.alicdn.com/shadow.jpg' })] };
  const button = { addEventListener: (_, fn) => { click = fn; } };
  const context = {
    ImageTools: tools,
    location: { href: 'https://item.taobao.com/item.htm?id=1' },
    document: { title: '测试商品', getElementById: () => null, createElement: () => button, documentElement: { append() {} }, querySelectorAll: () => [img, lazy, icon, blocked, background, shadow] },
    getComputedStyle: el => ({ backgroundImage: el.background }),
    chrome: { runtime: { sendMessage: async value => { sent = value; return { ok: true }; } } },
    setTimeout: () => 0
  };
  vm.runInNewContext(fs.readFileSync('content.js', 'utf8'), context);
  await click();
  assert.equal(sent.type, 'OPEN_GALLERY');
  assert.equal(sent.images.length, 5);
  assert.ok(sent.images.some(item => item.url === 'https://img.alicdn.com/product.jpg'));
  assert.ok(sent.images.some(item => item.source === '背景图片'));
  assert.equal(button.disabled, false);
});

function backgroundHarness() {
  let listener;
  const storage = {};
  const opened = [];
  const context = {
    ImageTools: tools, importScripts() {}, crypto: { randomUUID: () => 'test-id' }, Date,
    chrome: {
      runtime: { id: 'extension', onMessage: { addListener: value => { listener = value; } }, getURL: file => 'chrome-extension://extension/' + file },
      storage: { local: {
        get: async () => ({ ...storage }),
        set: async values => Object.assign(storage, values),
        remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key]; }
      } },
      tabs: { create: async value => opened.push(value) }
    }
  };
  vm.runInNewContext(fs.readFileSync('background.js', 'utf8'), context);
  return { storage, opened, send: (message, sender) => new Promise(resolve => listener(message, sender, resolve)) };
}
test('service worker stores validated capture, opens tab and prunes expired records', async () => {
  const harness = backgroundHarness();
  harness.storage['capture:old'] = { created: Date.now() - 90000000 };
  const result = await harness.send({ type: 'OPEN_GALLERY', title: '商品', images: [{ url: 'https://img.alicdn.com/a.jpg', source: '图片' }, { url: 'https://evil.test/a.jpg' }] }, { id: 'extension', tab: { url: 'https://item.taobao.com/item.htm?id=1' } });
  assert.equal(result.ok, true);
  assert.equal(harness.storage['capture:test-id'].images.length, 1);
  assert.equal(harness.storage['capture:old'], undefined);
  assert.equal(harness.opened[0].url, 'chrome-extension://extension/gallery.html?id=test-id');
});
test('service worker rejects unauthorized source and malformed payload', async () => {
  const harness = backgroundHarness();
  const result = await harness.send({ type: 'OPEN_GALLERY', images: [] }, { id: 'other', tab: { url: 'https://item.taobao.com/' } });
  assert.equal(result.ok, false);
  const malformed = await harness.send({ type: 'OPEN_GALLERY', images: null }, { id: 'extension', tab: { url: 'https://item.taobao.com/' } });
  assert.equal(malformed.ok, false);
  assert.equal(harness.opened.length, 0);
});
