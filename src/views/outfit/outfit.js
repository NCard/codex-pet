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

function sendPosUpdate() {
  const x = parseInt(posX.value);
  const y = parseInt(posY.value);
  const s = parseInt(scale.value);
  
  valX.textContent = x;
  valY.textContent = y;
  valScale.textContent = s;
  
  ipcRenderer.send('update-outfit-pos', { x, y, scale: s });
}

posX.addEventListener('input', sendPosUpdate);
posY.addEventListener('input', sendPosUpdate);
scale.addEventListener('input', sendPosUpdate);

// Receive live position updates from main renderer (when user drags on pet)
ipcRenderer.on('outfit-pos-updated', (event, { x, y, scale: s }) => {
  if (x !== undefined) {
    posX.value = x;
    valX.textContent = x;
  }
  if (y !== undefined) {
    posY.value = y;
    valY.textContent = y;
  }
  if (s !== undefined) {
    scale.value = s;
    valScale.textContent = s;
  }
});

// Initial load
loadState();
