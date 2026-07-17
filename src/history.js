const fs = require('fs');
const path = require('path');
const historyContainer = document.getElementById('history-container');
const historyPath = path.join(__dirname, '../chat_history.json');
const cryptoUtils = require('./crypto_utils');

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
    
    // 捲動到最底
    window.scrollTo(0, document.body.scrollHeight);
  } catch (err) {
    console.error(err);
    historyContainer.innerHTML = '<div style="text-align: center; color: red;">讀取歷史紀錄失敗 😢</div>';
  }
}

// 載入歷史紀錄
loadHistory();

// 也可以設定一個定時器，每幾秒重新整理一次，讓它即時更新
setInterval(loadHistory, 3000);
