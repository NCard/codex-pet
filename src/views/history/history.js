require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const historyContainer = document.getElementById('history-container');
const historyPath = path.join(__dirname, '../../../data/chat_history.dat');
const cryptoUtils = require('../../utils/crypto_utils');

function loadHistory() {
  if (!fs.existsSync(historyPath)) {
    historyContainer.innerHTML = '<div style="text-align: center; color: #888;">目前還沒有任何對話喔！快去跟 Wiki Wiki 聊天吧！</div>';
    return;
  }
  try {
    const data = fs.readFileSync(historyPath, 'utf8');
    let history = [];
    if (data.trim() !== '') {
      try {
        const decrypted = cryptoUtils.decryptData(data);
        history = JSON.parse(decrypted);
      } catch (e) {
        history = JSON.parse(data);
      }
    }

    if (history.length === 0) {
      historyContainer.innerHTML = '<div style="text-align: center; color: #888;">目前還沒有任何對話喔！快去跟 Wiki Wiki 聊天吧！</div>';
      return;
    }

    historyContainer.innerHTML = '';
    history.forEach(item => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `msg ${item.role}`;
      
      const safeText = item.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      let textContent = safeText;
      if (item.role === 'kiwi') {
        textContent = `<span style="color: #c97a2e; font-weight: bold;">Wiki Wiki：</span><br/>${safeText}`;
      } else {
        textContent = `<strong>你：</strong><br/>${safeText}`;
      }

      msgDiv.innerHTML = `
        <div>${textContent}</div>
        <div class="timestamp">${item.timestamp || ''}</div>
      `;
      historyContainer.appendChild(msgDiv);
    });
    
    // 如果是初次載入，我們可以在外部呼叫時決定是否要捲動
  } catch (err) {
    console.error(err);
    historyContainer.innerHTML = '<div style="text-align: center; color: red;">讀取歷史紀錄失敗 😢</div>';
  }
}

// 初次載入歷史紀錄並捲動到最底部
loadHistory();
window.scrollTo(0, document.body.scrollHeight);

document.getElementById('clear-history-btn').addEventListener('click', () => {
  if (confirm('確定要清空所有的對話紀錄嗎？這項操作無法復原喔！')) {
    try {
      const encryptedStr = cryptoUtils.encryptData("[]");
      fs.writeFileSync(historyPath, encryptedStr, 'utf8');
      loadHistory();
    } catch (e) {
      console.error('Failed to clear history:', e);
      alert('清空失敗了 😢');
    }
  }
});

// 也可以設定一個定時器，每幾秒重新整理一次，讓它即時更新
setInterval(() => {
  // 記錄是否已經在最底部，如果在最底部，重載後繼續保持在最底部
  const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10;
  loadHistory();
  if (isAtBottom) {
    window.scrollTo(0, document.body.scrollHeight);
  }
}, 3000);

document.getElementById('scroll-bottom-btn').addEventListener('click', () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});
