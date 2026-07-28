require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const historyContainer = document.getElementById('history-container');
const { historyPath } = require('../../utils/paths');
const cryptoUtils = require('../../utils/crypto_utils');

const toggleSearchBtn = document.getElementById('toggle-search-btn');
const searchBox = document.getElementById('search-box');
const searchActiveDot = document.getElementById('search-active-dot');

const keywordInput = document.getElementById('keyword-input');
const dateSelect = document.getElementById('date-select');
const clearKeywordBtn = document.getElementById('clear-keyword-btn');
const resetFilterBtn = document.getElementById('reset-filter-btn');
const filterStatus = document.getElementById('filter-status');
const floatingDatePill = document.getElementById('floating-date-pill');
const floatingDateText = document.getElementById('floating-date-text');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');

let allHistory = [];
let scrollTimer = null;

// 收合/展開搜尋工具列 (保持當前搜尋狀態)
if (toggleSearchBtn && searchBox) {
  toggleSearchBtn.addEventListener('click', () => {
    searchBox.classList.toggle('collapsed');
    if (!searchBox.classList.contains('collapsed') && keywordInput) {
      keywordInput.focus();
    }
  });
}

// 解析並格式化歷史紀錄中的日期為 YYYY-MM-DD
function getItemDateStr(timestamp) {
  if (!timestamp) return '';
  const match = timestamp.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (match) {
    const yyyy = match[1];
    const mm = match[2].padStart(2, '0');
    const dd = match[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

// 格式化 LINE 風格的日期分隔頁眉 (例如：2026年7月28日 星期二)
function formatDateHeader(timestamp) {
  if (!timestamp) return '更早的對話';
  const match = timestamp.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (match) {
    const yyyy = match[1];
    const mm = parseInt(match[2], 10);
    const dd = parseInt(match[3], 10);
    const dateObj = new Date(yyyy, mm - 1, dd);
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const dayName = !isNaN(dateObj.getTime()) ? days[dateObj.getDay()] : '';
    return `${yyyy} 年 ${mm} 月 ${dd} 日 ${dayName}`;
  }
  return timestamp;
}

// 動態更新日期選單 (只顯示有歷史紀錄的日期，其他無資料日期自動排除)
function updateDateSelectOptions() {
  const selectedVal = dateSelect.value;
  dateSelect.innerHTML = '<option value="">📅 所有日期</option>';

  const dateCounts = {};
  allHistory.forEach(item => {
    const dStr = getItemDateStr(item.timestamp);
    if (dStr) {
      dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
    }
  });

  const availableDates = Object.keys(dateCounts).sort().reverse();
  availableDates.forEach(dStr => {
    const option = document.createElement('option');
    option.value = dStr;
    option.innerText = `${dStr.replace(/-/g, '/')} (${dateCounts[dStr]}則)`;
    if (dStr === selectedVal) {
      option.selected = true;
    }
    dateSelect.appendChild(option);
  });
}

// 高亮包含搜尋關鍵字的文字
function highlightKeyword(text, keyword) {
  if (!keyword || !keyword.trim()) return text;
  const escapedKw = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedKw})`, 'gi');
  return text.replace(regex, '<mark class="highlight">$1</mark>');
}

// 判斷並更新「回到最下方按鈕」顯示/隱藏狀態
function updateScrollBottomBtnVisibility() {
  if (!scrollBottomBtn) return;
  // 計算滾動距離，離底部小於 60px 即判定為「已在最下方」
  const threshold = 60;
  const isAtBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - threshold);

  if (isAtBottom) {
    scrollBottomBtn.classList.remove('visible');
  } else {
    scrollBottomBtn.classList.add('visible');
  }
}

// 根據篩選條件過濾並渲染歷史紀錄
function renderHistory() {
  if (allHistory.length === 0) {
    historyContainer.innerHTML = '<div style="text-align: center; color: #888;">目前還沒有任何對話喔！快去跟 Wiki Wiki 聊天吧！</div>';
    filterStatus.innerText = '';
    if (searchActiveDot) searchActiveDot.style.display = 'none';
    if (floatingDatePill) floatingDatePill.classList.remove('visible');
    updateScrollBottomBtnVisibility();
    return;
  }

  const keyword = keywordInput.value.trim().toLowerCase();
  const selectedDate = dateSelect.value;
  const isFiltering = Boolean(keyword || selectedDate);

  if (searchActiveDot) {
    searchActiveDot.style.display = isFiltering ? 'inline' : 'none';
  }

  if (clearKeywordBtn) {
    clearKeywordBtn.style.display = keyword ? 'inline-block' : 'none';
  }

  const filtered = allHistory.filter(item => {
    let matchKeyword = true;
    if (keyword) {
      const msgText = (item.message || '').toLowerCase();
      const roleText = item.role === 'kiwi' ? 'wiki wiki' : '你';
      matchKeyword = msgText.includes(keyword) || roleText.includes(keyword);
    }

    let matchDate = true;
    if (selectedDate) {
      const itemDate = getItemDateStr(item.timestamp);
      matchDate = itemDate === selectedDate;
    }

    return matchKeyword && matchDate;
  });

  // 更新數量統計
  if (isFiltering) {
    filterStatus.innerText = `🔍 找到 ${filtered.length} / ${allHistory.length} 則相關紀錄`;
  } else {
    filterStatus.innerText = `💬 共 ${allHistory.length} 則歷史對話`;
  }

  if (filtered.length === 0) {
    historyContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 30px 0; font-size: 14px;">未找到符合條件的對話紀錄 🔍</div>';
    if (floatingDatePill) floatingDatePill.classList.remove('visible');
    updateScrollBottomBtnVisibility();
    return;
  }

  historyContainer.innerHTML = '';
  let lastDateStr = '';

  filtered.forEach(item => {
    const currentDateStr = getItemDateStr(item.timestamp);

    // 每日日期隔開：當日期變更時，插入 LINE 風格的日期分隔條
    if (currentDateStr && currentDateStr !== lastDateStr) {
      lastDateStr = currentDateStr;
      const dateDivider = document.createElement('div');
      dateDivider.className = 'date-divider';
      dateDivider.dataset.dateText = formatDateHeader(item.timestamp);
      dateDivider.innerHTML = `<span>📅 ${formatDateHeader(item.timestamp)}</span>`;
      historyContainer.appendChild(dateDivider);
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${item.role}`;
    
    const safeText = item.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const highlightedText = highlightKeyword(safeText, keywordInput.value.trim());
    
    let textContent = highlightedText;
    if (item.role === 'kiwi') {
      textContent = `<span style="color: #c97a2e; font-weight: bold;">Wiki Wiki：</span><br/>${highlightedText}`;
    } else {
      textContent = `<strong>你：</strong><br/>${highlightedText}`;
    }

    let timeOnly = item.timestamp || '';
    const timeMatch = timeOnly.match(/\d{1,2}:\d{2}(:\d{2})?/);
    if (timeMatch) {
      timeOnly = timeMatch[0];
    }

    msgDiv.innerHTML = `
      <div>${textContent}</div>
      <div class="timestamp">${timeOnly}</div>
    `;
    historyContainer.appendChild(msgDiv);
  });

  updateScrollBottomBtnVisibility();
}

function loadHistory() {
  if (!fs.existsSync(historyPath)) {
    allHistory = [];
    updateDateSelectOptions();
    renderHistory();
    return;
  }
  try {
    const data = fs.readFileSync(historyPath, 'utf8');
    if (data.trim() !== '') {
      try {
        const decrypted = cryptoUtils.decryptData(data);
        allHistory = JSON.parse(decrypted);
      } catch (e) {
        allHistory = JSON.parse(data);
      }
    } else {
      allHistory = [];
    }
    updateDateSelectOptions();
    renderHistory();
  } catch (err) {
    console.error(err);
    historyContainer.innerHTML = '<div style="text-align: center; color: red;">讀取歷史紀錄失敗 😢</div>';
  }
}

// 智慧型懸浮日期標籤與「回到最下方按鈕」滾動監聽
window.addEventListener('scroll', () => {
  updateScrollBottomBtnVisibility();

  if (!floatingDatePill || !floatingDateText) return;

  const dividers = document.querySelectorAll('.date-divider');
  if (dividers.length === 0) {
    floatingDatePill.classList.remove('visible');
    return;
  }

  const header = document.querySelector('.header');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 90;
  const viewportHeight = window.innerHeight;

  let activeDateText = '';
  let isAnyDividerVisibleInViewport = false;

  dividers.forEach(divider => {
    const rect = divider.getBoundingClientRect();

    // 檢測當前視口畫面中是否直接看得見「日期標題條」
    if (rect.top >= headerBottom - 10 && rect.top <= viewportHeight - 50) {
      isAnyDividerVisibleInViewport = true;
    }

    // 取得滾動在 Header 頂部下方的當前日期段落
    if (rect.top <= headerBottom + 60) {
      activeDateText = divider.dataset.dateText || divider.querySelector('span').innerText;
    }
  });

  // 如果畫面上看得到日期標題，或者未滾動到任何日期標題處 -> 自動淡出隱藏！
  if (isAnyDividerVisibleInViewport || !activeDateText) {
    floatingDatePill.classList.remove('visible');
  } else {
    // 畫面上看不到任何日期標籤時 -> 自動漸出顯示懸浮日期！
    floatingDateText.innerText = activeDateText.startsWith('📅') ? activeDateText : `📅 ${activeDateText}`;
    floatingDatePill.style.top = `${Math.max(10, headerBottom + 12)}px`;
    floatingDatePill.classList.add('visible');

    // 停止滾動 2 秒後淡出
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      floatingDatePill.classList.remove('visible');
    }, 2000);
  }
});

// 監聽關鍵字與日期選項變更
keywordInput.addEventListener('input', () => {
  renderHistory();
});

dateSelect.addEventListener('change', () => {
  renderHistory();
});

if (clearKeywordBtn) {
  clearKeywordBtn.addEventListener('click', () => {
    keywordInput.value = '';
    renderHistory();
    keywordInput.focus();
  });
}

resetFilterBtn.addEventListener('click', () => {
  keywordInput.value = '';
  dateSelect.value = '';
  renderHistory();
});

// 初次載入歷史紀錄並捲動到最底部
loadHistory();
window.scrollTo(0, document.body.scrollHeight);
updateScrollBottomBtnVisibility();

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

// 定時拉取歷史紀錄，當使用者正在搜尋時保持結果不被干擾
setInterval(() => {
  const isFiltering = keywordInput.value.trim() !== '' || dateSelect.value !== '';
  if (!isFiltering) {
    const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10;
    loadHistory();
    if (isAtBottom) {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }
}, 3000);

if (scrollBottomBtn) {
  scrollBottomBtn.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
}
