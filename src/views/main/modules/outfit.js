const {
  COORD_VERSION,
  resolveOutfitConfig,
  getOutfitSlot,
  getPoseSlotOffset,
  getOutfitAssetUrl
} = require('../../../utils/outfits_catalog');

let isOutfitEditMode = false;
let isDraggingOutfit = false;
let activeDraggingOutfit = null;
let activeDraggingElement = null;
let outfitDragStartX = 0;
let outfitDragStartY = 0;
let outfitStartXPercent = 50;
let outfitStartYPercent = 30;
let outfitContainerWidth = 180;
let outfitContainerHeight = 180;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function init({
  outfitContainer, kiwi,
  petState, savePetState, _loadPetState,
  ipcRenderer
}) {
  let currentPoseKey = 'idle';

  function getConfig(outfit) {
    return resolveOutfitConfig(outfit, petState.outfitConfigs);
  }

  function persistConfig(outfit, patch) {
    if (!petState.outfitConfigs) petState.outfitConfigs = {};
    const base = getConfig(outfit);
    petState.outfitConfigs[outfit] = {
      ...base,
      ...patch,
      coordVersion: COORD_VERSION
    };
    savePetState();
    return petState.outfitConfigs[outfit];
  }

  function getEffectivePoseOffset(outfit) {
    if (isOutfitEditMode || isDraggingOutfit) {
      return { dx: 0, dy: 0, dRotate: 0 };
    }
    return getPoseSlotOffset(currentPoseKey, getOutfitSlot(outfit), outfit);
  }

  function applyElementTransform(el, cfg, isImage, outfit) {
    const off = getEffectivePoseOffset(outfit);
    const effX = cfg.x + off.dx;
    const effY = cfg.y + off.dy;
    const effRot = (cfg.rotate || 0) + off.dRotate;

    el.style.left = `${effX}%`;
    el.style.top = `${effY}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${effRot}deg)`;
    if (isImage) {
      el.style.width = `${cfg.scale}%`;
    } else {
      el.style.fontSize = `calc(var(--pet-scale, 180px) * ${(cfg.scale / 100).toFixed(4)})`;
    }
    el.dataset.x = String(cfg.x);
    el.dataset.y = String(cfg.y);
    el.dataset.scale = String(cfg.scale);
    el.dataset.rotate = String(cfg.rotate || 0);
  }

  function refreshPoseTransforms() {
    if (!outfitContainer) return;
    if (currentPoseKey === 'sleep' && !isOutfitEditMode) {
      outfitContainer.style.display = 'none';
      return;
    }
    outfitContainer.style.display = 'block';

    Array.from(outfitContainer.children).forEach(el => {
      const outfit = el.dataset.outfit;
      if (!outfit) return;
      const cfg = getConfig(outfit);
      const isImage = Boolean(el.querySelector('img'));
      el.style.transition = isDraggingOutfit
        ? 'none'
        : 'left 0.14s ease-out, top 0.14s ease-out, transform 0.14s ease-out';
      applyElementTransform(el, cfg, isImage, outfit);
    });
  }

  function setActivePose(spriteKey) {
    const nextKey = spriteKey || 'idle';
    if (nextKey === currentPoseKey) return;
    currentPoseKey = nextKey;
    refreshPoseTransforms();
  }

  function applyOutfitPos() {
    if (!outfitContainer) return;
    outfitContainer.innerHTML = '';
    if (!petState.outfits) petState.outfits = [];

    petState.outfits.forEach(outfit => {
      const config = getConfig(outfit);
      const assetUrl = getOutfitAssetUrl(outfit, '../../../assets/images/outfits/');

      const div = document.createElement('div');
      div.className = 'outfit-layer-item';
      div.dataset.outfit = outfit;
      div.style.position = 'absolute';
      div.style.transformOrigin = 'center center';
      div.style.pointerEvents = isOutfitEditMode ? 'auto' : 'none';
      div.style.cursor = isOutfitEditMode ? 'grab' : 'default';
      div.style.zIndex = '5';
      div.style.userSelect = 'none';

      if (assetUrl) {
        const img = document.createElement('img');
        img.src = assetUrl;
        img.alt = outfit;
        img.draggable = false;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.pointerEvents = 'none';
        img.style.userSelect = 'none';
        img.style.filter = 'drop-shadow(0 1px 2px rgba(74, 48, 28, 0.22))';
        div.appendChild(img);
      } else {
        div.textContent = outfit;
        div.style.lineHeight = '1';
      }

      applyElementTransform(div, config, Boolean(assetUrl), outfit);

      div.addEventListener('mousedown', (e) => {
        if (!isOutfitEditMode) return;
        isDraggingOutfit = true;
        activeDraggingOutfit = outfit;
        activeDraggingElement = div;
        div.style.transition = 'none';

        outfitDragStartX = e.clientX;
        outfitDragStartY = e.clientY;
        div.style.cursor = 'grabbing';

        const rect = outfitContainer.getBoundingClientRect();
        outfitContainerWidth = rect.width || 180;
        outfitContainerHeight = rect.height || 180;
        outfitStartXPercent = parseFloat(div.dataset.x) || config.x;
        outfitStartYPercent = parseFloat(div.dataset.y) || config.y;

        e.preventDefault();
        e.stopPropagation();
      });

      div.addEventListener('wheel', (e) => {
        if (!isOutfitEditMode) return;
        e.preventDefault();
        const curScale = parseInt(div.dataset.scale, 10) || config.scale;
        const curRotate = parseInt(div.dataset.rotate, 10) || 0;

        if (e.shiftKey) {
          const nextRotate = clamp(curRotate + (e.deltaY < 0 ? 3 : -3), -45, 45);
          const updated = persistConfig(outfit, { rotate: nextRotate });
          applyElementTransform(div, updated, Boolean(assetUrl), outfit);
          ipcRenderer.send('outfit-pos-updated', { outfit, rotate: nextRotate });
        } else {
          const nextScale = clamp(curScale + (e.deltaY < 0 ? 2 : -2), 10, 90);
          const updated = persistConfig(outfit, { scale: nextScale });
          applyElementTransform(div, updated, Boolean(assetUrl), outfit);
          ipcRenderer.send('outfit-pos-updated', { outfit, scale: nextScale });
        }
      });

      outfitContainer.appendChild(div);
    });
  }

  // Event listeners for global dragging
  window.addEventListener('mousemove', (e) => {
    if (isDraggingOutfit && activeDraggingElement) {
      const wrapper = document.getElementById('kiwi-wrapper');
      const flip = (wrapper && parseInt(wrapper.style.getPropertyValue('--flip'), 10)) || 1;
      const dxPx = (e.clientX - outfitDragStartX) * flip;
      const dyPx = (e.clientY - outfitDragStartY);

      const newX = clamp(Math.round(outfitStartXPercent + (dxPx / outfitContainerWidth) * 100), -20, 120);
      const newY = clamp(Math.round(outfitStartYPercent + (dyPx / outfitContainerHeight) * 100), -20, 120);

      activeDraggingElement.style.left = `${newX}%`;
      activeDraggingElement.style.top = `${newY}%`;
      activeDraggingElement.dataset.x = String(newX);
      activeDraggingElement.dataset.y = String(newY);
      ipcRenderer.send('outfit-pos-updated', { outfit: activeDraggingOutfit, x: newX, y: newY });
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingOutfit && activeDraggingElement) {
      isDraggingOutfit = false;
      activeDraggingElement.style.cursor = 'grab';

      const currentX = parseInt(activeDraggingElement.dataset.x, 10);
      const currentY = parseInt(activeDraggingElement.dataset.y, 10);
      const currentScale = parseInt(activeDraggingElement.dataset.scale, 10);
      const currentRotate = parseInt(activeDraggingElement.dataset.rotate, 10) || 0;

      persistConfig(activeDraggingOutfit, {
        x: Number.isNaN(currentX) ? 50 : currentX,
        y: Number.isNaN(currentY) ? 30 : currentY,
        scale: Number.isNaN(currentScale) ? 30 : currentScale,
        rotate: currentRotate
      });

      activeDraggingElement = null;
      activeDraggingOutfit = null;
    }
  });

  // IPC Listeners
  ipcRenderer.on('outfit-closed', () => {
    isOutfitEditMode = false;
    if (outfitContainer) {
      Array.from(outfitContainer.children).forEach(child => {
        child.style.pointerEvents = 'none';
        child.style.cursor = 'default';
      });
    }
    if (kiwi) kiwi.style.animation = ''; // 恢復呼吸動畫
    refreshPoseTransforms();
  });

  ipcRenderer.on('update-outfit', (event, newOutfits) => {
    petState.outfits = Array.isArray(newOutfits) ? newOutfits : [];
    savePetState();
    applyOutfitPos();
    if (kiwi) {
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    }
  });

  ipcRenderer.on('update-outfit-pos', (event, { outfit, x, y, scale, rotate }) => {
    const patch = {};
    if (x !== undefined) patch.x = x;
    if (y !== undefined) patch.y = y;
    if (scale !== undefined) patch.scale = scale;
    if (rotate !== undefined) patch.rotate = rotate;

    persistConfig(outfit, patch);
    applyOutfitPos();
  });

  // Initial load
  if (petState.outfits && petState.outfits.length > 0) {
    applyOutfitPos();
  }

  return {
    applyOutfitPos,
    setActivePose,
    refreshPoseTransforms
  };
}

module.exports = {
  init,
  getIsOutfitEditMode: () => isOutfitEditMode,
  setOutfitEditMode: (val) => { isOutfitEditMode = val; },
  getIsDraggingOutfit: () => isDraggingOutfit
};
