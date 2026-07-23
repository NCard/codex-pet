require('../../utils/logger');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const { petStatePath: statePath } = require('../../utils/paths');
let petState = {};

const outfitBtns = document.querySelectorAll('.outfit-btn');
const controls = document.getElementById('controls');
const posX = document.getElementById('pos-x');
const posY = document.getElementById('pos-y');
const scale = document.getElementById('scale');
const valX = document.getElementById('val-x');
const valY = document.getElementById('val-y');
const valScale = document.getElementById('val-scale');
const btnReset = document.getElementById('btn-reset');

const defaultOutfitConfigs = {
  '🎩': { x: 62, y: -31, scale: 60 },
  '🕶️': { x: 76, y: 17, scale: 51 },
  '🎀': { x: 78, y: 70, scale: 40 },
  '👑': { x: 59, y: -38, scale: 60 }
};

let currentOutfit = '';

function loadState() {
  if (fs.existsSync(statePath)) {
    try {
      const data = fs.readFileSync(statePath, 'utf8');
      petState = JSON.parse(data);
      currentOutfit = petState.outfit || '';
      updateUI();
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }
}

function updateUI() {
  outfitBtns.forEach(btn => {
    if (btn.dataset.outfit === currentOutfit) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (currentOutfit) {
    controls.style.display = 'block';
    const config = (petState.outfitConfigs && petState.outfitConfigs[currentOutfit]) 
                   || defaultOutfitConfigs[currentOutfit]
                   || { x: 45, y: -10, scale: 60 };
    
    posX.value = config.x;
    valX.textContent = config.x;
    posY.value = config.y;
    valY.textContent = config.y;
    scale.value = config.scale;
    valScale.textContent = config.scale;
  } else {
    controls.style.display = 'none';
  }
}

outfitBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentOutfit = btn.dataset.outfit;
    petState.outfit = currentOutfit;
    updateUI();
    ipcRenderer.send('update-outfit', currentOutfit);
});
});

btnReset.addEventListener('click', () => {
  if (!currentOutfit) return;
  const config = defaultOutfitConfigs[currentOutfit] || { x: 45, y: -10, scale: 60 };
  posX.value = config.x;
  posY.value = config.y;
  scale.value = config.scale;
  sendPosUpdate();
});

function sendPosUpdate() {
  const x = parseInt(posX.value);
  const y = parseInt(posY.value);
  const s = parseInt(scale.value);
  
  valX.textContent = x;
  valY.textContent = y;
  valScale.textContent = s;
  
  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  if (!petState.outfitConfigs[currentOutfit]) petState.outfitConfigs[currentOutfit] = {};
  petState.outfitConfigs[currentOutfit].x = x;
  petState.outfitConfigs[currentOutfit].y = y;
  petState.outfitConfigs[currentOutfit].scale = s;
  
  ipcRenderer.send('update-outfit-pos', { x, y, scale: s });
}

posX.addEventListener('input', sendPosUpdate);
posY.addEventListener('input', sendPosUpdate);
scale.addEventListener('input', sendPosUpdate);

// Receive live position updates from main renderer (when user drags on pet)
ipcRenderer.on('outfit-pos-updated', (event, { x, y, scale: s }) => {
  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  if (!petState.outfitConfigs[currentOutfit]) petState.outfitConfigs[currentOutfit] = {};

  if (x !== undefined) {
    posX.value = x;
    valX.textContent = x;
    petState.outfitConfigs[currentOutfit].x = x;
  }
  if (y !== undefined) {
    posY.value = y;
    valY.textContent = y;
    petState.outfitConfigs[currentOutfit].y = y;
  }
  if (s !== undefined) {
    scale.value = s;
    valScale.textContent = s;
    petState.outfitConfigs[currentOutfit].scale = s;
  }
});

// Initial load
loadState();
