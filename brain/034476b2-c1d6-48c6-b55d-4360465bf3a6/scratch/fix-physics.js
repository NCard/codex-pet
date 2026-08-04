const fs = require('fs');

const chatPath = 'src/views/main/modules/chat.js';
let chatLines = fs.readFileSync(chatPath, 'utf8').split('\n');

// find physicsCtx start
const pStart = chatLines.findIndex(l => l.includes('const physicsCtx = {'));
let pEnd = pStart;
while (pEnd < chatLines.length && !chatLines[pEnd].includes('physics.initDragging')) {
  pEnd++;
}

if (pStart > -1 && pEnd > -1) {
  chatLines.splice(pStart, (pEnd - pStart) + 1);
  fs.writeFileSync(chatPath, chatLines.join('\n'), 'utf8');
  console.log('Removed physics from chat.js');
}

const rendererPath = 'src/views/main/renderer.js';
let rLines = fs.readFileSync(rendererPath, 'utf8').split('\n');
const chatInit = rLines.findIndex(l => l.includes('const chat = require(\'./modules/chat\');'));

const physicsCode = `
const physicsCtx = {
  get kiwi() { return kiwi; },
  get kiwiAccessory() { return kiwiAccessory; },
  get chatInput() { return chatInput; },
  get chatEscHint() { return typeof chatEscHint !== 'undefined' ? chatEscHint : null; },
  get chatBubble() { return chatBubble; },
  getCurrentAction: () => currentAction,
  setCurrentAction: (val) => { currentAction = val; },
  setPos: (newX, newY) => { x = newX; y = newY; },
  getPetState: () => petState
};
physics.initDragging(physicsCtx);
`;

rLines.splice(chatInit, 0, physicsCode);
fs.writeFileSync(rendererPath, rLines.join('\n'), 'utf8');
console.log('Added physics to renderer.js');
