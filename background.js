importScripts('shared.js');
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'OPEN_GALLERY') return;
  (async () => {
    const pageUrl = ImageTools.normalize(sender.tab?.url);
    if (!pageUrl || sender.id !== chrome.runtime.id) throw new Error('页面来源无效');
    if (!Array.isArray(message.images)) throw new Error('图片列表无效');
    const images = message.images.slice(0, 1500).map(item => ({ url: ImageTools.normalize(item?.url), source: String(item?.source || '').slice(0, 40) })).filter(item => item.url);
    const id = crypto.randomUUID();
    const all = await chrome.storage.local.get(null);
    const expired = Object.keys(all).filter(k => k.startsWith('capture:') && all[k].created < Date.now() - 86400000);
    if (expired.length) await chrome.storage.local.remove(expired);
    await chrome.storage.local.set({ ['capture:' + id]: { title: String(message.title || '').slice(0, 300), pageUrl, images, created: Date.now() } });
    try { await chrome.tabs.create({ url: chrome.runtime.getURL('gallery.html') + '?id=' + id }); }
    catch (error) { await chrome.storage.local.remove('capture:' + id); throw error; }
    respond({ ok: true });
  })().catch(error => respond({ ok: false, error: error.message }));
  return true;
});
