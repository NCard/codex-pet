require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ipcRenderer } = require('electron');

ipcRenderer.on('reload-data', () => {
  loadAlarms();
});

const { alarmsPath, petStatePath } = require('../../utils/paths');
let alarms = [];
let todos = [];

const btnOpenAdd = document.getElementById('btn-open-add');
const alarmList = document.getElementById('alarm-list');

let isCreatingDraft = false;
let activeEditId = null;

function loadAlarms() {
  if (fs.existsSync(alarmsPath)) {
    try {
      const data = fs.readFileSync(alarmsPath, 'utf8');
      alarms = JSON.parse(data);
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
  
  if (fs.existsSync(petStatePath)) {
    try {
      const petStateData = JSON.parse(fs.readFileSync(petStatePath, 'utf8'));
      todos = petStateData.todos || [];
    } catch (e) {
      todos = [];
    }
  }

  alarms.sort((a, b) => a.time.localeCompare(b.time));
  renderAlarms();
}

function saveAlarms() {
  try {
    fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2), 'utf8');
    ipcRenderer.send('alarms-changed');
  } catch (e) {
    console.error('Failed to save alarms:', e);
  }
}

function createAlarmInlineForm(initialData, isDraft, onSave, onCancel) {
  const formCard = document.createElement('div');
  formCard.className = 'inline-form-card';

  const data = initialData || {
    type: 'date',
    date: new Date().toISOString().split('T')[0],
    time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
    days: [0, 1, 2, 3, 4, 5, 6],
    message: '',
    snoozeInterval: 5
  };

  const [initH, initM] = (data.time || '12:00').split(':');

  formCard.innerHTML = `
    <div class="inline-form-row" style="gap: 20px; font-size: 13px; font-weight: bold;">
      <label style="cursor: pointer;"><input type="radio" class="inline-type-radio" value="date" ${data.type === 'date' ? 'checked' : ''}> 📅 特定日期</label>
      <label style="cursor: pointer;"><input type="radio" class="inline-type-radio" value="weekly" ${data.type === 'weekly' ? 'checked' : ''}> 🔁 每週重複</label>
    </div>

    <div class="inline-date-group" style="display: ${data.type === 'date' ? 'block' : 'none'};">
      <input type="date" class="inline-date-input" value="${data.date || new Date().toISOString().split('T')[0]}" style="width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1.5px solid #c5e1a5; border-radius: 10px; outline: none; font-family: inherit; font-size: 13px;">
    </div>

    <div class="inline-weekly-group" style="display: ${data.type === 'weekly' ? 'block' : 'none'};">
      <div class="days-selector" style="display: flex; gap: 4px; justify-content: space-between;">
        ${['日','一','二','三','四','五','六'].map((day, idx) => `
          <label class="day-chip">
            <input type="checkbox" class="inline-day-cb" value="${idx}" ${(data.days || []).includes(idx) ? 'checked' : ''}>
            <span>${day}</span>
          </label>
        `).join('')}
      </div>
    </div>

    <div class="inline-form-row space-between" style="font-size: 13px;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-weight: bold; color: var(--theme-text-sub);">時間:</span>
        <select class="inline-hour-select" style="padding: 5px 8px; border: 1.5px solid #c5e1a5; border-radius: 10px; outline: none; font-size: 13px; font-weight: bold;"></select>
        <span>:</span>
        <select class="inline-minute-select" style="padding: 5px 8px; border: 1.5px solid #c5e1a5; border-radius: 10px; outline: none; font-size: 13px; font-weight: bold;"></select>
      </div>

      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-weight: bold; color: var(--theme-text-sub);">貪睡:</span>
        <input type="number" class="inline-snooze-input" value="${data.snoozeInterval || 5}" min="1" max="60" style="width: 48px; padding: 4px 6px; border: 1.5px solid #c5e1a5; border-radius: 8px; outline: none; text-align: center; font-size: 13px;">
        <span style="color: var(--theme-text-sub);">分鐘</span>
      </div>
    </div>

    <div class="inline-form-row">
      <input type="text" class="inline-msg-input" placeholder="例如：下班囉！記得打卡！" value="${data.message || ''}" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #c5e1a5; border-radius: 10px; outline: none; font-size: 13px;">
    </div>

    <div class="inline-error-tip"></div>

    <div class="inline-form-row space-between" style="margin-top: 2px;">
      <div class="inline-form-actions" style="margin-left: auto;">
        <button class="btn-cancel">取消</button>
        <button class="btn-confirm">${isDraft ? '➕ 建立' : '💾 儲存'}</button>
      </div>
    </div>
  `;

  const hourSelect = formCard.querySelector('.inline-hour-select');
  const minSelect = formCard.querySelector('.inline-minute-select');
  for (let i = 0; i < 24; i++) {
    const val = i.toString().padStart(2, '0');
    hourSelect.add(new Option(val, val));
  }
  for (let i = 0; i < 60; i++) {
    const val = i.toString().padStart(2, '0');
    minSelect.add(new Option(val, val));
  }
  hourSelect.value = initH;
  minSelect.value = initM;

  const radios = formCard.querySelectorAll('.inline-type-radio');
  const dateGroup = formCard.querySelector('.inline-date-group');
  const weeklyGroup = formCard.querySelector('.inline-weekly-group');
  const errorTip = formCard.querySelector('.inline-error-tip');

  const showError = (msg) => {
    errorTip.textContent = `⚠️ ${msg}`;
    errorTip.style.display = 'block';
    setTimeout(() => { errorTip.style.display = 'none'; }, 3000);
  };

  radios.forEach(r => r.addEventListener('change', () => {
    if (r.value === 'date') {
      dateGroup.style.display = 'block';
      weeklyGroup.style.display = 'none';
    } else {
      dateGroup.style.display = 'none';
      weeklyGroup.style.display = 'block';
    }
  }));

  formCard.querySelector('.btn-confirm').onclick = () => {
    const selectedType = formCard.querySelector('.inline-type-radio:checked').value;
    const time = `${hourSelect.value}:${minSelect.value}`;
    const msg = formCard.querySelector('.inline-msg-input').value.trim();
    const snooze = parseInt(formCard.querySelector('.inline-snooze-input').value, 10) || 5;
    const dateVal = formCard.querySelector('.inline-date-input').value;

    let days = [];
    if (selectedType === 'weekly') {
      formCard.querySelectorAll('.inline-day-cb').forEach(cb => {
        if (cb.checked) days.push(parseInt(cb.value, 10));
      });
      if (days.length === 0) {
        showError('每週重複模式必須至少選擇一天！');
        return;
      }
    } else {
      if (!dateVal) {
        showError('請選擇特定日期！');
        return;
      }
    }

    if (!msg) {
      showError('請輸入提醒內容！');
      return;
    }

    onSave({
      type: selectedType,
      time: time,
      date: dateVal,
      days: days,
      message: msg,
      snoozeInterval: snooze
    });
  };

  const msgInputEl = formCard.querySelector('.inline-msg-input');
  msgInputEl.onmousedown = (e) => {
    e.stopPropagation();
  };
  msgInputEl.onclick = () => {
    msgInputEl.focus();
  };
  msgInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formCard.querySelector('.btn-confirm').click();
    }
  });

  formCard.querySelector('.btn-cancel').onclick = () => {
    onCancel();
  };

  setTimeout(() => {
    window.focus();
    msgInputEl.focus();
  }, 50);

  return formCard;
}

function renderAlarms() {
  alarmList.innerHTML = '';

  if (isCreatingDraft) {
    const draftForm = createAlarmInlineForm(null, true, (newAlarmData) => {
      alarms.push({
        id: crypto.randomUUID(),
        enabled: true,
        ...newAlarmData
      });
      saveAlarms();
      isCreatingDraft = false;
      loadAlarms();
    }, () => {
      isCreatingDraft = false;
      renderAlarms();
    });
    alarmList.appendChild(draftForm);
  }
  
  if (alarms.length === 0 && !isCreatingDraft) {
    alarmList.innerHTML = '<div class="empty-state">還沒有設定任何提醒喔！<br>點擊右上角「➕ 新增」建立第一個提醒吧！</div>';
    return;
  }

  alarms.forEach(alarm => {
    if (activeEditId === alarm.id) {
      const editForm = createAlarmInlineForm(alarm, false, (updatedData) => {
        Object.assign(alarm, updatedData);
        saveAlarms();
        activeEditId = null;
        loadAlarms();
      }, () => {
        activeEditId = null;
        renderAlarms();
      });
      alarmList.appendChild(editForm);
      return;
    }

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
    
    let linkedTodoHtml = '';
    let linkedTodo = todos.find(t => (t.linkedAlarmId && t.linkedAlarmId === alarm.id) || (alarm.linkedTodoId && alarm.linkedTodoId === t.id));
    if (!linkedTodo) {
      linkedTodo = todos.find(t => alarm.message === t.text || alarm.message === `📋 待辦提醒：${t.text}`);
    }

    if (linkedTodo) {
      linkedTodoHtml = `<button class="linked-badge todo-link-btn" title="點擊前往待辦事項視窗" onclick="ipcRenderer.send('open-todo')">🔗</button>`;
    }

    const displayMsg = alarm.message.replace(/^📋 待辦提醒：/, '');

    msgDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #00796b; font-weight: bold;">
        <span>${typeText}</span>
        ${linkedTodoHtml}
      </div>
      <div style="font-size: 13px; color: var(--theme-text-body); margin-top: 3px; line-height: 1.3;">${displayMsg}</div>
      <div style="font-size: 11px; color: #888; margin-top: 2px;">(貪睡: ${alarm.snoozeInterval || 5} 分鐘)</div>
    `;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'alarm-actions';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-toggle' + (alarm.enabled ? '' : ' disabled');
    toggleBtn.innerHTML = alarm.enabled ? '<i class="theme-icon icon-bell"></i>' : '🔕';
    toggleBtn.title = alarm.enabled ? '停用' : '啟用';
    toggleBtn.onclick = () => {
      alarm.enabled = !alarm.enabled;
      saveAlarms();
      renderAlarms();
    };
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.innerHTML = '✏️';
    editBtn.title = '編輯';
    editBtn.onclick = () => {
      activeEditId = alarm.id;
      isCreatingDraft = false;
      renderAlarms();
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '<i class="theme-icon icon-trash"></i>';
    deleteBtn.title = '刪除';
    deleteBtn.onclick = () => {
      actionsDiv.innerHTML = `
        <span style="font-size:11px; color:#e53935; font-weight:bold;">確定刪除？</span>
        <button class="btn-confirm-del" style="padding:3px 8px; background:#e53935; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:11px; font-weight:bold;">刪除</button>
        <button class="btn-cancel-del" style="padding:3px 8px; background:#eee; border:none; border-radius:8px; cursor:pointer; font-size:11px;">取消</button>
      `;
      actionsDiv.querySelector('.btn-confirm-del').onclick = () => {
        alarms = alarms.filter(a => a.id !== alarm.id);
        if (activeEditId === alarm.id) activeEditId = null;
        saveAlarms();
        renderAlarms();
      };
      actionsDiv.querySelector('.btn-cancel-del').onclick = () => {
        renderAlarms();
      };
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

btnOpenAdd.onclick = () => {
  isCreatingDraft = true;
  activeEditId = null;
  renderAlarms();
  window.focus();
};

loadAlarms();
