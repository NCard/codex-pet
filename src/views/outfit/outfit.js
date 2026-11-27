require('../../utils/logger');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const { petStatePath: statePath } = require('../../utils/paths');
const {
  COORD_VERSION,
  getFeaturedOutfits,
  getLegacyOutfits,
  getOutfitItem,
  getDefaultOutfitConfig,
  resolveOutfitConfig,
  getOutfitAssetUrl,
  applyOutfitSelection
} = require('../../utils/outfits_catalog');

let petState = {};
let currentOutfits = [];
let editingOutfit = '';
let activeSlotFilter = 'all';
let freeStackMode = false;

const featuredWardrobe = document.getElementById('featured-wardrobe');
const legacyWardrobe = document.getElementById('legacy-wardrobe');
const slotTabs = document.querySelectorAll('.slot-tab');
const toggleFreeStack = document.getElementById('toggle-free-stack');

const controls = document.getElementById('controls');
const controlsTitle = document.getElementById('controls-title');
const posX = document.getElementById('pos-x');
const posY = document.getElementById('pos-y');
const scale = document.getElementById('scale');
const rotate = document.getElementById('rotate');
const valX = document.getElementById('val-x');
const valY = document.getElementById('val-y');
const valScale = document.getElementById('val-scale');
const valRotate = document.getElementById('val-rotate');
const btnReset = document.getElementById('btn-reset');

function saveSettingsPreference() {
  try {
    if (!petState.settings) petState.settings = {};
    petState.settings.outfitFreeStack = freeStackMode;
    fs.writeFileSync(statePath, JSON.stringify(petState, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save outfit preference:', e);
  }
}

function createClearButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'outfit-btn outfit-clear-btn';
  btn.dataset.outfit = '';
  btn.innerHTML = `
    <span class="outfit-thumb-emoji">✨</span>
    <span class="outfit-name">全部脫下</span>
  `;
  btn.addEventListener('click', () => {
    currentOutfits = [];
    editingOutfit = '';
    petState.outfits = [];
    updateUI();
    ipcRenderer.send('update-outfit', currentOutfits);
  });
  return btn;
}

function createOutfitCard(item) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'outfit-btn';
  btn.dataset.outfit = item.id;
  btn.dataset.slot = item.slot;
  btn.title = `${item.name}（點擊穿戴／選中調整，點右上角 ✕ 卸下）`;

  const assetUrl = getOutfitAssetUrl(item.id, '../../../assets/images/outfits/');
  const visualHtml = assetUrl
    ? `<img class="outfit-thumb-img" src="${assetUrl}" alt="${item.name}" draggable="false">`
    : `<span class="outfit-thumb-emoji">${item.id}</span>`;

  btn.innerHTML = `
    ${visualHtml}
    <span class="outfit-name">${item.name}</span>
    <span class="remove-badge" title="卸下 ${item.name}">✕</span>
  `;

  btn.addEventListener('click', (e) => {
    const isBadgeClick = e.target.classList.contains('remove-badge');
    if (isBadgeClick) {
      currentOutfits = currentOutfits.filter(o => o !== item.id);
      if (editingOutfit === item.id) {
        editingOutfit = currentOutfits.length > 0 ? currentOutfits[currentOutfits.length - 1] : '';
      }
    } else if (currentOutfits.includes(item.id)) {
      if (editingOutfit === item.id) {
        // 再次點擊已選中調整中的飾品：直接卸下更順手
        currentOutfits = currentOutfits.filter(o => o !== item.id);
        editingOutfit = currentOutfits.length > 0 ? currentOutfits[currentOutfits.length - 1] : '';
      } else {
        // 切換微調焦點至此飾品
        editingOutfit = item.id;
      }
    } else {
      currentOutfits = applyOutfitSelection(currentOutfits, item.id, { freeStack: freeStackMode });
      editingOutfit = item.id;
    }

    petState.outfits = currentOutfits;
    updateUI();
    ipcRenderer.send('update-outfit', currentOutfits);
  });

  return btn;
}

function renderWardrobeGrids() {
  if (featuredWardrobe) {
    featuredWardrobe.innerHTML = '';
    if (activeSlotFilter === 'all') {
      featuredWardrobe.appendChild(createClearButton());
    }
    const featured = getFeaturedOutfits().filter(
      item => activeSlotFilter === 'all' || item.slot === activeSlotFilter
    );
    featured.forEach(item => featuredWardrobe.appendChild(createOutfitCard(item)));
  }

  if (legacyWardrobe) {
    legacyWardrobe.innerHTML = '';
    const legacy = getLegacyOutfits().filter(
      item => activeSlotFilter === 'all' || item.slot === activeSlotFilter
    );
    legacy.forEach(item => legacyWardrobe.appendChild(createOutfitCard(item)));
  }
}

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
      freeStackMode = Boolean(petState.settings && petState.settings.outfitFreeStack);
      if (toggleFreeStack) toggleFreeStack.checked = freeStackMode;
      if (currentOutfits.length > 0) {
        editingOutfit = currentOutfits[currentOutfits.length - 1];
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }
  renderWardrobeGrids();
  updateUI();
}

function updateUI() {
  const allBtns = document.querySelectorAll('.outfit-btn');
  allBtns.forEach(btn => {
    const outfit = btn.dataset.outfit;
    if (outfit === '') {
      btn.classList.toggle('active', currentOutfits.length === 0);
      btn.classList.remove('is-editing');
    } else {
      const isWorn = currentOutfits.includes(outfit);
      btn.classList.toggle('active', isWorn);
      btn.classList.toggle('is-editing', isWorn && outfit === editingOutfit);
    }
  });

  if (editingOutfit && currentOutfits.includes(editingOutfit)) {
    controls.style.display = 'block';
    const item = getOutfitItem(editingOutfit);
    const labelName = item ? `${item.id} ${item.name}` : editingOutfit;
    const config = resolveOutfitConfig(editingOutfit, petState.outfitConfigs);

    if (controlsTitle) {
      controlsTitle.innerHTML = `精準微調 (${labelName}) <span class="tip">(或直接拖曳)</span>`;
    }

    posX.value = config.x;
    valX.textContent = config.x;
    posY.value = config.y;
    valY.textContent = config.y;
    scale.value = config.scale;
    valScale.textContent = config.scale;
    rotate.value = config.rotate || 0;
    valRotate.textContent = `${config.rotate || 0}°`;
  } else {
    controls.style.display = 'none';
  }
}

slotTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activeSlotFilter = tab.dataset.slot || 'all';
    slotTabs.forEach(t => t.classList.toggle('active', t === tab));
    renderWardrobeGrids();
    updateUI();
  });
});

if (toggleFreeStack) {
  toggleFreeStack.addEventListener('change', () => {
    freeStackMode = Boolean(toggleFreeStack.checked);
    saveSettingsPreference();
  });
}

btnReset.addEventListener('click', () => {
  if (!editingOutfit) return;
  const config = getDefaultOutfitConfig(editingOutfit);
  posX.value = config.x;
  posY.value = config.y;
  scale.value = config.scale;
  rotate.value = config.rotate || 0;
  sendPosUpdate();
});

function sendPosUpdate() {
  if (!editingOutfit) return;
  const x = parseInt(posX.value, 10);
  const y = parseInt(posY.value, 10);
  const s = parseInt(scale.value, 10);
  const r = parseInt(rotate.value, 10) || 0;

  valX.textContent = x;
  valY.textContent = y;
  valScale.textContent = s;
  valRotate.textContent = `${r}°`;

  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  petState.outfitConfigs[editingOutfit] = {
    x,
    y,
    scale: s,
    rotate: r,
    coordVersion: COORD_VERSION
  };

  ipcRenderer.send('update-outfit-pos', { outfit: editingOutfit, x, y, scale: s, rotate: r });
}

posX.addEventListener('input', sendPosUpdate);
posY.addEventListener('input', sendPosUpdate);
scale.addEventListener('input', sendPosUpdate);
rotate.addEventListener('input', sendPosUpdate);

// Receive live position updates from main renderer (when user drags or wheel-zooms on pet)
ipcRenderer.on('outfit-pos-updated', (event, { outfit, x, y, scale: s, rotate: r }) => {
  if (!petState.outfitConfigs) petState.outfitConfigs = {};
  const existing = resolveOutfitConfig(outfit, petState.outfitConfigs);
  const next = { ...existing, coordVersion: COORD_VERSION };
  if (x !== undefined) next.x = x;
  if (y !== undefined) next.y = y;
  if (s !== undefined) next.scale = s;
  if (r !== undefined) next.rotate = r;
  petState.outfitConfigs[outfit] = next;

  if (outfit === editingOutfit) {
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
    if (r !== undefined) {
      rotate.value = r;
      valRotate.textContent = `${r}°`;
    }
  }
});

// Initial load
loadState();
