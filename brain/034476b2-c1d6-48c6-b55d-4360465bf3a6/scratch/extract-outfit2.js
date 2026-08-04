const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/renderer.js');
let content = fs.readFileSync(file, 'utf8');
const EOL = content.includes('\r\n') ? '\r\n' : '\n';

function removeBlock(startStr, endStr) {
  const startIndex = content.indexOf(startStr);
  if (startIndex === -1) {
    console.error("COULD NOT FIND START:", startStr);
    return false;
  }
  const endIndex = content.indexOf(endStr, startIndex);
  if (endIndex === -1) {
    console.error("COULD NOT FIND END:", endStr);
    return false;
  }
  
  // Find the start of the line for startStr
  let realStart = startIndex;
  while (realStart > 0 && content[realStart - 1] !== '\n') {
    realStart--;
  }
  
  // Find the end of the line for endStr
  let realEnd = endIndex + endStr.length;
  if (content[realEnd] === '\r') realEnd++;
  if (content[realEnd] === '\n') realEnd++;
  
  content = content.substring(0, realStart) + content.substring(realEnd);
  return true;
}

// 1. Remove outfit declarations
removeBlock("const outfits = [''", "];");
removeBlock("const defaultOutfitConfigs = {", "};");
removeBlock("let isOutfitEditMode = false;", "let isOutfitEditMode = false;");
removeBlock("const kiwiOutfit = document.getElementById('kiwi-outfit');", "const kiwiOutfit = document.getElementById('kiwi-outfit');");

// 2. Remove initial outfit load
removeBlock("if (petState.outfits && petState.outfits.length > 0) {", "  applyOutfitPos();\n}");

// 3. Remove IPC listeners
removeBlock("ipcRenderer.on('outfit-closed', () => {", "  kiwi.style.animation = ''; // 恢復呼吸動畫\n});");
removeBlock("ipcRenderer.on('update-outfit', (event, newOutfits) => {", "  setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);\n});");
removeBlock("ipcRenderer.on('update-outfit-pos', (event, { outfit, x, y, scale }) => {", "  applyOutfitPos();\n});");

// 4. Remove drag variables and applyOutfitPos
removeBlock("let activeDraggingOutfit = null;", "let outfitStartTop = 0;");
removeBlock("function applyOutfitPos() {", "    outfitContainer.appendChild(div);\n  });\n}");

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
content = content.replace(mouseMoveOld.replace(/\n/g, EOL), '  if (isDraggingBed) {');

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
content = content.replace(mouseUpOld.replace(/\n/g, EOL), '  if (isDraggingBed) {');

// 7. Inject outfit module require and init
const requireStr = `const wandering = require('./modules/wandering');${EOL}const outfit = require('./modules/outfit');`;
content = content.replace("const wandering = require('./modules/wandering');", requireStr);

const outfitInit = `
outfit.init({
  outfitContainer, kiwi,
  petState, savePetState, loadPetState,
  ipcRenderer
});
`.replace(/\n/g, EOL);
content = content.replace("wandering.init({", outfitInit + "wandering.init({");

// 8. Update menus.init references
content = content.replace("setOutfitEditMode: (v) => isOutfitEditMode = v,", "setOutfitEditMode: (v) => outfit.setOutfitEditMode(v),");
content = content.replace("getIsDraggingOutfit: () => typeof isDraggingOutfit !== 'undefined' ? isDraggingOutfit : false,", "getIsDraggingOutfit: () => outfit.getIsDraggingOutfit(),");

// 9. Fix physics getIsDraggingOutfit reference
content = content.replace("physics.getIsDragging() || isDraggingOutfit", "physics.getIsDragging() || outfit.getIsDraggingOutfit()");

// 10. Remove outfit references from exports/imports (if any)
content = content.replace(`  applyOutfitPos,${EOL}`, "");

fs.writeFileSync(file, content);
console.log("renderer.js updated successfully.");
