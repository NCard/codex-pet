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

let currentOutfits = [];
let editingOutfit = '';

function loadState() {
  if (fs.existsSync(statePath)) {
    try {
      const data = fs.readFileSync(statePath, 'utf8');
      petState = JSON.parse(data);
      if (petState.outfits && Array.isArray(petState.outfits)) {
        currentOutfits = [...petState.outfits];
      } else if (petState.outfit && typeof petState.outfit === 'string') {
        currentOutfits = [petState.outfit];
      } else {
        currentOutfits = [];
      }
      if (currentOutfits.length > 0) {
        editingOutfit = currentOutfits[currentOutfits.length - 1];
      }
      updateUI();
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }
}

function updateUI() {
  outfitBtns.forEach(btn => {
    const outfit = btn.dataset.outfit;
    if (outfit === '') {
      if (currentOutfits.length === 0) btn.classList.add('active');
      else btn.classList.remove('active');
    } else {
      if (currentOutfits.includes(outfit)) {
        btn.classList.add('active');
        // Give special visual indication to the one currently being edited
        if (outfit === editingOutfit) {
          btn.style.boxShadow = '0 0 8px 2px #ff9800';
        } else {
          btn.style.boxShadow = '';
        }
      } else {
        btn.classList.remove('active');
        btn.style.boxShadow = '';
      }
    }
  });

  if (editingOutfit && currentOutfits.includes(editingOutfit)) {
    controls.style.display = 'block';
    const config = (petState.outfitConfigs && petState.outfitConfigs[editingOutfit]) 
                   || defaultOutfitConfigs[editingOutfit]
                   || { x: 45, y: -10, scale: 60 };
    
    document.querySelector('.controls-container h3').innerHTML = `精準微調 (${editingOutfit}) <span class="tip">(或拖曳飾品)</span>`;
    
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
  btn.addEventListener('click', (e) => {
    const clickedOutfit = btn.dataset.outfit;
    const isBadgeClick = e.target.classList.contains('remove-badge');
    
    if (clickedOutfit === '') {
      currentOutfits = [];
      editingOutfit = '';
    } else {
      if (isBadgeClick) {
        // 點擊叉叉時才移除該飾品
        currentOutfits = currentOutfits.filter(o => o !== clickedOutfit);
        editingOutfit = currentOutfits.length > 0 ? currentOutfits[currentOutfits.length - 1] : '';
      } else {
        // 點擊飾品按鈕：切換選擇/裝備該飾品
        if (!currentOutfits.includes(clickedOutfit)) {
          currentOutfits.push(clickedOutfit);
        }
        editingOutfit = clickedOutfit;
      }
    }
    
    petState.outfits = currentOutfits;
    updateUI();
    ipcRenderer.send('update-outfit', currentOutfits);
  });
});

btnReset.addEventListener('click', () => {
  if (!editingOutfit) return;
  const config = defaultOutfitConfigs[editingOutfit] || { x: 45, y: -10, scale: 60 };
  posX.value = config.x;
  posY.value = config.y;
  scale.value = config.scale;
  sendPosUpdate();
});

function sendPosUpdate() {
  if (!editingOutfit) return;
  const x = parseInt(posX.value);
  const y = parseInt(posY.value);
  const s = parseInt(scale.value);
  
  valX.textContent = x;
  valY.textContent = y;
  valScale.textContent = s;
  
  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  if (!petState.outfitConfigs[editingOutfit]) petState.outfitConfigs[editingOutfit] = {};
  petState.outfitConfigs[editingOutfit].x = x;
  petState.outfitConfigs[editingOutfit].y = y;
  petState.outfitConfigs[editingOutfit].scale = s;
  
  ipcRenderer.send('update-outfit-pos', { outfit: editingOutfit, x, y, scale: s });
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
