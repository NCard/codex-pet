const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('app-wrapper');
  const trigger = document.getElementById('submenu-trigger');
  const sidePanel = document.getElementById('side-panel');
  let hideTimer = null;

  // 顯示側邊子選單
  const showPanel = () => {
    clearTimeout(hideTimer);
    trigger.classList.add('active');
    sidePanel.classList.add('visible');
  };

  // 隱藏側邊子選單（帶延遲，讓滑鼠移到子選單時不閃爍）
  const scheduleHide = () => {
    hideTimer = setTimeout(() => {
      trigger.classList.remove('active');
      sidePanel.classList.remove('visible');
    }, 120);
  };

  trigger.addEventListener('mouseenter', showPanel);
  trigger.addEventListener('mouseleave', scheduleHide);
  sidePanel.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  sidePanel.addEventListener('mouseleave', scheduleHide);

  // 動態追蹤整體尺寸（含子選單展開後）
  const resizeObserver = new ResizeObserver(() => {
    const w = wrapper.offsetWidth + 4;
    const h = wrapper.offsetHeight + 4;
    ipcRenderer.send('menu-resize', w, h);
  });
  resizeObserver.observe(wrapper);

  // 點擊事件（主選單和子選單都適用）
  wrapper.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item) return;
    ipcRenderer.send('menu-item-clicked', item.dataset.action);
  });

  // 失焦時關閉
  window.addEventListener('blur', () => {
    ipcRenderer.send('menu-item-clicked', 'cancel');
  });
});
