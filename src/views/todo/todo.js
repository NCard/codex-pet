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

const textInput = document.getElementById('todo-text');
const hasAlarmCheck = document.getElementById('todo-has-alarm');
const alarmSettings = document.getElementById('todo-alarm-settings');
const alarmRadios = document.getElementsByName('todo-alarm-type');
const dateInput = document.getElementById('todo-alarm-date');
const hourSelect = document.getElementById('todo-alarm-hour');
const minuteSelect = document.getElementById('todo-alarm-minute');
const snoozeInput = document.getElementById('todo-snooze');
const weeklyGroup = document.getElementById('todo-weekly-group');
const dayCheckboxes = document.querySelectorAll('.days-selector input[type="checkbox"]');
const addBtn = document.getElementById('add-todo-btn');
const todoList = document.getElementById('todo-list');

// Toggle UI
hasAlarmCheck.addEventListener('change', () => {
  alarmSettings.style.display = hasAlarmCheck.checked ? 'flex' : 'none';
});

function updateTypeUI() {
  const type = document.querySelector('input[name="todo-alarm-type"]:checked').value;
  if (type === 'date') {
    dateInput.style.display = 'block';
    weeklyGroup.style.display = 'none';
  } else {
    dateInput.style.display = 'none';
    weeklyGroup.style.display = 'flex';
  }
}
alarmRadios.forEach(r => r.addEventListener('change', updateTypeUI));
updateTypeUI();

for(let i=0; i<24; i++) {
  const val = i.toString().padStart(2, '0');
  hourSelect.add(new Option(val, val));
}
for(let i=0; i<60; i++) {
  const val = i.toString().padStart(2, '0');
  minuteSelect.add(new Option(val, val));
}

const now = new Date();
dateInput.value = now.toISOString().split('T')[0];
hourSelect.value = now.getHours().toString().padStart(2, '0');
minuteSelect.value = now.getMinutes().toString().padStart(2, '0');
let editingId = null;

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
  } catch (e) {
    console.error('Failed to save pet state:', e);
  }
}

function renderTodos() {
  todoList.innerHTML = '';
  
  if (petState.todos.length === 0) {
    todoList.innerHTML = '<div class="empty-state">還沒有任何待辦事項喔！<br>趕快在上方新增一個吧！</div>';
    return;
  }

  petState.todos.forEach(todo => {
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
    
    // Find linked alarm (支援 ID 或訊息標題智慧匹配)
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
    
    if (linkedAlarm) {
      let timeStr = linkedAlarm.time || '';
      metaDiv.innerHTML = `<button class="linked-badge alarm-link-btn" title="點擊前往鬧鐘排程視窗" onclick="ipcRenderer.send('open-alarm')">⏰ 綁定鬧鐘 ${timeStr} 🔗</button><br><span class="snooze-info" style="font-size: 11px; color: #888;">(貪睡: ${linkedAlarm.snoozeInterval || 5} 分鐘)</span>`;
    }
    
    // Checkbox triggers alarm disable
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
      editingId = todo.id;
      textInput.value = todo.text;
      
      const alarm = alarms.find(a => a.id === todo.linkedAlarmId);
      if (alarm) {
        hasAlarmCheck.checked = true;
        alarmSettings.style.display = 'flex';
        document.querySelector(`input[name="todo-alarm-type"][value="${alarm.type || 'weekly'}"]`).checked = true;
        updateTypeUI();
        
        if (alarm.time) {
          const [h, m] = alarm.time.split(':');
          hourSelect.value = h;
          minuteSelect.value = m;
        }
        
        snoozeInput.value = alarm.snoozeInterval || 5;
        if (alarm.type === 'date') {
          dateInput.value = alarm.date || new Date().toISOString().split('T')[0];
        } else {
          dayCheckboxes.forEach(cb => {
            cb.checked = (alarm.days || []).includes(parseInt(cb.value));
          });
        }
      } else {
        hasAlarmCheck.checked = false;
        alarmSettings.style.display = 'none';
        dayCheckboxes.forEach(cb => cb.checked = false);
      }
      
      addBtn.innerHTML = '💾 儲存';
      addBtn.style.background = '#2196F3';
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '<i class="theme-icon icon-trash"></i>';
    deleteBtn.title = '刪除';
    deleteBtn.onclick = () => {
      if (confirm(`確定要刪除「${todo.text}」嗎？`)) {
        petState.todos = petState.todos.filter(t => t.id !== todo.id);
        if (todo.linkedAlarmId) {
          alarms = alarms.filter(a => a.id !== todo.linkedAlarmId);
          saveAlarms();
        }
        if (editingId === todo.id) {
          editingId = null;
          addBtn.textContent = '➕ 新增待辦';
          addBtn.style.background = '#4caf50';
          textInput.value = '';
          hasAlarmCheck.checked = false;
          alarmSettings.style.display = 'none';
        }
        saveTodos();
        renderTodos();
      }
    };
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    item.appendChild(checkbox);
    item.appendChild(contentDiv);
    item.appendChild(actionsDiv);
    
    todoList.appendChild(item);
  });
}

addBtn.onclick = () => {
  const text = textInput.value.trim();
  
  if (!text) {
    alert('請輸入待辦事項內容！');
    return;
  }
  
  let alarmData = null;
  if (hasAlarmCheck.checked) {
    const type = document.querySelector('input[name="todo-alarm-type"]:checked').value;
    const time = `${hourSelect.value}:${minuteSelect.value}`;
    const snooze = parseInt(snoozeInput.value, 10) || 5;
    const dateVal = dateInput.value;
    
    let days = [];
    if (type === 'weekly') {
      dayCheckboxes.forEach(cb => { if (cb.checked) days.push(parseInt(cb.value)); });
      if (days.length === 0) {
        alert('每週重複模式必須至少選擇一天！');
        return;
      }
    } else {
      if (!dateVal) {
        alert('請選擇日期！');
        return;
      }
    }
    
    if (!time) {
      alert('請選擇時間！');
      return;
    }
    
    alarmData = {
      type: type,
      time: time,
      date: dateVal,
      days: days,
      snoozeInterval: snooze
    };
  }
  
  if (editingId) {
    const todo = petState.todos.find(t => t.id === editingId);
    if (todo) {
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
    }
    editingId = null;
    addBtn.textContent = '➕ 新增待辦';
    addBtn.style.background = '#4caf50';
  } else {
    // 確保所有舊的 todo 也有 ID，防呆
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
  }
  
  saveTodos();
  textInput.value = '';
  hasAlarmCheck.checked = false;
  alarmSettings.style.display = 'none';
  snoozeInput.value = '5';
  loadTodos();
};

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    addBtn.click();
  }
});

// Initial load
loadTodos();
