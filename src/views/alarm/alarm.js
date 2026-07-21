require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ipcRenderer } = require('electron');

ipcRenderer.on('reload-data', () => {
  loadAlarms();
});

const alarmsPath = path.join(__dirname, '../../../data/alarms.json');
let alarms = [];

const timeInput = document.getElementById('alarm-time');
const msgInput = document.getElementById('alarm-message');
const snoozeInput = document.getElementById('alarm-snooze');
const addBtn = document.getElementById('add-alarm-btn');
const alarmList = document.getElementById('alarm-list');
let editingId = null;

function loadAlarms() {
  if (fs.existsSync(alarmsPath)) {
    try {
      const data = fs.readFileSync(alarmsPath, 'utf8');
      alarms = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse alarms:', e);
      alarms = [];
    }
  } else {
    alarms = [];
  }
  
  // Sort alarms by time
  alarms.sort((a, b) => a.time.localeCompare(b.time));
  renderAlarms();
}

function saveAlarms() {
  try {
    fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save alarms:', e);
  }
}

function renderAlarms() {
  alarmList.innerHTML = '';
  
  if (alarms.length === 0) {
    alarmList.innerHTML = '<div class="empty-state">還沒有設定任何提醒喔！<br>趕快在上方新增一個吧！</div>';
    return;
  }

  alarms.forEach(alarm => {
    const item = document.createElement('div');
    item.className = 'alarm-item' + (alarm.enabled ? '' : ' disabled');
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'alarm-time';
    timeDiv.textContent = alarm.time;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'alarm-msg';
    msgDiv.innerHTML = `${alarm.message}<br><span style="font-size: 12px; color: #888;">(貪睡: ${alarm.snoozeInterval || 5} 分鐘)</span>`;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'alarm-actions';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-toggle';
    toggleBtn.textContent = alarm.enabled ? '🔔' : '🔕';
    toggleBtn.title = alarm.enabled ? '停用' : '啟用';
    toggleBtn.onclick = () => {
      alarm.enabled = !alarm.enabled;
      saveAlarms();
      renderAlarms();
    };
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-toggle';
    editBtn.textContent = '✏️';
    editBtn.title = '編輯';
    editBtn.onclick = () => {
      editingId = alarm.id;
      timeInput.value = alarm.time;
      msgInput.value = alarm.message;
      snoozeInput.value = alarm.snoozeInterval || 5;
      addBtn.textContent = '💾 儲存';
      addBtn.style.background = '#4caf50';
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = '刪除';
    deleteBtn.onclick = () => {
      if (confirm(`確定要刪除「${alarm.time}」的提醒嗎？`)) {
        alarms = alarms.filter(a => a.id !== alarm.id);
        if (editingId === alarm.id) {
          editingId = null;
          addBtn.textContent = '➕ 新增提醒';
          addBtn.style.background = '#ff9800';
          timeInput.value = '';
          msgInput.value = '';
        }
        saveAlarms();
        renderAlarms();
      }
    };
    
    actionsDiv.appendChild(toggleBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    item.appendChild(timeDiv);
    item.appendChild(msgDiv);
    item.appendChild(actionsDiv);
    
    alarmList.appendChild(item);
  });
}

addBtn.onclick = () => {
  const time = timeInput.value;
  const msg = msgInput.value.trim();
  const snooze = parseInt(snoozeInput.value, 10) || 5;
  
  if (!time) {
    alert('請選擇時間！');
    return;
  }
  
  if (!msg) {
    alert('請輸入提醒內容！');
    return;
  }
  
  if (editingId) {
    const alarm = alarms.find(a => a.id === editingId);
    if (alarm) {
      alarm.time = time;
      alarm.message = msg;
      alarm.snoozeInterval = snooze;
    }
    editingId = null;
    addBtn.textContent = '➕ 新增提醒';
    addBtn.style.background = '#ff9800';
  } else {
    alarms.push({
      id: crypto.randomUUID(),
      time: time,
      message: msg,
      snoozeInterval: snooze,
      enabled: true
    });
  }
  
  saveAlarms();
  timeInput.value = '';
  msgInput.value = '';
  snoozeInput.value = '5';
  loadAlarms();
};

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addBtn.click();
  }
});

// Initial load
loadAlarms();
