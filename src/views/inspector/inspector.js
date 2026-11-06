const { ipcRenderer, clipboard } = require('electron');
const { renderMarkdown } = require('../../utils/markdown');

const contentEl = document.getElementById('inspector-content');
const metaTimeEl = document.getElementById('meta-time');
const metaCharsEl = document.getElementById('meta-chars');
const copyAllBtn = document.getElementById('btn-copy-all');
const closeBtn = document.getElementById('btn-close');

let currentRawText = '';

function updateInspector(data = {}) {
  currentRawText = data.content || '';
  const renderedHtml = renderMarkdown(currentRawText);
  if (contentEl) {
    contentEl.innerHTML = renderedHtml || '<div style="color: #94a3b8; font-style: italic;">目前無回覆內容</div>';
  }

  if (metaCharsEl) {
    metaCharsEl.innerText = `${currentRawText.length} 字元`;
  }

  if (metaTimeEl) {
    const timeStr = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    metaTimeEl.innerText = timeStr;
  }
}

// 監聽 IPC 傳入之回覆資料
ipcRenderer.on('set-inspector-data', (event, data) => {
  updateInspector(data);
});

// 複製全部內容
if (copyAllBtn) {
  copyAllBtn.addEventListener('click', () => {
    if (!currentRawText) return;
    clipboard.writeText(currentRawText);
    const originText = copyAllBtn.innerHTML;
    copyAllBtn.innerHTML = '✅ 已複製！';
    copyAllBtn.style.background = '#16a34a';
    copyAllBtn.style.borderColor = '#16a34a';
    setTimeout(() => {
      copyAllBtn.innerHTML = originText;
      copyAllBtn.style.background = '#0284c7';
      copyAllBtn.style.borderColor = '#0284c7';
    }, 1500);
  });
}

// 關閉視窗
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.close();
  });
}

// ESC 鍵關閉
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
});

// 代碼區塊內部複製按鈕委派
if (contentEl) {
  contentEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.md-code-copy-btn');
    if (!btn) return;
    const rawCode = decodeURIComponent(btn.getAttribute('data-code') || '');
    if (rawCode) {
      clipboard.writeText(rawCode);
      const originalText = btn.innerText;
      btn.innerText = '✅ 已複製！';
      btn.style.color = '#86efac';
      setTimeout(() => {
        btn.innerText = originalText;
        btn.style.color = '#e2e8f0';
      }, 1500);
    }
  });
}
