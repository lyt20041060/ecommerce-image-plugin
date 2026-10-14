/* Shared pure helpers; also exported for local Node tests. */
(function (root) {
  'use strict';
  const hosts = ['taobao.com', 'tmall.com', 'jd.com', 'pinduoduo.com', 'yangkeduo.com', 'alicdn.com', '360buyimg.com', 'jdimg.com', 'pddpic.com', 'pinduoduoimg.com'];
  function normalize(value, base) {
    try {
      const url = new URL(value, base);
      if (url.protocol !== 'https:' || !hosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return null;
      url.hash = '';
      return url.href;
    } catch { return null; }
  }
  function key(value) {
    const url = new URL(value);
    // Ali CDN thumbnail suffixes represent the same underlying asset.
    if (url.hostname.endsWith('.alicdn.com')) url.pathname = url.pathname.replace(/_(?:\d+x\d+|\d+x\d+q\d+)[^/]*$/i, '');
    return url.origin + url.pathname + url.search;
  }
  function unwanted(url) {
    return /(?:^|[\/_-])(?:logo|icon|avatar|placeholder|loading|spacer|sprite)(?:[\/_.-]|$)/i.test(new URL(url).pathname);
  }
  function largeEnough(width, height) { return Math.min(width, height) >= 160 && width * height >= 60000; }
  function filename(index) { return `商品图_${String(index).padStart(3, '0')}.png`; }
  const api = { normalize, key, unwanted, largeEnough, filename };
  root.ImageTools = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
