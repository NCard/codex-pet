const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { petStatePath: statePath } = require('../../utils/paths');

// 預設設定
const defaultSettings = {
  bedX: -4,
  bedY: -15,
  bedScale: 170,
  bedZ: -1,
  animSpeed: 1.0,
  apiKey: '',
  aiPersonality: 'default',
  aiCustomPrompt: ''
};

let petState = {};
try {
  if (fs.existsSync(statePath)) {
    petState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
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
  aiPersonality: document.getElementById('ai-personality'),
  aiCustomPrompt: document.getElementById('custom-personality-input')
};

const vals = {
  bedX: document.getElementById('val-bed-x'),
  bedY: document.getElementById('val-bed-y'),
  bedScale: document.getElementById('val-bed-scale'),
  animSpeed: document.getElementById('val-anim-speed')
};

function initUI() {
  const s = petState.settings;
  els.bedX.value = s.bedX ?? defaultSettings.bedX;
  els.bedY.value = s.bedY ?? defaultSettings.bedY;
  els.bedScale.value = petState.settings.bedScale ?? defaultSettings.bedScale;
  els.bedZ.value = petState.settings.bedZ ?? defaultSettings.bedZ;
  els.animSpeed.value = petState.settings.animSpeed ?? defaultSettings.animSpeed;
  els.apiKey.value = petState.settings.apiKey ?? defaultSettings.apiKey;
  els.aiPersonality.value = petState.settings.aiPersonality ?? defaultSettings.aiPersonality;
  els.aiCustomPrompt.value = petState.settings.aiCustomPrompt ?? defaultSettings.aiCustomPrompt;
  
  if (els.aiPersonality.value === 'custom') {
    document.getElementById('custom-personality-group').style.display = 'block';
  } else {
    document.getElementById('custom-personality-group').style.display = 'none';
  }
  
  updateLabels();
}

function updateLabels() {
  vals.bedX.innerText = els.bedX.value + 'px';
  vals.bedY.innerText = els.bedY.value + 'px';
  vals.bedScale.innerText = els.bedScale.value + 'px';
  vals.animSpeed.innerText = parseFloat(els.animSpeed.value).toFixed(1) + 'x';
}

function saveAndBroadcast() {
  petState.settings = {
    bedX: parseInt(els.bedX.value),
    bedY: parseInt(els.bedY.value),
    bedScale: parseInt(els.bedScale.value),
    bedZ: parseInt(els.bedZ.value),
    animSpeed: parseFloat(els.animSpeed.value),
    apiKey: els.apiKey.value,
    aiPersonality: els.aiPersonality.value,
    aiCustomPrompt: els.aiCustomPrompt.value
  };
  
  fs.writeFileSync(statePath, JSON.stringify(petState, null, 2));
  ipcRenderer.send('settings-changed', petState.settings);
}

Object.keys(els).forEach(key => {
  if (key === 'apiKey' || key === 'aiCustomPrompt') return; // 獨立處理或特別處理
  els[key].addEventListener('input', () => {
    if (key === 'aiPersonality') {
      document.getElementById('custom-personality-group').style.display = els.aiPersonality.value === 'custom' ? 'block' : 'none';
    }
    updateLabels();
    saveAndBroadcast();
  });
});

els.aiCustomPrompt.addEventListener('input', () => {
  saveAndBroadcast();
});

document.getElementById('btn-save-key').addEventListener('click', () => {
  saveAndBroadcast();
  const msg = document.getElementById('key-save-msg');
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
});

ipcRenderer.on('update-settings-ui', (event, data) => {
  if (data.bedX !== undefined) els.bedX.value = data.bedX;
  if (data.bedY !== undefined) els.bedY.value = data.bedY;
  if (data.bedScale !== undefined) els.bedScale.value = data.bedScale;
  updateLabels();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  petState.settings = { ...defaultSettings };
  initUI();
  saveAndBroadcast();
});

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

initUI();
