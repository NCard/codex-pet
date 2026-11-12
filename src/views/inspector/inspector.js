const { ipcRenderer, clipboard } = require('electron');
const { renderMarkdown } = require('../../utils/markdown');

const contentEl = document.getElementById('inspector-content');
const metaTimeEl = document.getElementById('meta-time');
const metaCharsEl = document.getElementById('meta-chars');
const copyAllBtn = document.getElementById('btn-copy-all');
const closeBtn = document.getElementById('btn-close');

const reasoningContainer = document.getElementById('inspector-reasoning');
const reasoningLevelBadge = document.getElementById('reasoning-level-badge');
const reasoningMeta = document.getElementById('reasoning-meta');
const reasoningBody = document.getElementById('reasoning-body');

let currentRawText = '';

function escapeHtml(str) {
  if (typeof str !== 'string') str = String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReasoning(trajectory = {}) {
  if (!reasoningBody) return;
  const level = (trajectory.thinkingLevel || 'medium').toLowerCase();
  
  if (reasoningLevelBadge) {
    reasoningLevelBadge.className = `reasoning-badge badge-${level}`;
    reasoningLevelBadge.innerText = level.toUpperCase();
  }

  const stepCount = trajectory.steps ? trajectory.steps.length : 0;
  const duration = typeof trajectory.durationMs === 'number' ? `${(trajectory.durationMs / 1000).toFixed(1)}s` : '';
  
  if (reasoningMeta) {
    reasoningMeta.innerText = `${stepCount} 輪決策${duration ? ' • ' + duration : ''}`;
  }

  let html = '';

  // 模型思維鏈摘要
  if (trajectory.thoughts && trajectory.thoughts.length > 0) {
    html += `
      <div class="reasoning-thoughts-card">
        <div class="thoughts-header">💭 內在思維鏈摘要 (Model Thoughts)</div>
        <div class="thoughts-content">${escapeHtml(trajectory.thoughts.join('\n\n'))}</div>
      </div>
    `;
  }

  // 各步驟與工具調用日誌
  if (!trajectory.steps || trajectory.steps.length === 0) {
    html += `
      <div class="reasoning-empty">
        ⚡ 單輪直覺推導完成（無呼叫本地工具）。${duration ? '耗時約 ' + duration + '。' : ''}
      </div>
    `;
  } else {
    trajectory.steps.forEach(step => {
      const toolsNames = step.tools ? step.tools.map(t => t.name).join(', ') : '未命名工具';
      html += `
        <div class="reasoning-step-card">
          <div class="step-card-header">
            <span class="step-badge">Step ${step.step}</span>
            <span>呼叫工具：${escapeHtml(toolsNames)}</span>
          </div>
      `;
      if (step.tools && step.tools.length > 0) {
        step.tools.forEach((tool, idx) => {
          const resp = step.responses && step.responses[idx];
          html += `
            <div class="step-tool-item">
              <div class="tool-header">🛠️ <span>Tool Call:</span> <span class="tool-name">${escapeHtml(tool.name)}</span></div>
              <pre class="tool-code-block"><code>${escapeHtml(JSON.stringify(tool.args || {}, null, 2))}</code></pre>
          `;
          if (resp) {
            if (resp.error) {
              html += `
                <div class="tool-header">❌ <span style="color: #ef4444;">Error:</span></div>
                <pre class="tool-code-block error"><code>${escapeHtml(resp.error)}</code></pre>
              `;
            } else {
              html += `
                <div class="tool-header">📋 <span style="color: #10b981;">Output:</span></div>
                <pre class="tool-code-block output"><code>${escapeHtml(resp.result || '成功')}</code></pre>
              `;
            }
          }
          html += `</div>`;
        });
      }
      html += `</div>`;
    });
  }

  reasoningBody.innerHTML = html;
}

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

  const trajectory = data.reasoningTrajectory;
  if (trajectory && reasoningContainer) {
    renderReasoning(trajectory);
    reasoningContainer.style.display = 'block';
  } else if (reasoningContainer) {
    reasoningContainer.style.display = 'none';
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

