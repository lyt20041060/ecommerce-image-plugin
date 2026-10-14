(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const items = [];
  const selected = new Set();
  const objectUrls = new Set();
  let busy = false;
  const visible = () => items.filter(item => $('small').checked || ImageTools.largeEnough(item.width, item.height));
  function report(message) {
    $('errors').hidden = false;
    const li = document.createElement('li');
    li.textContent = message;
    $('error-list').append(li);
  }
  function counts() {
    $('count').textContent = `已选 ${selected.size} 张 / 可见 ${visible().length} 张`;
    $('download').disabled = busy || !selected.size;
  }
  function render() {
    $('grid').replaceChildren();
    for (const item of visible()) {
      const card = document.createElement('article');
      card.className = 'card' + (selected.has(item.url) ? ' selected' : '');
      const preview = document.createElement('button');
      preview.className = 'image-button';
      preview.title = '查看大图';
      preview.setAttribute('aria-label', `预览图片 ${item.index}`);
      const img = document.createElement('img');
      img.src = item.previewUrl || item.url;
      img.alt = `商品图片 ${item.index}`;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      preview.append(img);
      preview.addEventListener('click', () => {
        $('preview-image').src = img.src;
        $('preview-image').referrerPolicy = 'no-referrer';
        $('preview').showModal();
      });
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(item.url);
      checkbox.disabled = busy;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(item.url); else selected.delete(item.url);
        card.classList.toggle('selected', checkbox.checked);
        counts();
      });
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = `${item.width} × ${item.height}`;
      label.append(checkbox, `图片 ${String(item.index).padStart(3, '0')}`, meta);
      const source = document.createElement('p');
      source.textContent = item.source;
      card.append(preview, label, source);
      $('grid').append(card);
    }
    $('empty').hidden = visible().length > 0;
    counts();
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      const timer = setTimeout(() => { img.src = ''; reject(new Error('图片加载超时')); }, 15000);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('图片无法加载，可能已过期或需要页面访问权限')); };
      img.src = url;
    });
  }
  async function fetchBlob(url) {
    if (!ImageTools.normalize(url)) throw new Error('图片域名不在授权范围内');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`服务器返回 HTTP ${response.status}`);
      if (!ImageTools.normalize(response.url)) throw new Error('图片重定向到未授权域名');
      if (!/^image\//i.test(response.headers.get('content-type') || '')) throw new Error('服务器未返回图片');
      const max = 30 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > max) throw new Error('图片超过 30 MB 限制');
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > max) { await reader.cancel(); throw new Error('图片超过 30 MB 限制'); }
        chunks.push(value);
      }
      return new Blob(chunks, { type: response.headers.get('content-type') });
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('读取图片超时');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function pool(values, concurrency, work) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (next < values.length) { const index = next++; await work(values[index], index); }
    }));
  }
  function lock(value) {
    busy = value;
    for (const id of ['all', 'invert', 'small']) $(id).disabled = value;
    for (const input of $('grid').querySelectorAll('input')) input.disabled = value;
    counts();
  }
  $('all').addEventListener('click', () => { for (const item of visible()) selected.add(item.url); render(); });
  $('invert').addEventListener('click', () => { for (const item of visible()) { if (selected.has(item.url)) selected.delete(item.url); else selected.add(item.url); } render(); });
  $('small').addEventListener('change', () => {
    const urls = new Set(visible().map(item => item.url));
    for (const url of selected) if (!urls.has(url)) selected.delete(url);
    render();
  });
  $('close-preview').addEventListener('click', () => $('preview').close());
  $('preview').addEventListener('close', () => $('preview-image').removeAttribute('src'));

  // Register the event listener before starting a download to avoid missing fast completions.
  async function save(url, filename) {
    return new Promise((resolve, reject) => {
      let id;
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chrome.downloads.onChanged.removeListener(listener);
        if (error) reject(error); else resolve();
      };
      const listener = delta => {
        if (delta.id !== id) return;
        if (delta.state?.current === 'complete') finish();
        if (delta.state?.current === 'interrupted') finish(new Error(delta.error?.current || '下载被取消或中断'));
      };
      const timer = setTimeout(() => {
        if (id !== undefined) chrome.downloads.cancel(id).catch(() => {});
        finish(new Error('下载超过 120 秒，已请求取消'));
      }, 120000);
      chrome.downloads.onChanged.addListener(listener);
      chrome.downloads.download({ url, filename, conflictAction: 'uniquify', saveAs: false }).then(async downloadId => {
        id = downloadId;
        const [entry] = await chrome.downloads.search({ id });
        if (entry?.state === 'complete') finish();
        else if (entry?.state === 'interrupted') finish(new Error(entry.error || '下载中断'));
      }).catch(finish);
    });
  }
  async function convert(item) {
    const blob = await fetchBlob(item.url);
    const bitmap = await createImageBitmap(blob);
    try {
      if (bitmap.width * bitmap.height > 40000000 || Math.max(bitmap.width, bitmap.height) > 16384) throw new Error('图片过大，无法安全转换（上限 4000 万像素 / 单边 16384）');
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器无法创建图像转换画布');
      context.drawImage(bitmap, 0, 0);
      const png = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG 转换失败')), 'image/png'));
      canvas.width = canvas.height = 0;
      return png;
    } finally { bitmap.close(); }
  }
  $('download').addEventListener('click', async () => {
    const batch = visible().filter(item => selected.has(item.url));
    if (!batch.length || busy) return;
    lock(true);
    let completed = 0, success = 0, failed = 0;
    $('progress').max = batch.length;
    $('progress').value = 0;
    $('status').textContent = `正在转换并下载 0 / ${batch.length}，请保持此标签页打开`;
    try {
      await pool(batch, 2, async (item, index) => {
        let url;
        try {
          url = URL.createObjectURL(await convert(item));
          objectUrls.add(url);
          await save(url, ImageTools.filename(index + 1));
          success++;
        } catch (error) {
          failed++;
          report(`${ImageTools.filename(index + 1)}：${error.message}。原图：${item.url}`);
        } finally {
          if (url) { URL.revokeObjectURL(url); objectUrls.delete(url); }
          completed++;
          $('progress').value = completed;
          $('status').textContent = `已处理 ${completed} / ${batch.length} · 成功 ${success} · 失败 ${failed}，请保持此标签页打开`;
        }
      });
      $('status').textContent = `下载结束：成功 ${success} 张，失败 ${failed} 张。${failed ? '查看失败详情，可重新选择失败图片重试。' : '文件已保存到 Chrome 设置的下载目录。'}`;
    } finally { lock(false); }
  });
  window.addEventListener('beforeunload', event => {
    if (busy) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('pagehide', () => { for (const url of objectUrls) URL.revokeObjectURL(url); });
  async function init() {
    lock(true);
    try {
      const id = new URLSearchParams(location.search).get('id');
      if (!id || !/^[a-f\d-]{36}$/i.test(id)) throw new Error('采集记录编号无效，请回到商品页面重新提取');
      const key = 'capture:' + id;
      const record = (await chrome.storage.local.get(key))[key];
      if (!record) throw new Error('采集记录已清理，请回到商品页面重新提取');
      $('title').textContent = record.title || '商品图片';
      const source = ImageTools.normalize(record.pageUrl);
      if (source) { $('source').href = source; $('source').hidden = false; }
      const seen = new Set();
      const candidates = record.images.filter(item => {
        const url = ImageTools.normalize(item.url);
        if (!url || ImageTools.unwanted(url)) return false;
        const key = ImageTools.key(url);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      let checked = 0, rejected = 0;
      $('progress').max = Math.max(candidates.length, 1);
      await pool(candidates, 6, async (item, index) => {
        let previewUrl;
        try {
          let image;
          try { image = await loadImage(item.url); }
          catch {
            previewUrl = URL.createObjectURL(await fetchBlob(item.url));
            objectUrls.add(previewUrl);
            image = await loadImage(previewUrl);
          }
          items.push({ ...item, previewUrl, index: index + 1, width: image.naturalWidth, height: image.naturalHeight });
        } catch (error) {
          if (previewUrl) { URL.revokeObjectURL(previewUrl); objectUrls.delete(previewUrl); }
          rejected++;
          report(`无法检查图片：${error.message}。原图：${item.url}`);
        } finally {
          checked++;
          $('progress').value = checked;
          $('status').textContent = `正在检查图片 ${checked} / ${candidates.length}`;
        }
      });
      items.sort((a, b) => a.index - b.index);
      render();
      $('status').textContent = `发现 ${candidates.length} 个去重候选，显示 ${visible().length} 张商品尺寸图片，${rejected} 张加载失败。尺寸过滤：短边 ≥ 160，面积 ≥ 60000 像素。`;
    } catch (error) {
      $('title').textContent = '无法读取图片';
      $('status').textContent = error.message;
    } finally { lock(false); }
  }
  init();
})();
