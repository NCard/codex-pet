require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ipcRenderer } = require('electron');

ipcRenderer.on('reload-data', () => {
  loadTodos();
});

const { petStatePath: statePath, alarmsPath } = require('../../utils/paths');
let petState = { todos: [] };
let alarms = [];

const btnOpenAdd = document.getElementById('btn-open-add');
const todoList = document.getElementById('todo-list');

let isCreatingDraft = false;
let activeEditId = null;

function loadTodos() {
  if (fs.existsSync(alarmsPath)) {
    try {
      alarms = JSON.parse(fs.readFileSync(alarmsPath, 'utf8'));
    } catch(e) { alarms = []; }
  } else {
    alarms = [];
  }

  if (fs.existsSync(statePath)) {
    try {
      const data = fs.readFileSync(statePath, 'utf8');
      petState = JSON.parse(data);
      if (!petState.todos) petState.todos = [];
    } catch (e) {
      console.error('Failed to parse pet state:', e);
      petState = { todos: [] };
    }
  } else {
    petState = { todos: [] };
  }
  renderTodos();
}

function saveAlarms() {
  try {
    fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save alarms:', e);
  }
}

function saveTodos() {
  try {
    fs.writeFileSync(statePath, JSON.stringify(petState, null, 2), 'utf8');
    ipcRenderer.send('pet-state-changed');
  } catch (e) {
    console.error('Failed to save pet state:', e);
  }
}

function createTodoInlineForm(initialTodo, initialAlarm, isDraft, onSave, onCancel) {
  const formCard = document.createElement('div');
  formCard.className = 'inline-form-card';

  const todoText = initialTodo ? initialTodo.text : '';
  const hasAlarm = Boolean(initialAlarm);
  const alarmData = initialAlarm || {
    type: 'date',
    date: new Date().toISOString().split('T')[0],
    time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
    days: [0, 1, 2, 3, 4, 5, 6],
    snoozeInterval: 5
  };

  const [initH, initM] = (alarmData.time || '12:00').split(':');

  formCard.innerHTML = `
    <div class="inline-form-row">
      <textarea class="inline-todo-text" placeholder="例如：明天早上 9 點開會 (可按 Shift+Enter 換行)" rows="2" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1.5px solid #c5e1a5; border-radius: 12px; outline: none; font-family: inherit; font-size: 13px; resize: vertical;">${todoText}</textarea>
    </div>

    <div class="inline-form-row">
      <label style="font-size: 13px; font-weight: bold; color: var(--theme-text-sub); cursor: pointer; display: flex; align-items: center; gap: 6px;">
        <input type="checkbox" class="inline-has-alarm-cb" ${hasAlarm ? 'checked' : ''}> <span><i class="theme-icon icon-bell" style="width: 16px; height: 16px;"></i> 加上提醒 (建立鬧鐘)</span>
      </label>
    </div>

    <div class="inline-alarm-settings" style="display: ${hasAlarm ? 'flex' : 'none'}; flex-direction: column; gap: 8px; width: 100%; background: #f9fbf7; padding: 10px 12px; border-radius: 12px; border: 1px solid #c5e1a5; box-sizing: border-box;">
      <div class="inline-form-row" style="gap: 15px; font-size: 12px; font-weight: bold;">
        <label style="cursor: pointer;"><input type="radio" class="inline-alarm-type" name="inline-alarm-type-${Math.random()}" value="date" ${alarmData.type === 'date' ? 'checked' : ''}> 📅 特定日期</label>
        <label style="cursor: pointer;"><input type="radio" class="inline-alarm-type" name="inline-alarm-type-${Math.random()}" value="weekly" ${alarmData.type === 'weekly' ? 'checked' : ''}> 🔁 每週重複</label>
      </div>

      <div class="inline-date-group" style="display: ${alarmData.type === 'date' ? 'block' : 'none'};">
        <input type="date" class="inline-date-input" value="${alarmData.date || new Date().toISOString().split('T')[0]}" style="width: 100%; box-sizing: border-box; padding: 4px 8px; border: 1.5px solid #c5e1a5; border-radius: 8px; outline: none; font-family: inherit; font-size: 12px;">
      </div>

      <div class="inline-weekly-group" style="display: ${alarmData.type === 'weekly' ? 'block' : 'none'};">
        <div class="days-selector" style="display: flex; gap: 4px; justify-content: space-between;">
          ${['日','一','二','三','四','五','六'].map((day, idx) => `
            <label class="day-chip">
              <input type="checkbox" class="inline-day-cb" value="${idx}" ${(alarmData.days || []).includes(idx) ? 'checked' : ''}>
              <span>${day}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="inline-form-row space-between" style="font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-weight: bold; color: var(--theme-text-sub);">時間:</span>
          <select class="inline-hour-select" style="padding: 4px 6px; border: 1.5px solid #c5e1a5; border-radius: 8px; outline: none; font-size: 12px; font-weight: bold;"></select>
          <span>:</span>
          <select class="inline-minute-select" style="padding: 4px 6px; border: 1.5px solid #c5e1a5; border-radius: 8px; outline: none; font-size: 12px; font-weight: bold;"></select>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="color: var(--theme-text-sub); font-weight: bold;">貪睡:</span>
          <input type="number" class="inline-snooze-input" value="${alarmData.snoozeInterval || 5}" min="1" max="60" style="width: 45px; padding: 3px 5px; border: 1.5px solid #c5e1a5; border-radius: 6px; outline: none; font-size: 12px; text-align: center;">
          <span style="color: var(--theme-text-sub);">分鐘</span>
        </div>
      </div>
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

  const hasAlarmCb = formCard.querySelector('.inline-has-alarm-cb');
  const alarmSettingsPanel = formCard.querySelector('.inline-alarm-settings');
  const errorTip = formCard.querySelector('.inline-error-tip');

  const showError = (msg) => {
    errorTip.textContent = `⚠️ ${msg}`;
    errorTip.style.display = 'block';
    setTimeout(() => { errorTip.style.display = 'none'; }, 3000);
  };

  hasAlarmCb.addEventListener('change', () => {
    alarmSettingsPanel.style.display = hasAlarmCb.checked ? 'flex' : 'none';
  });

  const radios = formCard.querySelectorAll('.inline-alarm-type');
  const dateGroup = formCard.querySelector('.inline-date-group');
  const weeklyGroup = formCard.querySelector('.inline-weekly-group');

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
    const text = formCard.querySelector('.inline-todo-text').value.trim();
    if (!text) {
      showError('請輸入待辦事項內容！');
      return;
    }

    let alarmDataOut = null;
    if (hasAlarmCb.checked) {
      const type = formCard.querySelector('.inline-alarm-type:checked').value;
      const time = `${hourSelect.value}:${minSelect.value}`;
      const snooze = parseInt(formCard.querySelector('.inline-snooze-input').value, 10) || 5;
      const dateVal = formCard.querySelector('.inline-date-input').value;

      let days = [];
      if (type === 'weekly') {
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

      alarmDataOut = {
        type: type,
        time: time,
        date: dateVal,
        days: days,
        snoozeInterval: snooze
      };
    }

    onSave({ text, alarmData: alarmDataOut });
  };

  const todoInputEl = formCard.querySelector('.inline-todo-text');
  todoInputEl.onmousedown = (e) => {
    e.stopPropagation();
  };
  todoInputEl.onclick = () => {
    todoInputEl.focus();
  };
  todoInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formCard.querySelector('.btn-confirm').click();
    }
  });

  formCard.querySelector('.btn-cancel').onclick = () => {
    onCancel();
  };

  setTimeout(() => {
    window.focus();
    todoInputEl.focus();
  }, 50);

  return formCard;
}

function renderTodos() {
  todoList.innerHTML = '';

  // 頂部新增草稿窗
  if (isCreatingDraft) {
    const draftForm = createTodoInlineForm(null, null, true, ({ text, alarmData }) => {
      petState.todos.forEach(t => { if(!t.id) t.id = crypto.randomUUID(); });
      const newTodoId = crypto.randomUUID();
      const newTodo = {
        id: newTodoId,
        text: text,
        done: false
      };

      if (alarmData) {
        const newAlarmId = crypto.randomUUID();
        newTodo.linkedAlarmId = newAlarmId;
        alarms.push({
          id: newAlarmId,
          linkedTodoId: newTodoId,
          message: `📋 待辦提醒：${text}`,
          enabled: true,
          ...alarmData
        });
        saveAlarms();
      }

      petState.todos.push(newTodo);
      saveTodos();
      isCreatingDraft = false;
      loadTodos();
    }, () => {
      isCreatingDraft = false;
      renderTodos();
    });

    todoList.appendChild(draftForm);
  }

  if (petState.todos.length === 0 && !isCreatingDraft) {
    todoList.innerHTML = '<div class="empty-state">目前沒有任何待辦事項喔！<br>點擊右上角「➕ 新增」建立第一個待辦吧！</div>';
    return;
  }

  petState.todos.forEach(todo => {
    if (!todo.id) todo.id = crypto.randomUUID();

    // 尋找綁定鬧鐘
    let linkedAlarm = null;
    if (todo.linkedAlarmId) {
      linkedAlarm = alarms.find(a => a.id === todo.linkedAlarmId);
    }
    if (!linkedAlarm) {
      linkedAlarm = alarms.find(a => a.linkedTodoId === todo.id || a.message === todo.text || a.message === `📋 待辦提醒：${todo.text}`);
      if (linkedAlarm) {
        todo.linkedAlarmId = linkedAlarm.id;
        linkedAlarm.linkedTodoId = todo.id;
      }
    }

    // 若該待辦正在編輯中，替換渲染為編輯表單
    if (activeEditId === todo.id) {
      const editForm = createTodoInlineForm(todo, linkedAlarm, false, ({ text, alarmData }) => {
        todo.text = text;

        if (alarmData) {
          if (todo.linkedAlarmId) {
            const alarm = alarms.find(a => a.id === todo.linkedAlarmId);
            if (alarm) {
              Object.assign(alarm, alarmData);
              alarm.message = `📋 待辦提醒：${text}`;
              alarm.enabled = !todo.done;
            }
          } else {
            const newAlarmId = crypto.randomUUID();
            todo.linkedAlarmId = newAlarmId;
            alarms.push({
              id: newAlarmId,
              linkedTodoId: todo.id,
              message: `📋 待辦提醒：${text}`,
              enabled: !todo.done,
              ...alarmData
            });
          }
        } else {
          if (todo.linkedAlarmId) {
            alarms = alarms.filter(a => a.id !== todo.linkedAlarmId);
            delete todo.linkedAlarmId;
          }
        }

        saveAlarms();
        saveTodos();
        activeEditId = null;
        loadTodos();
      }, () => {
        activeEditId = null;
        renderTodos();
      });

      todoList.appendChild(editForm);
      return;
    }

    const item = document.createElement('div');
    item.className = 'todo-item' + (todo.done ? ' done' : '');
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.done;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'todo-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'todo-text';
    textDiv.textContent = todo.text;
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'todo-meta';
    
    if (linkedAlarm) {
      let timeStr = linkedAlarm.time || '';
      metaDiv.innerHTML = `<span style="font-size: 11px; color: #888;">(貪睡: ${linkedAlarm.snoozeInterval || 5} 分鐘)</span> <button class="linked-badge alarm-link-btn" title="點擊前往鬧鐘排程視窗 (鬧鐘時間: ${timeStr})" onclick="ipcRenderer.send('open-alarm')">🔗</button>`;
    }
    
    checkbox.onchange = () => {
      todo.done = checkbox.checked;
      if (todo.done && linkedAlarm) {
        linkedAlarm.enabled = false;
        saveAlarms();
      }
      saveTodos();
      renderTodos();
    };
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(metaDiv);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'todo-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.innerHTML = '✏️';
    editBtn.title = '編輯';
    editBtn.onclick = () => {
      activeEditId = todo.id;
      isCreatingDraft = false;
      renderTodos();
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
        petState.todos = petState.todos.filter(t => t.id !== todo.id);
        if (todo.linkedAlarmId) {
          alarms = alarms.filter(a => a.id !== todo.linkedAlarmId);
          saveAlarms();
        }
        if (activeEditId === todo.id) activeEditId = null;
        saveTodos();
        renderTodos();
      };
      actionsDiv.querySelector('.btn-cancel-del').onclick = () => {
        renderTodos();
      };
    };
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    item.appendChild(checkbox);
    item.appendChild(contentDiv);
    item.appendChild(actionsDiv);
    
    todoList.appendChild(item);
  });
}

btnOpenAdd.onclick = () => {
  isCreatingDraft = true;
  activeEditId = null;
  renderTodos();
  window.focus();
};

loadTodos();
