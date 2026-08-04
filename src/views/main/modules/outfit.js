let isOutfitEditMode = false;
let isDraggingOutfit = false;
let activeDraggingOutfit = null;
let activeDraggingElement = null;
let outfitDragStartX = 0;
let outfitDragStartY = 0;
let outfitStartLeft = 0;
let outfitStartTop = 0;

function init({
  outfitContainer, kiwi,
  petState, savePetState, loadPetState,
  ipcRenderer
}) {
  const defaultOutfitConfigs = {
    '🎀': { x: 62, y: -31, scale: 60 },
    '🎩': { x: 76, y: 17, scale: 51 },
    '🎒': { x: 79, y: 75, scale: 40 },
    '👑': { x: 59, y: -38, scale: 60 },
    '👓': { x: 80, y: -18, scale: 20 },
    '👒': { x: 60, y: -34, scale: 60 },
    '🧢': { x: 60, y: -32, scale: 44 },
    '🎓': { x: 60, y: -35, scale: 55 },
    '🎧': { x: 76, y: 15, scale: 45 }
  };

  function applyOutfitPos() {
    if (!outfitContainer) return;
    outfitContainer.innerHTML = '';
    if (!petState.outfits) petState.outfits = [];

    petState.outfits.forEach(outfit => {
      const config = (petState.outfitConfigs && petState.outfitConfigs[outfit])
        || defaultOutfitConfigs[outfit]
        || { x: 45, y: -10, scale: 60 };

      const div = document.createElement('div');
      div.innerText = outfit;
      div.style.position = 'absolute';
      div.style.left = `${config.x}px`;
      div.style.top = `${config.y}px`;
      div.style.fontSize = `${config.scale}px`;
      div.style.pointerEvents = isOutfitEditMode ? 'auto' : 'none';
      div.style.cursor = isOutfitEditMode ? 'grab' : 'default';
      div.style.zIndex = '5';

      div.addEventListener('mousedown', (e) => {
        if (!isOutfitEditMode) return;
        isDraggingOutfit = true;
        activeDraggingOutfit = outfit;
        activeDraggingElement = div;

        outfitDragStartX = e.clientX;
        outfitDragStartY = e.clientY;
        div.style.cursor = 'grabbing';

        const rect = outfitContainer.getBoundingClientRect();
        const outfitRect = div.getBoundingClientRect();
        outfitStartLeft = outfitRect.left - rect.left;
        outfitStartTop = outfitRect.top - rect.top;

        e.preventDefault();
        e.stopPropagation();
      });

      div.addEventListener('wheel', (e) => {
        if (!isOutfitEditMode) return;
        e.preventDefault();
        let currentScale = parseInt(div.style.fontSize || 60);
        if (e.deltaY < 0) {
          currentScale += 2;
        } else {
          currentScale -= 2;
        }
        if (currentScale < 10) currentScale = 10;
        if (currentScale > 150) currentScale = 150;

        div.style.fontSize = `${currentScale}px`;

        if (!petState.outfitConfigs) petState.outfitConfigs = {};
        if (!petState.outfitConfigs[outfit]) petState.outfitConfigs[outfit] = {};
        petState.outfitConfigs[outfit].scale = currentScale;
        savePetState();

        ipcRenderer.send('outfit-pos-updated', { outfit, scale: currentScale });
      });

      outfitContainer.appendChild(div);
    });
  }

  // Event listeners for global dragging
  window.addEventListener('mousemove', (e) => {
    if (isDraggingOutfit && activeDraggingElement) {
      const flip = parseInt(document.getElementById('kiwi-wrapper').style.getPropertyValue('--flip')) || 1;
      const dx = (e.clientX - outfitDragStartX) * flip;
      const dy = (e.clientY - outfitDragStartY);
      let newLeft = outfitStartLeft + dx;
      let newTop = outfitStartTop + dy;

      activeDraggingElement.style.left = `${newLeft}px`;
      activeDraggingElement.style.top = `${newTop}px`;
      ipcRenderer.send('outfit-pos-updated', { outfit: activeDraggingOutfit, x: newLeft, y: newTop });
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (isDraggingOutfit && activeDraggingElement) {
      isDraggingOutfit = false;
      activeDraggingElement.style.cursor = 'grab';

      const currentLeft = parseInt(activeDraggingElement.style.left || 0);
      const currentTop = parseInt(activeDraggingElement.style.top || 0);
      const currentScale = parseInt(activeDraggingElement.style.fontSize || 60);

      if (!petState.outfitConfigs) petState.outfitConfigs = {};
      if (!petState.outfitConfigs[activeDraggingOutfit]) petState.outfitConfigs[activeDraggingOutfit] = {};

      petState.outfitConfigs[activeDraggingOutfit].x = currentLeft;
      petState.outfitConfigs[activeDraggingOutfit].y = currentTop;
      petState.outfitConfigs[activeDraggingOutfit].scale = currentScale;
      savePetState();

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
  });

  ipcRenderer.on('update-outfit', (event, newOutfits) => {
    petState.outfits = newOutfits || [];
    savePetState();
    applyOutfitPos();
    if (kiwi) {
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    }
  });

  ipcRenderer.on('update-outfit-pos', (event, { outfit, x, y, scale }) => {
    if (!petState.outfitConfigs) petState.outfitConfigs = {};
    if (!petState.outfitConfigs[outfit]) {
      petState.outfitConfigs[outfit] = defaultOutfitConfigs[outfit] || { x: 45, y: -10, scale: 60 };
    }
    if (x !== undefined) petState.outfitConfigs[outfit].x = x;
    if (y !== undefined) petState.outfitConfigs[outfit].y = y;
    if (scale !== undefined) petState.outfitConfigs[outfit].scale = scale;

    savePetState();
    applyOutfitPos();
  });

  // Initial load
  if (petState.outfits && petState.outfits.length > 0) {
    applyOutfitPos();
  }

  return {
    applyOutfitPos
  };
}

module.exports = {
  init,
  getIsOutfitEditMode: () => isOutfitEditMode,
  setOutfitEditMode: (val) => { isOutfitEditMode = val; },
  getIsDraggingOutfit: () => isDraggingOutfit
};
