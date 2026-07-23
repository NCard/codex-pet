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
  apiKey: ''
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
  apiKey: document.getElementById('setting-apiKey')
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
    apiKey: els.apiKey.value
  };
  
  fs.writeFileSync(statePath, JSON.stringify(petState, null, 2));
  ipcRenderer.send('settings-changed', petState.settings);
}

Object.keys(els).forEach(key => {
  els[key].addEventListener('input', () => {
    updateLabels();
    saveAndBroadcast();
  });
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

initUI();
