(() => {
  'use strict';
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('navigation');
  menu.hidden = false;
  function closeMenu() {
    menu.setAttribute('aria-expanded', 'false');
    menu.textContent = '菜单';
    navigation.classList.remove('is-open');
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? '关闭' : '菜单';
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  const checkboxes = [...document.querySelectorAll('.demo-card input')];
  function updateDemo() {
    checkboxes.forEach(input => input.closest('.demo-card').classList.toggle('selected', input.checked));
    document.getElementById('demo-count').textContent = `已选 ${checkboxes.filter(input => input.checked).length} 张`;
  }
  checkboxes.forEach(input => input.addEventListener('change', updateDemo));
  document.getElementById('demo-all').addEventListener('click', () => { checkboxes.forEach(input => { input.checked = true; }); updateDemo(); });
  document.getElementById('demo-invert').addEventListener('click', () => { checkboxes.forEach(input => { input.checked = !input.checked; }); updateDemo(); });
  updateDemo();
  const copy = document.getElementById('copy-address');
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    const address = document.getElementById('extensions-address');
    const status = document.getElementById('copy-status');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(address.textContent);
      status.textContent = '已复制，请粘贴到 Chrome 地址栏。';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(address);
      const selection = window.getSelection();
      if (selection) { selection.removeAllRanges(); selection.addRange(range); }
      status.textContent = '地址已选中，请按 Ctrl+C（Mac：⌘C）复制。';
    }
  });
})();
