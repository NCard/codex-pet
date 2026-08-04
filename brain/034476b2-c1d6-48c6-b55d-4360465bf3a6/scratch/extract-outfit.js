const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/renderer.js');
let content = fs.readFileSync(file, 'utf8');

function removeBlock(startStr, endStr) {
  const startIndex = content.indexOf(startStr);
  if (startIndex === -1) return false;
  const endIndex = content.indexOf(endStr, startIndex);
  if (endIndex === -1) return false;
  content = content.substring(0, startIndex) + content.substring(endIndex + endStr.length);
  return true;
}

// 1. Remove outfit declarations
removeBlock("const outfits = [''", "];\r\n");
removeBlock("const defaultOutfitConfigs = {", "};\r\n");
content = content.replace(/let isOutfitEditMode = false;\r?\n/, '');

// 2. Remove initial outfit load
removeBlock("if (petState.outfits && petState.outfits.length > 0) {", "  applyOutfitPos();\r\n}\r\n");

// 3. Remove IPC listeners
removeBlock("ipcRenderer.on('outfit-closed', () => {", "  kiwi.style.animation = ''; // ?復?吸?畫\r\n});\r\n");
removeBlock("ipcRenderer.on('update-outfit', (event, newOutfits) => {", "  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);\r\n});\r\n");
removeBlock("ipcRenderer.on('update-outfit-pos', (event, { outfit, x, y, scale }) => {", "  applyOutfitPos();\r\n});\r\n");

// 4. Remove drag variables and applyOutfitPos
removeBlock("let activeDraggingOutfit = null;", "let outfitStartTop = 0;\r\n");
removeBlock("function applyOutfitPos() {", "    outfitContainer.appendChild(div);\r\n  });\r\n}\r\n");

// 5. Update mousemove event
const mouseMoveOld = `  if (isDraggingOutfit && activeDraggingElement) {
    const dx = (e.clientX - outfitDragStartX) * flip;
    const dy = (e.clientY - outfitDragStartY);
    let newLeft = outfitStartLeft + dx;
    let newTop = outfitStartTop + dy;

    activeDraggingElement.style.left = \`\${newLeft}px\`;
    activeDraggingElement.style.top = \`\${newTop}px\`;
    ipcRenderer.send('outfit-pos-updated', { outfit: activeDraggingOutfit, x: newLeft, y: newTop });
  } else if (isDraggingBed) {`;
content = content.replace(mouseMoveOld, '  if (isDraggingBed) {');

// 6. Update mouseup event
const mouseUpOld = `  if (isDraggingOutfit && activeDraggingElement) {
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
  } else if (isDraggingBed) {`;
content = content.replace(mouseUpOld, '  if (isDraggingBed) {');

// 7. Inject outfit module require and init
const requireStr = `const wandering = require('./modules/wandering');\r\nconst outfit = require('./modules/outfit');`;
content = content.replace("const wandering = require('./modules/wandering');", requireStr);

const outfitInit = `
outfit.init({
  outfitContainer, kiwi,
  petState, savePetState, loadPetState,
  ipcRenderer
});
`;
content = content.replace("wandering.init({", outfitInit + "\r\nwandering.init({");

// 8. Update menus.init references
content = content.replace("setOutfitEditMode: (v) => isOutfitEditMode = v,", "setOutfitEditMode: (v) => outfit.setOutfitEditMode(v),");
content = content.replace("getIsDraggingOutfit: () => typeof isDraggingOutfit !== 'undefined' ? isDraggingOutfit : false,", "getIsDraggingOutfit: () => outfit.getIsDraggingOutfit(),");

// 9. Fix physics getIsDraggingOutfit reference
content = content.replace("physics.getIsDragging() || isDraggingOutfit", "physics.getIsDragging() || outfit.getIsDraggingOutfit()");

// 10. Remove outfit references from exports/imports (if any)
content = content.replace("applyOutfitPos,", ""); // L568

// Also remove `const kiwiOutfit = document.getElementById('kiwi-outfit');`
content = content.replace(/const kiwiOutfit = document\.getElementById\('kiwi-outfit'\);\r?\n/, '');

fs.writeFileSync(file, content);
console.log("renderer.js updated successfully.");
