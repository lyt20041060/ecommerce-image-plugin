// Test behavior using minimal DOM doubles, not an actual browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function element() {
  const events = {}, attrs = {}, classes = new Set();
  return { hidden: true, textContent: '', events, addEventListener: (name, fn) => { events[name] = fn; }, setAttribute: (key, value) => { attrs[key] = value; }, getAttribute: key => attrs[key], classList: { remove: key => classes.delete(key), toggle: (key, value) => value ? classes.add(key) : classes.delete(key), contains: key => classes.has(key) } };
}
function setup(clipboard) {
  const ids = Object.fromEntries(['navigation', 'demo-all', 'demo-invert', 'demo-count', 'copy-address', 'extensions-address', 'copy-status'].map(id => [id, element()]));
  ids['extensions-address'].textContent = 'chrome://extensions/';
  const menu = element();
  menu.setAttribute('aria-expanded', 'false');
  const inputs = [true, true, false].map(checked => { const card = element(); return { checked, card, closest: () => card, ...element() }; });
  const selection = { removeAllRanges() {}, addRange() { this.selected = true; } };
  const document = { querySelector: () => menu, querySelectorAll: () => inputs, getElementById: id => ids[id], addEventListener() {}, createRange: () => ({ selectNodeContents() {} }) };
  vm.runInNewContext(fs.readFileSync('docs/js/main.js', 'utf8'), { document, window: { getSelection: () => selection }, navigator: { clipboard } });
  return { ids, menu, inputs, selection };
}
test('demo checkbox count, select all and invert', () => {
  const { ids, inputs } = setup();
  assert.equal(ids['demo-count'].textContent, '已选 2 张');
  ids['demo-all'].events.click();
  assert.equal(ids['demo-count'].textContent, '已选 3 张');
  ids['demo-invert'].events.click();
  assert.equal(ids['demo-count'].textContent, '已选 0 张');
  inputs[0].checked = true;
  inputs[0].events.change();
  assert.equal(ids['demo-count'].textContent, '已选 1 张');
  assert.ok(inputs[0].card.classList.contains('selected'));
});
test('mobile menu state and close on link navigation', () => {
  const { menu, ids } = setup();
  assert.equal(menu.hidden, false);
  menu.events.click();
  assert.equal(menu.getAttribute('aria-expanded'), 'true');
  assert.ok(ids.navigation.classList.contains('is-open'));
  ids.navigation.events.click({ target: { closest: () => ({}) } });
  assert.equal(menu.getAttribute('aria-expanded'), 'false');
});
test('clipboard copy and file-mode fallback', async () => {
  let copied;
  const success = setup({ writeText: async value => { copied = value; } });
  await success.ids['copy-address'].events.click();
  assert.equal(copied, 'chrome://extensions/');
  assert.match(success.ids['copy-status'].textContent, /已复制/);
  const fallback = setup();
  await fallback.ids['copy-address'].events.click();
  assert.ok(fallback.selection.selected);
  assert.match(fallback.ids['copy-status'].textContent, /Ctrl\+C/);
});
