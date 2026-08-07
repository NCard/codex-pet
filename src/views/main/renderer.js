require('../../utils/logger');
window.onerror = function (message, source, lineno, colno, error) {
  console.error('[Renderer Global Error]:', message, 'at', lineno + ':' + colno, error);
};
window.addEventListener('unhandledrejection', function (event) {
  console.error('[Renderer UnhandledRejection]:', event.reason);
});
const kiwi = document.getElementById('kiwi-sprite-wrapper');
const chatBubble = document.getElementById('chat-bubble');
const chatContent = document.getElementById('chat-content');
const chatClose = document.getElementById('chat-close');
const chatClear = document.getElementById('chat-clear');
const chatInput = document.getElementById('chat-input');
const chatEscHint = document.getElementById('chat-esc-hint');
const customMenu = document.getElementById('custom-menu');
const menuSleep = document.getElementById('menu-sleep');
const menuClose = document.getElementById('menu-close');
const menuHistory = document.getElementById('menu-history');
const menuAlarm = document.getElementById('menu-alarm');
const menuTodo = document.getElementById('menu-todo');
const menuFeed = document.getElementById('menu-feed');
const menuPet = document.getElementById('menu-pet');
const menuLaser = document.getElementById('menu-laser');
const menuOutfit = document.getElementById('menu-outfit');
const menuSettings = document.getElementById('menu-settings');
const laserDot = document.getElementById('laser-dot');

const kiwiBed = document.getElementById('kiwi-bed');


const path = require('path');
const { petStatePath: statePath, historyPath, alarmsPath } = require('../../utils/paths');
const physics = require('./physics');
const state = require('./state');
const laser = require('./modules/laser');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { ipcRenderer } = require('electron');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { GoogleGenAI } = require('@google/genai');
const cryptoUtils = require('../../utils/crypto_utils');
const { spawn } = require('child_process');
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

// 載入設定檔套用 CSS 變數
function applySettings(settings) {
  if (!settings) return;
  const root = document.documentElement;
  if (settings.bedX !== undefined) root.style.setProperty('--bed-x', `${settings.bedX}px`);
  if (settings.bedY !== undefined) root.style.setProperty('--bed-y', `${settings.bedY}px`);
  if (settings.bedScale !== undefined) root.style.setProperty('--bed-scale', `${settings.bedScale}px`);
  if (settings.bedZ !== undefined) root.style.setProperty('--bed-z', settings.bedZ);
  if (settings.animSpeed !== undefined) root.style.setProperty('--anim-speed', settings.animSpeed);
}

// 初始化 MCP Client
let mcpClient = null;
let mcpToolsList = [];
let geminiTools = [];

async function initMCP() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '../../mcp/mcp-server.js')],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });

  mcpClient = new Client({ name: "wiki-wiki-client", version: "1.0.0" }, { capabilities: {} });
  await mcpClient.connect(transport);

  const toolsRes = await mcpClient.listTools();
  mcpToolsList = toolsRes.tools;

  if (mcpToolsList.length > 0) {
    geminiTools = [{
      functionDeclarations: mcpToolsList.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }))
    }];
  }
  console.log("MCP Client initialized, tools:", mcpToolsList.map(t => t.name));
}

initMCP().catch(console.error);

const stateManager = require('./state.js');
let petState = stateManager.petState;

// 啟動時載入狀態
stateManager.loadPetState();

// 為了相容原本直接呼叫這幾個函式的地方，建立 alias
const loadPetState = () => stateManager.loadPetState();
const savePetState = () => stateManager.savePetState();
const saveChatHistory = (role, message) => stateManager.saveChatHistory(role, message);
const clearChatHistory = () => stateManager.clearChatHistory();
applySettings(petState.settings);
// 初始化待辦事項 UI
// (已經移至獨立視窗)
const outfitContainer = document.getElementById('outfit-container');
// 初始化裝扮

// 番茄鐘狀態
let pomodoroTimer = null;
let isWorking = false;

// 初始化 Gemini API 客戶端
let ai = null;

function initAI() {
  const apiKey = (petState.settings && petState.settings.apiKey) ? petState.settings.apiKey : process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
  } else {
    ai = null;
  }
}
initAI();
const kiwiAccessory = document.getElementById('kiwi-accessory');

// 取得對話泡泡內部元素
// 右鍵點擊奇異鳥，顯示自訂右鍵選單
let isSettingsEditMode = false;
let isDraggingBed = false;
let bedDragStartX = 0;
let bedDragStartY = 0;
let bedStartMarginLeft = 0;
let bedStartMarginBottom = 0;


ipcRenderer.on('toggle-bed-edit', (event, isEditing) => {
  if (isEditing) {
    isSettingsEditMode = true;
    kiwi.classList.add('sleeping');
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
    kiwi.style.pointerEvents = 'none';
    kiwiBed.style.display = 'block';
    kiwiBed.style.pointerEvents = 'auto';
    kiwiBed.style.cursor = 'grab';
  } else {
    isSettingsEditMode = false;
    kiwiBed.style.pointerEvents = 'none';
    kiwiBed.style.cursor = 'default';
    kiwi.style.pointerEvents = 'auto';
    if (currentAction !== 'sleeping') {
      kiwiBed.style.display = 'none';
      kiwi.classList.remove('sleeping');
      document.getElementById('kiwi-img').src = '../../../assets/images/kiwi.png';
    }
  }
});

ipcRenderer.on('settings-closed', () => {
  isSettingsEditMode = false;
  kiwiBed.style.pointerEvents = 'none';
  kiwiBed.style.cursor = 'default';
  kiwi.style.pointerEvents = 'auto';

  if (currentAction !== 'sleeping') {
    kiwiBed.style.display = 'none';
    kiwi.classList.remove('sleeping');
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi.png';
  }
});

// 監聽設定更新
ipcRenderer.on('update-settings', (event, newSettings) => {
  petState.settings = newSettings;
  applySettings(newSettings);
  savePetState();
  initAI();
});

ipcRenderer.on('preview-settings', (event, newSettings) => {
  petState.settings = newSettings;
  applySettings(newSettings);
  initAI();
});


ipcRenderer.on('reload-data', () => {
  loadPetState();
});




kiwiBed.addEventListener('mousedown', (e) => {
  if (!isSettingsEditMode) return;
  isDraggingBed = true;
  bedDragStartX = e.clientX;
  bedDragStartY = e.clientY;
  kiwiBed.style.cursor = 'grabbing';

  if (!petState.settings) petState.settings = {};
  bedStartMarginLeft = petState.settings.bedX ?? -4;
  bedStartMarginBottom = petState.settings.bedY ?? -15;

  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener('mousemove', (e) => {
  // 加入翻轉參數來修正拖曳方向
  const flip = parseInt(document.getElementById('kiwi-wrapper').style.getPropertyValue('--flip')) || 1;

  if (isDraggingBed) {
    const flip = parseInt(document.getElementById('kiwi-wrapper').style.getPropertyValue('--flip')) || 1;
    const dx = (e.clientX - bedDragStartX) * flip;
    const dy = (e.clientY - bedDragStartY);
    const newBedX = bedStartMarginLeft + dx;
    const newBedY = bedStartMarginBottom - dy; // margin-bottom direction

    petState.settings.bedX = newBedX;
    petState.settings.bedY = newBedY;

    applySettings(petState.settings);
    ipcRenderer.send('settings-dragged', { bedX: newBedX, bedY: newBedY });
  }
});

window.addEventListener('mouseup', (e) => {
  if (isDraggingBed) {
    isDraggingBed = false;
    kiwiBed.style.cursor = 'grab';
    savePetState();
  }
});

// Note: outfit wheel event is now bound directly to the active element in applyOutfitPos

kiwiBed.addEventListener('wheel', (e) => {
  if (!isSettingsEditMode) return;
  e.preventDefault();

  if (!petState.settings) petState.settings = {};
  let currentScale = petState.settings.bedScale ?? 170;

  if (e.deltaY < 0) {
    currentScale += 5;
  } else {
    currentScale -= 5;
  }
  if (currentScale < 50) currentScale = 50;
  if (currentScale > 300) currentScale = 300;

  petState.settings.bedScale = currentScale;
  applySettings(petState.settings);
  savePetState();

  ipcRenderer.send('settings-dragged', { bedScale: currentScale });
});

function getRealWindowPos() {
  try {
    const pos = ipcRenderer.sendSync('get-window-pos');
    if (pos && typeof pos.x === 'number' && !isNaN(pos.x) && typeof pos.y === 'number' && !isNaN(pos.y)) {
      return { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
  } catch (e) { }
  const sx = Math.round(Number(window.screenX)) || 0;
  const sy = Math.round(Number(window.screenY)) || 0;
  return { x: sx, y: sy };
}

function getResolutionScale() {
  const width = window.screen.bounds ? window.screen.bounds.width : window.screen.width;
  return width / 1920;
}

const initialPos = getRealWindowPos();
let x = initialPos.x;
let y = initialPos.y;

let currentAction = 'idle'; // 'idle', 'moving', 'eating', 'sleeping'
let idleTime = 0; // 閒置計時器
let ignoreWakeup = false;

// 重置閒置狀態
function resetIdle() {
  idleTime = 0;
  if (ignoreWakeup || isSettingsEditMode) return;

  if (currentAction === 'sleeping' || kiwi.classList.contains('sleeping')) {
    kiwi.classList.remove('sleeping');
    currentAction = 'idle'; // 醒來後恢復閒置
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'none';
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi.png';
    document.getElementById('kiwi-bed').style.display = 'none';
    if (typeof outfitContainer !== 'undefined' && outfitContainer) outfitContainer.style.display = 'block';
  }
}
window.addEventListener('mousemove', resetIdle);
window.addEventListener('mousedown', resetIdle);
window.addEventListener('keydown', resetIdle);

// 閒置檢查計時器 (每秒執行)
setInterval(() => {
  idleTime++;
  // 如果 60 秒沒有互動，就睡覺
  if (idleTime > 60 && currentAction === 'idle' && !kiwi.classList.contains('sleeping') && !isWorking && !physics.getIsDragging()) {
    currentAction = 'sleeping'; // 進入睡覺狀態
    kiwi.classList.add('sleeping');
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'block';
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
    document.getElementById('kiwi-bed').style.display = 'block';
    if (typeof outfitContainer !== 'undefined' && outfitContainer) outfitContainer.style.display = 'none';
  }
}, 1000);



const wandering = require('./modules/wandering');
const outfit = require('./modules/outfit');

const { applyOutfitPos } = outfit.init({
  outfitContainer, kiwi,
  petState, savePetState, loadPetState,
  ipcRenderer
});
wandering.init({
  laser, getCurrentAction: () => currentAction, setCurrentAction: (action) => currentAction = action,
  kiwi, getIsWorking: () => isWorking, chatBubble, chatInput, getRealWindowPos, getResolutionScale,
  ipcRenderer, setWindowPos: (newX, newY) => { x = newX; y = newY; }
});
// CPU 監控與狀態隨時間遞減
let lastCpu = os.cpus();
setInterval(() => {
  const currentCpu = os.cpus();
  let idle = 0, total = 0;
  for (let i = 0; i < currentCpu.length; i++) {
    for (let type in currentCpu[i].times) {
      total += currentCpu[i].times[type] - lastCpu[i].times[type];
      if (type === 'idle') idle += currentCpu[i].times[type] - lastCpu[i].times[type];
    }
  }
  const usage = total === 0 ? 0 : 100 - ~~(100 * idle / total);
  lastCpu = currentCpu;

  // 隨時間降低飢餓與心情 (不會小於 0)
  petState.hunger = Math.max(0, petState.hunger - 1);
  petState.mood = Math.max(0, petState.mood - 1);

  const isExcludedState = currentAction === 'sleeping' || kiwi.classList.contains('sleeping') || currentAction === 'grabbed' || physics.getIsDragging();

  if (usage > 70) {
    if (!isWorking && kiwiAccessory.style.display === 'none' && !isExcludedState) {
      kiwiAccessory.innerText = '💦';
      kiwiAccessory.style.display = 'block';
    }
    if (!isExcludedState) {
      const img = document.getElementById('kiwi-img');
      if (!img.src.includes('kiwi_tired.png')) {
        img.src = '../../../assets/images/kiwi_tired.png';
      }
      img.classList.add('kiwi-tired');
    }
  } else {
    if (!isWorking && kiwiAccessory.innerText === '💦') {
      kiwiAccessory.style.display = 'none';
    }
    if (!isExcludedState) {
      const img = document.getElementById('kiwi-img');
      if (!img.src.includes('kiwi_sleep.png') && img.src.includes('kiwi_tired.png')) {
        img.src = '../../../assets/images/kiwi.png';
      }
      img.classList.remove('kiwi-tired');
    }
  }

  // 定期自動存檔
  if (Math.random() < 0.2) savePetState();
}, 10000);

// 強制切換一次穿透狀態，打破 Electron 內部快取，修復 Windows 熱重載失效的 Bug
ipcRenderer.send('set-ignore-mouse-events', false);
setTimeout(() => {
  ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
}, 100);


// 滑鼠穿透判定邏輯 (優化：快取狀態避免重複 IPC 造成拖曳抖動與延遲)
let lastIgnoreState = null;

window.addEventListener('mousemove', (event) => {
  if (physics.getIsDragging() || outfit.getIsDraggingOutfit() || isDraggingBed) {
    if (lastIgnoreState !== false) {
      lastIgnoreState = false;
      ipcRenderer.send('set-ignore-mouse-events', false);
    }
    return;
  }

  const isInteractive = !!event.target.closest('.chat-bubble, #chat-input, #custom-menu, #kiwi-sprite-wrapper, #kiwi-bed, #chat-close');
  const ignore = !isInteractive;

  if (lastIgnoreState !== ignore) {
    lastIgnoreState = ignore;
    ipcRenderer.send('set-ignore-mouse-events', ignore, { forward: true });
  }
});





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

const chat = require('./modules/chat');
const { showTempBubble, showAlarmBubble, openChat } = chat.init({
  chatBubble, chatContent, chatClose, chatClear, chatInput, chatEscHint, customMenu,
  kiwi, kiwiAccessory, namePrefix: '<span style="color: #c97a2e; font-weight: 900;">Wiki Wiki：</span>',
  petState, savePetState, loadPetState, applyOutfitPos,
  getIsWorking: () => isWorking, setIsWorking: (v) => isWorking = v,
  laser, ai, mcpClient, geminiTools, crypto,
  saveChatHistory: (role, message) => stateManager.saveChatHistory(role, message),
  clearChatHistory: () => stateManager.clearChatHistory(),
  resetIdle, ipcRenderer
});
physicsCtx.openChat = openChat;

// Update menus and interaction dependency injections
const menus = require('./modules/menus');
const interaction = require('./modules/interaction');

laser.init({
  ipcRenderer, kiwi, laserDot,
  customMenu, showTempBubble, getRealWindowPos, physics,
  setCurrentAction: (action) => currentAction = action,
  getCurrentAction: () => currentAction,
  setWindowPos: (newX, newY) => { x = newX; y = newY; }
});

menus.init({
  kiwi, customMenu, ipcRenderer, petState, savePetState,
  getCurrentAction: () => currentAction, setCurrentAction: (act) => currentAction = act,
  showTempBubble, kiwiAccessory, getIsWorking: () => isWorking,
  setOutfitEditMode: (v) => outfit.setOutfitEditMode(v),
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
  getIsDraggingOutfit: () => outfit.getIsDraggingOutfit(),
  getIsDraggingBed: () => typeof isDraggingBed !== 'undefined' ? isDraggingBed : false,
  petState,
  savePetState,
  showTempBubble
});


const alarmModule = require('./modules/alarm');
alarmModule.init({ alarmsPath, laser, resetIdle, showAlarmBubble, kiwi, ipcRenderer });
