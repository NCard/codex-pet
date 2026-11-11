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

function getNowLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return {
    todayStr: `${year}-${month}-${day}`,
    currentTimeStr: `${hours}:${minutes}`,
    currentH: hours,
    currentM: minutes
  };
}

function parseTimeString(str) {
  if (!str) return null;
  const trimmed = str.trim();
  let h, m;
  const colonMatch = trimmed.match(/^(\d{1,2})[:：](\d{1,2})$/);
  if (colonMatch) {
    h = parseInt(colonMatch[1], 10);
    m = parseInt(colonMatch[2], 10);
  } else {
    const numMatch = trimmed.match(/^(\d{1,2})(\d{2})$/);
    if (numMatch) {
      h = parseInt(numMatch[1], 10);
      m = parseInt(numMatch[2], 10);
    }
  }
  if (h !== undefined && m !== undefined && h >= 0 && h < 24 && m >= 0 && m < 60) {
    const formattedH = h.toString().padStart(2, '0');
    const formattedM = m.toString().padStart(2, '0');
    return {
      h: formattedH,
      m: formattedM,
      formatted: `${formattedH}:${formattedM}`
    };
  }
  return null;
}

function notifyAlarmEnabled(alarm) {
  ipcRenderer.send('alarm-enabled-notify', {
    id: alarm.id,
    type: alarm.type,
    time: alarm.time,
    date: alarm.date,
    days: alarm.days,
    message: alarm.message
  });
}

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

  const { todayStr, currentTimeStr } = getNowLocal();

  const data = initialData ? { ...initialData } : {
    type: 'date',
    date: todayStr,
    time: currentTimeStr,
    days: [0, 1, 2, 3, 4, 5, 6],
    message: '',
    snoozeInterval: 5
  };

  // 需求 4：若編輯時原本是過去時間，自動預設為當下時間
  if (data.type === 'date') {
    const isPast = (data.date < todayStr) || (data.date === todayStr && (data.time || '') < currentTimeStr);
    if (isPast) {
      data.date = todayStr;
      data.time = currentTimeStr;
    }
  }

  const [initH, initM] = (data.time || currentTimeStr).split(':');

  formCard.innerHTML = `
    <div class="inline-form-row" style="gap: 20px; font-size: 13px; font-weight: bold;">
      <label style="cursor: pointer;"><input type="radio" class="inline-type-radio" value="date" ${data.type === 'date' ? 'checked' : ''}> 📅 特定日期</label>
      <label style="cursor: pointer;"><input type="radio" class="inline-type-radio" value="weekly" ${data.type === 'weekly' ? 'checked' : ''}> 🔁 每週重複</label>
    </div>

    <div class="inline-date-group" style="display: ${data.type === 'date' ? 'block' : 'none'};">
      <input type="date" class="inline-date-input" min="${todayStr}" value="${data.date || todayStr}" style="width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1.5px solid #c5e1a5; border-radius: 10px; outline: none; font-family: inherit; font-size: 13px;">
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

    <div class="inline-form-row space-between" style="font-size: 13px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-weight: bold; color: var(--theme-text-sub);">時間:</span>
        <div class="time-combobox-wrapper">
          <div class="time-combobox-field">
            <span class="time-combobox-icon">⏰</span>
            <input type="text" class="inline-time-input" placeholder="HH:mm" maxlength="5" value="${initH}:${initM}" title="可直接鍵盤輸入 (例如 08:30)，或點右側下拉選擇">
            <button type="button" class="btn-time-dropdown" title="展開時間選擇選單">▾</button>
          </div>
          
          <div class="time-dropdown-popover" style="display: none;">
            <div class="time-picker-columns">
              <div class="time-picker-col">
                <span class="time-col-label">時</span>
                <select class="inline-hour-select" size="6"></select>
              </div>
              <span class="time-colon">:</span>
              <div class="time-picker-col">
                <span class="time-col-label">分</span>
                <select class="inline-minute-select" size="6"></select>
              </div>
            </div>
            <div class="time-picker-quick">
              <button type="button" class="btn-quick-time" data-offset="0">現在</button>
              <button type="button" class="btn-quick-time" data-offset="15">+15分</button>
              <button type="button" class="btn-quick-time" data-offset="30">+30分</button>
              <button type="button" class="btn-quick-time" data-offset="60">+1小時</button>
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-weight: bold; color: var(--theme-text-sub);">貪睡:</span>
        <input type="number" class="inline-snooze-input" value="${data.snoozeInterval || 5}" min="1" max="60" style="width: 44px; padding: 4px 6px; border: 1.5px solid #c5e1a5; border-radius: 8px; outline: none; text-align: center; font-size: 13px;">
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
  const timeInput = formCard.querySelector('.inline-time-input');
  const dateInput = formCard.querySelector('.inline-date-input');

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

  const comboboxWrapper = formCard.querySelector('.time-combobox-wrapper');
  const comboboxField = formCard.querySelector('.time-combobox-field');
  const btnToggleDropdown = formCard.querySelector('.btn-time-dropdown');
  const timePopover = formCard.querySelector('.time-dropdown-popover');

  if (comboboxField) {
    comboboxField.addEventListener('click', (e) => {
      if (e.target !== btnToggleDropdown && !btnToggleDropdown.contains(e.target)) {
        timeInput.focus();
      }
    });
  }

  function togglePopover(show) {
    const shouldShow = (typeof show === 'boolean') ? show : (timePopover.style.display === 'none');
    timePopover.style.display = shouldShow ? 'flex' : 'none';
    btnToggleDropdown.classList.toggle('active', shouldShow);
    if (shouldShow) {
      if (typeof comboboxWrapper.getBoundingClientRect === 'function') {
        const rect = comboboxWrapper.getBoundingClientRect();
        const popoverHeight = 190;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
          timePopover.style.top = 'auto';
          timePopover.style.bottom = 'calc(100% + 6px)';
        } else {
          timePopover.style.top = 'calc(100% + 6px)';
          timePopover.style.bottom = 'auto';
        }
      }
      updateTimeRestrictions(false);
    }
  }

  btnToggleDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });

  timeInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const onDocClick = (e) => {
    if (comboboxWrapper && !comboboxWrapper.contains(e.target)) {
      togglePopover(false);
    }
  };
  document.addEventListener('click', onDocClick);

  // 快速時間選擇按鈕 (+15分, +30分, +1小時, 現在)
  const quickBtns = formCard.querySelectorAll('.btn-quick-time');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const offsetMins = parseInt(btn.dataset.offset, 10);
      const targetDate = new Date();
      if (offsetMins > 0) {
        targetDate.setMinutes(targetDate.getMinutes() + offsetMins);
      }
      const hStr = targetDate.getHours().toString().padStart(2, '0');
      const mStr = targetDate.getMinutes().toString().padStart(2, '0');
      hourSelect.value = hStr;
      minSelect.value = mStr;
      timeInput.value = `${hStr}:${mStr}`;
      updateTimeRestrictions(false);
      togglePopover(false);
    });
  });

  function updateTimeRestrictions(skipTimeInputSync = false) {
    const currentNow = getNowLocal();
    const selectedType = formCard.querySelector('.inline-type-radio:checked').value;
    const isDateMode = selectedType === 'date';

    dateInput.min = currentNow.todayStr;
    if (isDateMode && dateInput.value < currentNow.todayStr) {
      dateInput.value = currentNow.todayStr;
    }

    const isToday = isDateMode && (dateInput.value === currentNow.todayStr);
    const curHInt = parseInt(currentNow.currentH, 10);
    const curMInt = parseInt(currentNow.currentM, 10);

    Array.from(hourSelect.options).forEach(opt => {
      const hVal = parseInt(opt.value, 10);
      opt.disabled = isToday && (hVal < curHInt);
    });

    if (isToday && parseInt(hourSelect.value, 10) < curHInt) {
      hourSelect.value = currentNow.currentH;
    }

    const selectedHInt = parseInt(hourSelect.value, 10);
    Array.from(minSelect.options).forEach(opt => {
      const mVal = parseInt(opt.value, 10);
      opt.disabled = isToday && (selectedHInt === curHInt) && (mVal < curMInt);
    });

    if (isToday && (selectedHInt === curHInt) && parseInt(minSelect.value, 10) < curMInt) {
      minSelect.value = currentNow.currentM;
    }

    if (!skipTimeInputSync) {
      timeInput.value = `${hourSelect.value}:${minSelect.value}`;
    }
  }

  // 套用初始時間限制
  updateTimeRestrictions(false);

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
    updateTimeRestrictions(false);
  }));

  dateInput.addEventListener('change', () => {
    updateTimeRestrictions(false);
  });

  hourSelect.addEventListener('change', () => {
    updateTimeRestrictions(false);
  });

  minSelect.addEventListener('change', () => {
    timeInput.value = `${hourSelect.value}:${minSelect.value}`;
  });

  // 需求 3：手動輸入時間即時連動
  timeInput.addEventListener('input', () => {
    const parsed = parseTimeString(timeInput.value);
    if (parsed) {
      hourSelect.value = parsed.h;
      minSelect.value = parsed.m;
      updateTimeRestrictions(true);
    }
  });

  timeInput.addEventListener('blur', () => {
    const parsed = parseTimeString(timeInput.value);
    if (parsed) {
      hourSelect.value = parsed.h;
      minSelect.value = parsed.m;
      updateTimeRestrictions(false);
    } else {
      timeInput.value = `${hourSelect.value}:${minSelect.value}`;
    }
  });

  timeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formCard.querySelector('.btn-confirm').click();
    }
  });

  formCard.querySelector('.btn-confirm').onclick = () => {
    const selectedType = formCard.querySelector('.inline-type-radio:checked').value;
    const parsed = parseTimeString(timeInput.value);
    let time = `${hourSelect.value}:${minSelect.value}`;
    if (parsed) {
      time = parsed.formatted;
      hourSelect.value = parsed.h;
      minSelect.value = parsed.m;
    } else {
      showError('請輸入正確的時間格式（例如 08:30）！');
      return;
    }

    const msg = formCard.querySelector('.inline-msg-input').value.trim();
    const snooze = parseInt(formCard.querySelector('.inline-snooze-input').value, 10) || 5;
    const dateVal = dateInput.value;

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

      // 需求 4 檢核：不可選擇過去日期或當日過去時間
      const currentNow = getNowLocal();
      if (dateVal < currentNow.todayStr) {
        showError('特定日期不能選擇過去的日期！');
        return;
      }
      if (dateVal === currentNow.todayStr && time < currentNow.currentTimeStr) {
        showError('特定日期的鬧鐘時間不能早於當下時間！');
        return;
      }
    }

    if (!msg) {
      showError('請輸入提醒內容！');
      return;
    }

    document.removeEventListener('click', onDocClick);
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
    document.removeEventListener('click', onDocClick);
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
      const newAlarm = {
        id: crypto.randomUUID(),
        enabled: true,
        ...newAlarmData
      };
      alarms.push(newAlarm);
      saveAlarms();
      isCreatingDraft = false;
      notifyAlarmEnabled(newAlarm);
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
        if (alarm.enabled) {
          notifyAlarmEnabled(alarm);
        }
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
    
    // 需求 1：開關改為 switch 按鈕
    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';
    switchLabel.title = alarm.enabled ? '點擊停用鬧鐘' : '點擊啟用鬧鐘';

    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.className = 'alarm-switch-input';
    switchInput.checked = !!alarm.enabled;

    const switchSlider = document.createElement('span');
    switchSlider.className = 'slider';

    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(switchSlider);

    switchInput.onchange = () => {
      const willEnable = switchInput.checked;
      if (willEnable) {
        // 若特定日期為過去時間，自動更新為當下時間
        if (alarm.type === 'date') {
          const currentNow = getNowLocal();
          const isPast = (alarm.date < currentNow.todayStr) || (alarm.date === currentNow.todayStr && alarm.time < currentNow.currentTimeStr);
          if (isPast) {
            alarm.date = currentNow.todayStr;
            alarm.time = currentNow.currentTimeStr;
          }
        }
        alarm.enabled = true;
        saveAlarms();
        // 需求 2：鬧鐘啟用時通報
        notifyAlarmEnabled(alarm);
      } else {
        alarm.enabled = false;
        saveAlarms();
      }
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
    
    actionsDiv.appendChild(switchLabel);
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
