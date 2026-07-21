const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const alarmsPath = path.join(__dirname, '../alarms.json');
let alarms = [];

const timeInput = document.getElementById('alarm-time');
const msgInput = document.getElementById('alarm-message');
const addBtn = document.getElementById('add-alarm-btn');
const alarmList = document.getElementById('alarm-list');

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
    msgDiv.textContent = alarm.message;
    
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
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = '刪除';
    deleteBtn.onclick = () => {
      if (confirm(`確定要刪除「${alarm.time}」的提醒嗎？`)) {
        alarms = alarms.filter(a => a.id !== alarm.id);
        saveAlarms();
        renderAlarms();
      }
    };
    
    actionsDiv.appendChild(toggleBtn);
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
  
  if (!time) {
    alert('請選擇時間！');
    return;
  }
  
  if (!msg) {
    alert('請輸入提醒內容！');
    return;
  }
  
  alarms.push({
    id: crypto.randomUUID(),
    time: time,
    message: msg,
    enabled: true
  });
  
  saveAlarms();
  timeInput.value = '';
  msgInput.value = '';
  loadAlarms();
};

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addBtn.click();
  }
});

// Initial load
loadAlarms();
