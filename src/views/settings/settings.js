const { ipcRenderer, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { petStatePath: statePath } = require('../../utils/paths');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// 預設設定
const defaultSettings = {
  bedX: -4,
  bedY: -15,
  bedScale: 170,
  bedZ: -1,
  animSpeed: 1.0,
  apiKey: '',
  aiModel: 'gemini-3.5-flash-lite',
  aiPersonality: 'default',
  aiCustomPrompt: '',
  summonShortcut: 'Ctrl+Shift+K'
};

let petState = {};
let isDirty = false;
let isBedEditing = false;
let pendingClose = false;

try {
  if (fs.existsSync(statePath)) {
    petState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (petState.settings && petState.settings.summonShortcut) {
      petState.settings.summonShortcut = petState.settings.summonShortcut.replace(/CommandOrControl/g, 'Ctrl');
    }
  }
} catch (e) {
  console.error('Error reading state:', e);
}

if (!petState.settings) {
  petState.settings = { ...defaultSettings };
}

const els = {
  bedX: document.getElementById('bed-x'),
  bedY: document.getElementById('bed-y'),
  bedScale: document.getElementById('bed-scale'),
  bedZ: document.getElementById('bed-z'),
  animSpeed: document.getElementById('anim-speed'),
  apiKey: document.getElementById('setting-apiKey'),
  aiModel: document.getElementById('setting-aiModel'),
  aiPersonality: document.getElementById('ai-personality'),
  aiCustomPrompt: document.getElementById('custom-personality-input'),
  summonShortcut: document.getElementById('setting-shortcut')
};

const vals = {
  bedX: document.getElementById('val-bed-x'),
  bedY: document.getElementById('val-bed-y'),
  bedScale: document.getElementById('val-bed-scale'),
  animSpeed: document.getElementById('val-anim-speed')
};

// 1. 分頁切換
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTabId = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(targetTabId).classList.add('active');
  });
});

// 2. 初始化介面
function initUI() {
  const s = petState.settings;
  els.bedX.value = s.bedX ?? defaultSettings.bedX;
  els.bedY.value = s.bedY ?? defaultSettings.bedY;
  els.bedScale.value = s.bedScale ?? defaultSettings.bedScale;
  els.bedZ.value = s.bedZ ?? defaultSettings.bedZ;
  els.animSpeed.value = s.animSpeed ?? defaultSettings.animSpeed;
  els.apiKey.value = s.apiKey || process.env.GEMINI_API_KEY || '';
  els.aiModel.value = s.aiModel ?? defaultSettings.aiModel;
  els.aiPersonality.value = s.aiPersonality ?? defaultSettings.aiPersonality;
  els.aiCustomPrompt.value = s.aiCustomPrompt ?? defaultSettings.aiCustomPrompt;
  els.summonShortcut.value = s.summonShortcut ?? defaultSettings.summonShortcut;
  
  if (els.aiPersonality.value === 'custom') {
    document.getElementById('custom-personality-group').style.display = 'block';
  } else {
    document.getElementById('custom-personality-group').style.display = 'none';
  }
  
  // 動態讀取 package.json 的當前版本，避免 HTML 寫死
  try {
    const pkg = require('../../../package.json');
    const aboutVerEl = document.getElementById('about-app-version');
    if (aboutVerEl && pkg && pkg.version) {
      aboutVerEl.innerText = `v${pkg.version}`;
    }
  } catch(e) {}

  updateLabels();
  updateBedEditUI();
  setDirty(false);
}

function updateLabels() {
  vals.bedX.innerText = els.bedX.value + 'px';
  vals.bedY.innerText = els.bedY.value + 'px';
  vals.bedScale.innerText = els.bedScale.value + 'px';
  vals.animSpeed.innerText = parseFloat(els.animSpeed.value).toFixed(1) + 'x';
}

function checkDirty() {
  const s = petState.settings;
  const current = getFormValues();
  const hasChanged = (
    current.bedX !== (s.bedX ?? defaultSettings.bedX) ||
    current.bedY !== (s.bedY ?? defaultSettings.bedY) ||
    current.bedScale !== (s.bedScale ?? defaultSettings.bedScale) ||
    current.bedZ !== (s.bedZ ?? defaultSettings.bedZ) ||
    current.animSpeed !== (s.animSpeed ?? defaultSettings.animSpeed) ||
    current.apiKey !== (s.apiKey ?? defaultSettings.apiKey) ||
    current.aiModel !== (s.aiModel ?? defaultSettings.aiModel) ||
    current.aiPersonality !== (s.aiPersonality ?? defaultSettings.aiPersonality) ||
    current.aiCustomPrompt !== (s.aiCustomPrompt ?? defaultSettings.aiCustomPrompt) ||
    current.summonShortcut !== (s.summonShortcut ?? defaultSettings.summonShortcut)
  );
  setDirty(hasChanged);
}

function setDirty(dirty) {
  isDirty = dirty;
  const dirtyStatus = document.getElementById('dirty-status');
  if (dirtyStatus) {
    dirtyStatus.style.visibility = isDirty ? 'visible' : 'hidden';
  }
}

function getFormValues() {
  return {
    bedX: parseInt(els.bedX.value),
    bedY: parseInt(els.bedY.value),
    bedScale: parseInt(els.bedScale.value),
    bedZ: parseInt(els.bedZ.value),
    animSpeed: parseFloat(els.animSpeed.value),
    apiKey: els.apiKey.value.trim(),
    aiModel: els.aiModel.value,
    aiPersonality: els.aiPersonality.value,
    aiCustomPrompt: els.aiCustomPrompt.value.trim(),
    summonShortcut: els.summonShortcut.value.trim()
  };
}

// 即時預覽廣播（不寫入硬碟）
function previewBroadcast() {
  const values = getFormValues();
  ipcRenderer.send('settings-preview', values);
}

function saveSettings() {
  petState.settings = getFormValues();
  fs.writeFileSync(statePath, JSON.stringify(petState, null, 2));
  ipcRenderer.send('settings-changed', petState.settings);
  setDirty(false);
}

function revertSettings() {
  try {
    if (fs.existsSync(statePath)) {
      const savedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (savedState.settings) {
        if (savedState.settings.summonShortcut) {
          savedState.settings.summonShortcut = savedState.settings.summonShortcut.replace(/CommandOrControl/g, 'Ctrl');
        }
        petState.settings = savedState.settings;
      }
    }
  } catch (e) {}
  initUI();
  ipcRenderer.send('settings-changed', petState.settings);
  setDirty(false);
}

// 監聽變更
Object.keys(els).forEach(key => {
  if (key === 'summonShortcut') {
    return; // 獨立處理
  }
  els[key].addEventListener('input', () => {
    if (key === 'aiPersonality') {
      document.getElementById('custom-personality-group').style.display = els.aiPersonality.value === 'custom' ? 'block' : 'none';
    }
    updateLabels();
    checkDirty();
    previewBroadcast(); // 即時預覽
  });
});

let prevShortcut = '';
els.summonShortcut.addEventListener('focus', () => {
  prevShortcut = els.summonShortcut.value;
  els.summonShortcut.value = '請按下快捷鍵...';
  els.summonShortcut.style.backgroundColor = '#e3f2fd';
  els.summonShortcut.style.color = '#1976d2';
});

els.summonShortcut.addEventListener('blur', () => {
  if (els.summonShortcut.value === '請按下快捷鍵...') {
    els.summonShortcut.value = prevShortcut;
  }
  els.summonShortcut.style.backgroundColor = '#f5f5f5';
  els.summonShortcut.style.color = '';
});

els.summonShortcut.addEventListener('keydown', (e) => {
  e.preventDefault();
  const key = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    return;
  }
  if (key === 'Backspace' || key === 'Escape') {
    els.summonShortcut.value = '';
  } else {
    const modifiers = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    
    let electronKey = key.length === 1 ? key.toUpperCase() : key;
    if (electronKey === ' ') electronKey = 'Space';
    // Electron's globalShortcut formatting expects specific key names, but single chars work fine.
    
    if (modifiers.length > 0) {
      els.summonShortcut.value = modifiers.join('+') + '+' + electronKey;
    } else {
      els.summonShortcut.value = electronKey;
    }
  }
  updateLabels();
  checkDirty();
  previewBroadcast();
});

document.getElementById('btn-reset-shortcut').addEventListener('click', () => {
  els.summonShortcut.value = defaultSettings.summonShortcut;
  updateLabels();
  checkDirty();
  previewBroadcast();
});

// 3. 床鋪編輯模式開關
const btnToggleBedEdit = document.getElementById('btn-toggle-bed-edit');
const bedEditTip = document.getElementById('bed-edit-tip');

btnToggleBedEdit.addEventListener('click', () => {
  isBedEditing = !isBedEditing;
  updateBedEditUI();
  ipcRenderer.send('toggle-bed-edit', isBedEditing);
});

function updateBedEditUI() {
  const bedLockTip = document.getElementById('bed-lock-tip');
  const disabled = !isBedEditing;
  
  els.bedX.disabled = disabled;
  els.bedY.disabled = disabled;
  els.bedScale.disabled = disabled;
  els.bedZ.disabled = disabled;

  if (isBedEditing) {
    btnToggleBedEdit.innerText = '⏹️ 結束床鋪編輯模式';
    btnToggleBedEdit.classList.add('active');
    bedEditTip.style.display = 'block';
    if (bedLockTip) bedLockTip.style.display = 'none';
  } else {
    btnToggleBedEdit.innerText = '✏️ 開啟床鋪編輯模式 (小鳥坐床)';
    btnToggleBedEdit.classList.remove('active');
    bedEditTip.style.display = 'none';
    if (bedLockTip) bedLockTip.style.display = 'block';
  }
}

// 拖曳床鋪時收到的廣播
ipcRenderer.on('update-settings-ui', (event, data) => {
  if (data.bedX !== undefined) els.bedX.value = data.bedX;
  if (data.bedY !== undefined) els.bedY.value = data.bedY;
  if (data.bedScale !== undefined) els.bedScale.value = data.bedScale;
  updateLabels();
  checkDirty();
});

// 4. 按鈕行為
document.getElementById('btn-save-all').addEventListener('click', () => {
  saveSettings();
  alert('✅ 設定已成功儲存並套用！');
  if (pendingClose) {
    pendingClose = false;
    window.close();
  }
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('確定要將所有設定還原為預設值嗎？')) {
    petState.settings = { ...defaultSettings };
    initUI();
    saveSettings();
  }
});

// 5. 關於與外部連結
document.getElementById('link-github').addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://github.com/NCard/codex-pet');
});

document.getElementById('link-issues').addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://github.com/NCard/codex-pet/issues');
});

// 檢查更新
const btnCheckUpdate = document.getElementById('btn-check-update');
const updateMsg = document.getElementById('update-msg');

btnCheckUpdate.addEventListener('click', () => {
  updateMsg.style.display = 'block';
  btnCheckUpdate.disabled = true;
  btnCheckUpdate.innerText = '檢查中...';
  ipcRenderer.send('check-update-manual');
});

ipcRenderer.on('update-check-done', () => {
  updateMsg.style.display = 'none';
  btnCheckUpdate.disabled = false;
  btnCheckUpdate.innerText = '手動檢查更新';
});

// 6. 離開關閉確認 (Modal)
const confirmModal = document.getElementById('confirm-modal');
const btnModalSave = document.getElementById('btn-modal-save');
const btnModalDiscard = document.getElementById('btn-modal-discard');
const btnModalCancel = document.getElementById('btn-modal-cancel');

window.addEventListener('beforeunload', (e) => {
  if (isBedEditing) {
    ipcRenderer.send('toggle-bed-edit', false);
  }
  if (isDirty && !pendingClose) {
    e.returnValue = false; // 阻止預設關閉
    confirmModal.style.display = 'flex';
  }
});

btnModalSave.addEventListener('click', () => {
  saveSettings();
  confirmModal.style.display = 'none';
  pendingClose = true;
  window.close();
});

btnModalDiscard.addEventListener('click', () => {
  revertSettings();
  confirmModal.style.display = 'none';
  pendingClose = true;
  window.close();
});

btnModalCancel.addEventListener('click', () => {
  confirmModal.style.display = 'none';
});

initUI();
