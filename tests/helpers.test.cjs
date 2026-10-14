const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../shared.js');
const fs = require('node:fs');
test('only approved HTTPS origins are accepted', () => {
  assert.equal(tools.normalize('//img.alicdn.com/a.jpg', 'https://item.taobao.com/x'), 'https://img.alicdn.com/a.jpg');
  for (const url of ['javascript:alert(1)', 'data:image/png,x', 'http://img.alicdn.com/a.jpg', 'https://alicdn.com.evil.test/a.jpg', 'https://evil.test/a']) assert.equal(tools.normalize(url), null);
});
test('thumbnail variants deduplicate without stripping signed queries', () => {
  assert.equal(tools.key('https://img.alicdn.com/a.jpg_400x400q90.jpg'), tools.key('https://img.alicdn.com/a.jpg'));
  assert.notEqual(tools.key('https://img.alicdn.com/a.jpg?token=a'), tools.key('https://img.alicdn.com/a.jpg?token=b'));
});
test('size filter retains long product detail strips', () => {
  assert.equal(tools.largeEnough(790, 8000), true);
  assert.equal(tools.largeEnough(100, 100), false);
  assert.equal(tools.largeEnough(160, 160), false);
  assert.equal(tools.largeEnough(400, 400), true);
});
test('icons filtered and numbered PNG filenames generated', () => {
  assert.equal(tools.unwanted('https://img.alicdn.com/shop-logo.png'), true);
  assert.equal(tools.unwanted('https://img.alicdn.com/product.jpg'), false);
  assert.equal(tools.filename(1), '商品图_001.png');
  assert.equal(tools.filename(1000), '商品图_1000.png');
});
test('MV3 files and local script references exist, no excessive permissions', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['downloads', 'storage']);
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  for (const file of [manifest.background.service_worker, ...manifest.content_scripts.flatMap(s => [...s.js, ...s.css]), 'gallery.html', 'gallery.js', 'gallery.css']) assert.ok(fs.existsSync(file), file);
  const html = fs.readFileSync('gallery.html', 'utf8');
  assert.ok(!/<script[^>]*src=["']https?:/i.test(html));
  assert.ok(!/\son\w+=/i.test(html));
});
