const fs = require('fs');

const rendererPath = 'src/views/main/renderer.js';
const chatPath = 'src/views/main/modules/chat.js';

let lines = fs.readFileSync(rendererPath, 'utf8').split('\n');

// Find the start of chat code: "const chatContent = document.getElementById('chat-content');"
const startIdx = lines.findIndex(l => l.includes("const chatContent = document.getElementById('chat-content');"));
// Find the end: "// 右鍵點擊奇異鳥，顯示自訂右鍵選單"
const endIdx = lines.findIndex(l => l.includes("// 右鍵點擊奇異鳥，顯示自訂右鍵選單"));

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find boundaries!");
  process.exit(1);
}

const chatLines = lines.splice(startIdx, endIdx - startIdx);

let chatJSContent = `
let bubbleTimeout = null;
let isAlarmActive = false;
let snoozedAlarms = [];
let pomodoroTimer = null;

function init({
  chatBubble, chatContent, chatClose, chatInput, chatEscHint, customMenu,
  kiwi, kiwiAccessory, namePrefix,
  petState, savePetState, loadPetState, applyOutfitPos,
  getIsWorking, setIsWorking,
  laser, ai, mcpClient, geminiTools, crypto,
  saveChatHistory, clearChatHistory, resetIdle, ipcRenderer
}) {
`;

// Modify the extracted lines: Replace isWorking = ... with setIsWorking(...)
// And remove global let declarations that are now in module scope.
const modifiedLines = chatLines.map(line => {
  if (line.includes('let bubbleTimeout = null;')) return '';
  if (line.includes('let isAlarmActive = false;')) return '';
  if (line.includes('let snoozedAlarms = [];')) return '';
  if (line.includes('let pomodoroTimer = null;')) return '';
  
  if (line.includes('isWorking = true;')) return line.replace('isWorking = true;', 'setIsWorking(true);');
  if (line.includes('isWorking = false;')) return line.replace('isWorking = false;', 'setIsWorking(false);');
  
  return '  ' + line;
});

chatJSContent += modifiedLines.join('\n');
chatJSContent += `
  return { showTempBubble, showAlarmBubble };
}
module.exports = { init };
`;

fs.writeFileSync(chatPath, chatJSContent, 'utf8');
console.log('chat.js created');

// Insert chat.init at the end of renderer.js
const initCall = `
const chat = require('./modules/chat');
const { showTempBubble, showAlarmBubble } = chat.init({
  chatBubble, chatContent, chatClose, chatInput, chatEscHint, customMenu,
  kiwi, kiwiAccessory, namePrefix: '<span style="color: #c97a2e; font-weight: 900;">Wiki Wiki：</span>',
  petState, savePetState, loadPetState, applyOutfitPos,
  getIsWorking: () => isWorking, setIsWorking: (v) => isWorking = v,
  laser, ai, mcpClient, geminiTools, crypto,
  saveChatHistory: (role, message) => stateManager.saveChatHistory(role, message),
  clearChatHistory: () => stateManager.clearChatHistory(),
  resetIdle, ipcRenderer
});

// Update menus and interaction dependency injections
menus.init({
  kiwi, customMenu, ipcRenderer, petState, savePetState, 
  getCurrentAction: () => currentAction, setCurrentAction: (act) => currentAction = act, 
  showTempBubble, kiwiAccessory, getIsWorking: () => isWorking,
  setOutfitEditMode: (v) => isOutfitEditMode = v, 
  setIgnoreWakeup: (v) => ignoreWakeup = v,
  elements: {
    menuTodo, menuFeed, menuPet, menuOutfit, menuSettings,
    menuSleep, menuHistory, menuAlarm, menuClose, menuLaser,
    outfitContainer
  },
  laser, interaction
});

interaction.init({
  kiwi,
  getCurrentAction: () => currentAction,
  setCurrentAction: (action) => currentAction = action,
  physics,
  getIsDraggingOutfit: () => typeof isDraggingOutfit !== 'undefined' ? isDraggingOutfit : false,
  getIsDraggingBed: () => typeof isDraggingBed !== 'undefined' ? isDraggingBed : false,
  petState,
  savePetState,
  showTempBubble
});
`;

// Wait, I need to remove the existing menus.init and interaction.init in renderer.js
// Find them and remove them.
const menusStart = lines.findIndex(l => l.includes('menus.init({'));
if(menusStart > -1) {
  let menusEnd = menusStart;
  while(menusEnd < lines.length && !lines[menusEnd].includes('});')) menusEnd++;
  lines.splice(menusStart - 1, (menusEnd - menusStart) + 2); // Also removes `const menus = require('./modules/menus');`
}

const intStart = lines.findIndex(l => l.includes('interaction.init({'));
if(intStart > -1) {
  let intEnd = intStart;
  while(intEnd < lines.length && !lines[intEnd].includes('});')) intEnd++;
  lines.splice(intStart - 1, (intEnd - intStart) + 2);
}

// Append initCall to the end
lines.push(initCall);

// Wait, is crypto required globally? crypto is a built-in module. `const crypto = require('crypto');` is at the top of renderer.js
// We pass it in init params.

fs.writeFileSync(rendererPath, lines.join('\n'), 'utf8');
console.log('renderer.js updated');
