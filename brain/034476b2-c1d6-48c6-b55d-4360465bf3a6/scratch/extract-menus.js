const fs = require('fs');
let lines = fs.readFileSync('src/views/main/renderer.js', 'utf8').split('\n');
const keep = [];
let i = 0;
while (i < lines.length) {
  if (lines[i].includes('kiwi.addEventListener(\'contextmenu\'')) {
    // skip down to isSettingsEditMode
    while(!lines[i].includes('let isSettingsEditMode = false;')) { i++; }
    continue;
  }
  if (lines[i].includes('menuSettings.addEventListener(\'click\'')) {
    // skip down 4 lines
    i += 4;
    continue;
  }
  if (lines[i].includes('menuSleep.addEventListener(\'click\'')) {
    // skip down to menuLaser
    while(i < lines.length && !lines[i].includes('if (menuLaser) {')) { i++; }
    // skip menuLaser
    while(i < lines.length && !lines[i].includes('function getRealWindowPos()')) { i++; }
    continue;
  }
  keep.push(lines[i]);
  i++;
}

// insert init at line 30 roughly
const initCode = `
const menus = require('./modules/menus');
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
  laser
});
`;
keep.splice(30, 0, initCode);

fs.writeFileSync('src/views/main/renderer.js', keep.join('\n'), 'utf8');
console.log('Done');
