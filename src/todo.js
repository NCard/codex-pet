require('./logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ipcRenderer } = require('electron');

ipcRenderer.on('reload-data', () => {
  loadTodos();
});

const statePath = path.join(__dirname, '../pet_state.json');
let petState = { todos: [] };

const textInput = document.getElementById('todo-text');
const timeInput = document.getElementById('todo-time');
const snoozeInput = document.getElementById('todo-snooze');
const addBtn = document.getElementById('add-todo-btn');
const todoList = document.getElementById('todo-list');
let editingId = null;

function loadTodos() {
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
    checkbox.onchange = () => {
      todo.done = checkbox.checked;
      saveTodos();
      renderTodos();
    };
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'todo-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'todo-text';
    textDiv.textContent = todo.text;
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'todo-meta';
    if (todo.reminderTime) {
      metaDiv.innerHTML = `<span>⏰ 提醒時間: ${todo.reminderTime}</span><span>(貪睡: ${todo.snoozeInterval || 5}分)</span>`;
    }
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(metaDiv);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'todo-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-toggle';
    editBtn.textContent = '✏️';
    editBtn.title = '編輯';
    editBtn.onclick = () => {
      editingId = todo.id;
      textInput.value = todo.text;
      timeInput.value = todo.reminderTime || '';
      snoozeInput.value = todo.snoozeInterval || 5;
      addBtn.textContent = '💾 儲存';
      addBtn.style.background = '#2196F3';
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = '刪除';
    deleteBtn.onclick = () => {
      if (confirm(`確定要刪除「${todo.text}」嗎？`)) {
        petState.todos = petState.todos.filter(t => t.id !== todo.id);
        if (editingId === todo.id) {
          editingId = null;
          addBtn.textContent = '➕ 新增';
          addBtn.style.background = '#4caf50';
          textInput.value = '';
          timeInput.value = '';
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
  const time = timeInput.value;
  const snooze = parseInt(snoozeInput.value, 10) || 5;
  
  if (!text) {
    alert('請輸入待辦事項內容！');
    return;
  }
  
  if (editingId) {
    const todo = petState.todos.find(t => t.id === editingId);
    if (todo) {
      todo.text = text;
      todo.reminderTime = time || null;
      todo.snoozeInterval = snooze;
    }
    editingId = null;
    addBtn.textContent = '➕ 新增';
    addBtn.style.background = '#4caf50';
  } else {
    // 確保所有舊的 todo 也有 ID，防呆
    petState.todos.forEach(t => { if(!t.id) t.id = crypto.randomUUID(); });
    
    petState.todos.push({
      id: crypto.randomUUID(),
      text: text,
      done: false,
      reminderTime: time || null,
      snoozeInterval: snooze
    });
  }
  
  saveTodos();
  textInput.value = '';
  timeInput.value = '';
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
