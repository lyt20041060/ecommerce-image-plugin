(() => {
  'use strict';
  if (document.getElementById('product-image-extractor')) return;
  const button = document.createElement('button');
  button.id = 'product-image-extractor';
  button.textContent = '获取图片';
  button.type = 'button';
  button.title = '建议先滚动商品详情，加载更多图片后再提取';
  document.documentElement.append(button);
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = '正在提取…';
    try {
      const candidates = new Map();
      const add = (raw, source) => {
        const url = ImageTools.normalize(raw, location.href);
        if (!url || ImageTools.unwanted(url)) return;
        const key = ImageTools.key(url);
        const prior = candidates.get(key);
        if (!prior || url.length < prior.url.length) candidates.set(key, { url, source });
      };
      // Walk open shadow roots as well as the page DOM. Closed roots are inaccessible.
      const scan = root => {
        for (const el of root.querySelectorAll('*')) {
          if (el === button) continue;
          if (el.tagName === 'IMG') {
            for (const attr of ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-lazyload', 'data-url', 'data-ks-lazyload']) {
              const value = el.getAttribute(attr);
              if (value) add(value, '图片 / 懒加载');
            }
            if (el.currentSrc) add(el.currentSrc, '图片');
          }
          if (el.tagName === 'IMG' || el.tagName === 'SOURCE') {
            for (const attr of ['srcset', 'data-srcset']) {
              for (const part of (el.getAttribute(attr) || '').split(',')) {
                const value = part.trim().split(/\s+/)[0];
                if (value) add(value, '响应式图片');
              }
            }
          }
          for (const pseudo of [null, '::before', '::after']) {
            const background = getComputedStyle(el, pseudo).backgroundImage;
            for (const match of background.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) add(match[1], '背景图片');
          }
          if (el.shadowRoot) scan(el.shadowRoot);
        }
      };
      scan(document);
      const images = [...candidates.values()].slice(0, 1500);
      const response = await chrome.runtime.sendMessage({ type: 'OPEN_GALLERY', title: document.title, pageUrl: location.href, images });
      if (!response?.ok) throw new Error(response?.error || '无法打开结果页');
      button.textContent = '结果已打开';
    } catch (error) {
      button.textContent = '提取失败，点击重试';
      button.title = error.message;
    } finally {
      button.disabled = false;
      setTimeout(() => { button.textContent = '获取图片'; }, 2500);
    }
  });
})();
