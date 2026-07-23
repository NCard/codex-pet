require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ipcRenderer } = require('electron');

ipcRenderer.on('reload-data', () => {
  loadAlarms();
});

const { alarmsPath } = require('../../utils/paths');
let alarms = [];

const hourSelect = document.getElementById('alarm-hour');
const minuteSelect = document.getElementById('alarm-minute');
const dateInput = document.getElementById('alarm-date');
const msgInput = document.getElementById('alarm-message');
const snoozeInput = document.getElementById('alarm-snooze');
const addBtn = document.getElementById('add-alarm-btn');
const alarmList = document.getElementById('alarm-list');
const typeRadios = document.getElementsByName('alarm-type');
const dateGroup = document.getElementById('date-group');
const weeklyGroup = document.getElementById('weekly-group');
const dayCheckboxes = document.querySelectorAll('.days-selector input[type="checkbox"]');

let editingId = null;

// Toggle UI based on type
function updateTypeUI() {
  const selectedType = document.querySelector('input[name="alarm-type"]:checked').value;
  if (selectedType === 'date') {
    dateGroup.style.display = 'flex';
    weeklyGroup.style.display = 'none';
  } else {
    dateGroup.style.display = 'none';
    weeklyGroup.style.display = 'block';
  }
}

typeRadios.forEach(radio => radio.addEventListener('change', updateTypeUI));
// Initialize UI
updateTypeUI();

// Initialize Time Options
for(let i=0; i<24; i++) {
  const val = i.toString().padStart(2, '0');
  hourSelect.add(new Option(val, val));
}
for(let i=0; i<60; i++) {
  const val = i.toString().padStart(2, '0');
  minuteSelect.add(new Option(val, val));
}

// Set default date and time to now
const now = new Date();
dateInput.value = now.toISOString().split('T')[0];
hourSelect.value = now.getHours().toString().padStart(2, '0');
minuteSelect.value = now.getMinutes().toString().padStart(2, '0');

function loadAlarms() {
  if (fs.existsSync(alarmsPath)) {
    try {
      const data = fs.readFileSync(alarmsPath, 'utf8');
      alarms = JSON.parse(data);
      // Migrate old alarms
      alarms.forEach(a => {
        if (!a.type) {
          a.type = 'weekly';
          a.days = [0, 1, 2, 3, 4, 5, 6];
        }
      });
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
    
    let typeText = '';
    if (alarm.type === 'date') {
      typeText = `📅 ${alarm.date}`;
    } else {
      if (alarm.days.length === 7) {
        typeText = '🔁 每天';
      } else {
        const dayMap = ['日','一','二','三','四','五','六'];
        typeText = '🔁 每週 ' + alarm.days.map(d => dayMap[d]).join(', ');
      }
    }
    
    msgDiv.innerHTML = `<span style="font-size:12px; color:#00796b; font-weight:bold;">${typeText}</span><br>${alarm.message}<br><span style="font-size: 12px; color: #888;">(貪睡: ${alarm.snoozeInterval || 5} 分鐘)</span>`;
    
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
      const [h, m] = alarm.time.split(':');
      hourSelect.value = h;
      minuteSelect.value = m;
      msgInput.value = alarm.message;
      snoozeInput.value = alarm.snoozeInterval || 5;
      
      document.querySelector(`input[name="alarm-type"][value="${alarm.type}"]`).checked = true;
      updateTypeUI();
      
      if (alarm.type === 'date') {
        dateInput.value = alarm.date;
      } else {
        dayCheckboxes.forEach(cb => {
          cb.checked = alarm.days.includes(parseInt(cb.value));
        });
      }
      
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
  const selectedType = document.querySelector('input[name="alarm-type"]:checked').value;
  const time = `${hourSelect.value}:${minuteSelect.value}`;
  const msg = msgInput.value.trim();
  const snooze = parseInt(snoozeInput.value, 10) || 5;
  const dateVal = dateInput.value;
  
  let days = [];
  if (selectedType === 'weekly') {
    dayCheckboxes.forEach(cb => {
      if (cb.checked) days.push(parseInt(cb.value));
    });
    if (days.length === 0) {
      alert('每週重複模式必須至少選擇一天！');
      return;
    }
  } else {
    if (!dateVal) {
      alert('請選擇特定日期！');
      return;
    }
  }
  
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
      alarm.type = selectedType;
      alarm.time = time;
      alarm.date = dateVal;
      alarm.days = days;
      alarm.message = msg;
      alarm.snoozeInterval = snooze;
    }
    editingId = null;
    addBtn.textContent = '➕ 新增提醒';
    addBtn.style.background = '#ff9800';
  } else {
    alarms.push({
      id: crypto.randomUUID(),
      type: selectedType,
      time: time,
      date: dateVal,
      days: days,
      message: msg,
      snoozeInterval: snooze,
      enabled: true
    });
  }
  
  saveAlarms();
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
