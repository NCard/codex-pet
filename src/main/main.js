require('../utils/logger');
process.on('uncaughtException', (error) => {
  console.error('[Main UncaughtException]:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main UnhandledRejection]:', reason);
});
// 抑制第三方相依套件 (如 electron-reloader) 在 Node.js 22+ 的廢棄警告 [DEP0180]
process.noDeprecation = true;

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { petStatePath } = require('../utils/paths');
const { autoUpdater } = require('electron-updater');

// 停用 GPU Shader 硬碟快取，避免 Windows 環境下 GPUCache 鎖定衝突與 0x5 存取被拒錯誤
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// 單一實例鎖：僅在打包/安裝版啟用，防止使用者重複開啟多個實例
if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  }

  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // 當使用者在安裝版試圖打開第二個實例時，自動聚焦到現有的主視窗
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      // 讓奇異鳥跳躍一下提示使用者「我已經在這裡囉！」
      mainWindow.webContents.send('play-action', 'jump');
    }
  });
}

if (!app.isPackaged) {
  try {
    const reloader = require('electron-reloader');
    reloader(module, {
      ignore: [
        /data/,
        /docs/,
        /tests/,
        /\.git/,
        /\.system_generated/,
        /logs/,
        /app\.log/,
        /.*\.md$/
      ]
    });
  } catch (_) { }
}

let mainWindow = null;
let outfitWin = null;
let alarmWin = null;
let todoWin = null;
let historyWin = null;
let settingsWindow = null;

let splashWindow = null;
const SPLASH_MIN_MS = 500; // Splash 最短顯示時間
let splashShownAt = 0;
let mainReady = false;

function createSplashWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primaryDisplay.workAreaSize;
  const splashW = 200;
  const splashH = 240;

  splashWindow = new BrowserWindow({
    width: splashW,
    height: splashH,
    x: Math.round((sw - splashW) / 2),
    y: Math.round((sh - splashH) / 2),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, '../views/splash/splash.html'));
  splashShownAt = Date.now();
}

function closeSplashAndShowMain() {
  const elapsed = Date.now() - splashShownAt;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  }, remaining);
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const winWidth = 320;
  const winHeight = 580;

  const randomX = Math.floor(Math.random() * (screenWidth - winWidth));
  const randomY = Math.floor(Math.random() * (screenHeight - winHeight));

  mainWindow = new BrowserWindow({
    icon: path.join(__dirname, '../../assets/images/kiwi.png'),
    width: winWidth,
    height: winHeight,
    x: randomX,
    y: randomY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    show: false,   // 先隱藏，等 renderer 完成初始化後再顯示
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 設置初始穿透狀態 (讓透明區域穿透)
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // 修復 Windows 下熱重載 (Reload) 導致 forward: true 失效的 Bug
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setIgnoreMouseEvents(false);
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }, 50);
  });

  mainWindow.loadFile(path.join(__dirname, '../views/main/index.html'));
}

// 處理滑鼠穿透狀態切換
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const safeIgnore = Boolean(ignore);
    const safeOptions = (options && typeof options === 'object' && !Array.isArray(options)) ? options : { forward: true };
    try {
      win.setIgnoreMouseEvents(safeIgnore, safeOptions);
    } catch (e) {
      console.error('Error setting ignore mouse events:', e);
    }
  }
});

// 處理視窗拖曳 (允許超出螢幕)
ipcMain.on('window-move', (event, x, y) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const targetX = parseInt(x, 10);
    const targetY = parseInt(y, 10);
    if (Number.isInteger(targetX) && Number.isInteger(targetY) && Math.abs(targetX) < 100000 && Math.abs(targetY) < 100000) {
      try {
        win.setPosition(targetX, targetY);
      } catch (e) {
        // 忽略極端螢幕邊界下的原生 C++ 警告
      }
    }
  }
});

ipcMain.on('get-window-pos', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const [x, y] = win.getPosition();
    event.returnValue = { x, y };
  } else {
    event.returnValue = { x: 0, y: 0 };
  }
});

function registerGlobalShortcut() {
  globalShortcut.unregisterAll();
  let shortcut = 'CommandOrControl+Shift+K';
  try {
    if (fs.existsSync(petStatePath)) {
      const state = JSON.parse(fs.readFileSync(petStatePath, 'utf8'));
      if (state.settings && state.settings.summonShortcut) {
        shortcut = state.settings.summonShortcut;
      }
    }
  } catch (e) { }

  if (shortcut) {
    try {
      // Electron needs CommandOrControl instead of Ctrl
      const electronShortcut = shortcut.replace(/Ctrl/g, 'CommandOrControl');
      globalShortcut.register(electronShortcut, () => {
        if (mainWindow) {
          const point = screen.getCursorScreenPoint();
          const [width, height] = mainWindow.getSize();
          // Teleport to mouse position
          mainWindow.setPosition(Math.round(point.x - width / 2), Math.round(point.y - height / 2));
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('summon-kiwi');
        }
      });
    } catch (err) {
      console.error('Failed to register shortcut', err);
    }
  }
}

// Renderer 完成初始化後，關閉 Splash 顯示主視窗
ipcMain.once('app-ready', () => {
  closeSplashAndShowMain();
});

app.whenReady().then(() => {
  createSplashWindow();
  registerGlobalShortcut();
  createWindow();

  // ── 右鍵選單：預先建立隱藏視窗，避免每次開啟都要載入造成延遲 ──
  let contextMenuWin = null;
  let contextMenuReady = false;

  function createContextMenuWin() {
    if (contextMenuWin && !contextMenuWin.isDestroyed()) return;

    contextMenuWin = new BrowserWindow({
      width: 200,
      height: 360,
      show: false,             // 預先建立但隱藏
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      type: 'toolbar',
      resizable: false,
      movable: false,
      focusable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    contextMenuWin.loadFile(path.join(__dirname, '../views/context_menu/menu.html'));
    contextMenuWin.setAlwaysOnTop(true, 'pop-up-menu');

    contextMenuWin.once('ready-to-show', () => {
      contextMenuReady = true;
    });

    contextMenuWin.on('closed', () => {
      contextMenuWin = null;
      contextMenuReady = false;
      // 自動重建，保持預載狀態
      setTimeout(createContextMenuWin, 500);
    });

    contextMenuWin.on('blur', () => {
      if (contextMenuWin && !contextMenuWin.isDestroyed()) {
        contextMenuWin.hide();
        contextMenuLastHideTime = Date.now();
      }
    });
  }

  let contextMenuLastHideTime = 0;

  // 啟動時就預建選單視窗（後台載入，右鍵時秒開）
  createContextMenuWin();

  ipcMain.on('show-context-menu', (event, screenX, screenY) => {
    if (Date.now() - contextMenuLastHideTime < 250) {
      return; // 防止連點時因 blur 隱藏後立刻又被觸發顯示
    }
    
    if (!contextMenuWin || contextMenuWin.isDestroyed()) {
      createContextMenuWin();
      return; // 第一次還在載入中，忽略（通常不會到這，因為 createWindow 後就預建了）
    }

    // 取得滑鼠所在的螢幕（支援多螢幕）
    const display = screen.getDisplayNearestPoint({ x: screenX, y: screenY });
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

    const estimatedW = 200;
    const estimatedH = 360;

    let x = screenX + 5;
    let y = screenY - 10;

    // 防止超出當前螢幕邊界
    if (x + estimatedW > dx + dw) x = screenX - estimatedW - 5;
    if (y + estimatedH > dy + dh) y = dy + dh - estimatedH - 10;
    if (x < dx) x = dx;
    if (y < dy) y = dy;

    contextMenuWin.setBounds({ x: Math.round(x), y: Math.round(y), width: estimatedW, height: estimatedH });
    contextMenuWin.webContents.send('reset-menu');
    contextMenuWin.show();
    contextMenuWin.focus();
  });

  // 選單測量自己的尺寸後回報，讓視窗精確縮放
  ipcMain.on('menu-resize', (event, w, h) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    const newW = Math.ceil(w);
    const newH = Math.ceil(h);
    const [curX, curY] = win.getPosition();

    const display = screen.getDisplayNearestPoint({ x: curX, y: curY });
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

    let x = curX;
    let y = curY;
    if (x + newW > dx + dw) x = dx + dw - newW - 5;
    if (y + newH > dy + dh) y = dy + dh - newH - 5;
    if (x < dx) x = dx;
    if (y < dy) y = dy;

    win.setPosition(Math.round(x), Math.round(y));
    win.setSize(newW, newH);
  });

  // 選單項目被點擊
  ipcMain.on('menu-item-clicked', (event, action) => {
    // 點擊後隱藏選單
    if (contextMenuWin && !contextMenuWin.isDestroyed()) {
      contextMenuWin.hide();
      contextMenuLastHideTime = Date.now();
    }
    if (action === 'quit') {
      app.quit();
      return;
    }
    if (action !== 'cancel') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('menu-action', action);
      }
    }
  });


  ipcMain.on('open-history', () => {
    if (historyWin) {
      historyWin.focus();
      return;
    }
    historyWin = new BrowserWindow({
      icon: path.join(__dirname, '../../assets/images/kiwi.png'),
      width: 600,
      height: 800,
      title: 'Wiki Wiki 歷史對話紀錄',
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    historyWin.setMenu(null);
    historyWin.loadFile(path.join(__dirname, '../views/history/history.html'));
    historyWin.once('ready-to-show', () => historyWin.show());
    historyWin.on('closed', () => historyWin = null);
  });

  let inspectorWin = null;
  ipcMain.on('open-inspector', (event, data) => {
    if (inspectorWin && !inspectorWin.isDestroyed()) {
      inspectorWin.focus();
      inspectorWin.webContents.send('set-inspector-data', data);
      return;
    }
    inspectorWin = new BrowserWindow({
      icon: path.join(__dirname, '../../assets/images/kiwi.png'),
      width: 540,
      height: 680,
      minWidth: 420,
      minHeight: 450,
      title: 'Wiki Wiki Agent 檢閱板',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    inspectorWin.loadFile(path.join(__dirname, '../views/inspector/inspector.html'));
    inspectorWin.once('ready-to-show', () => {
      inspectorWin.show();
      inspectorWin.webContents.send('set-inspector-data', data);
    });
    inspectorWin.on('closed', () => { inspectorWin = null; });
  });

  ipcMain.on('open-alarm', () => {
    if (alarmWin) {
      alarmWin.focus();
      return;
    }
    alarmWin = new BrowserWindow({
      icon: path.join(__dirname, '../../assets/images/kiwi.png'),
      width: 500,
      height: 650,
      title: 'Wiki Wiki 鬧鐘排程',
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    alarmWin.setMenu(null);
    alarmWin.loadFile(path.join(__dirname, '../views/alarm/alarm.html'));
    alarmWin.once('ready-to-show', () => alarmWin.show());
    alarmWin.on('closed', () => alarmWin = null);
  });

  ipcMain.on('open-todo', () => {
    if (todoWin) {
      todoWin.focus();
      return;
    }
    todoWin = new BrowserWindow({
      icon: path.join(__dirname, '../../assets/images/kiwi.png'),
      width: 500,
      height: 650,
      title: 'Wiki Wiki 待辦事項',
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    todoWin.setMenu(null);
    todoWin.loadFile(path.join(__dirname, '../views/todo/todo.html'));
    todoWin.once('ready-to-show', () => todoWin.show());
    todoWin.on('closed', () => { todoWin = null; });
  });

  ipcMain.on('open-outfit', () => {
    if (outfitWin) {
      outfitWin.focus();
      return;
    }
    outfitWin = new BrowserWindow({
      icon: path.join(__dirname, '../../assets/images/kiwi.png'),
      width: 400,
      height: 550,
      title: 'Wiki Wiki 的衣櫥',
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    outfitWin.setMenu(null);
    outfitWin.loadFile(path.join(__dirname, '../views/outfit/outfit.html'));
    outfitWin.once('ready-to-show', () => outfitWin.show());
    outfitWin.on('closed', () => {
      outfitWin = null;
      if (mainWindow) mainWindow.webContents.send('outfit-closed');
    });
  });

  // Relay IPC events for outfit changes
  ipcMain.on('update-outfit', (event, data) => {
    if (mainWindow) mainWindow.webContents.send('update-outfit', data);
  });

  ipcMain.on('get-cursor-pos', (event) => {
    const point = screen.getCursorScreenPoint();
    const cursorDisplay = screen.getDisplayNearestPoint(point);
    const win = BrowserWindow.fromWebContents(event.sender);
    let windowDisplay = null;
    if (win && !win.isDestroyed()) {
      try {
        const [wx, wy] = win.getPosition();
        windowDisplay = screen.getDisplayNearestPoint({ x: wx + 160, y: wy + 450 });
      } catch { }
    }
    event.returnValue = {
      x: point.x,
      y: point.y,
      displayBounds: cursorDisplay ? cursorDisplay.bounds : null,
      displayWorkArea: cursorDisplay ? cursorDisplay.workArea : null,
      cursorDisplayId: cursorDisplay ? cursorDisplay.id : null,
      windowDisplayId: windowDisplay ? windowDisplay.id : null
    };
  });

  let laserOverlayWindows = [];

  function createLaserOverlayWindows() {
    closeLaserOverlayWindows();
    const displays = screen.getAllDisplays();

    laserOverlayWindows = displays.map((display) => {
      const win = new BrowserWindow({
        icon: path.join(__dirname, '../../assets/images/kiwi.png'),
        width: display.bounds.width,
        height: display.bounds.height,
        x: display.bounds.x,
        y: display.bounds.y,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      win.setIgnoreMouseEvents(true, { forward: true });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.loadFile(path.join(__dirname, '../views/main/laser_overlay.html'));
      return win;
    });
  }

  function closeLaserOverlayWindows() {
    laserOverlayWindows.forEach(win => {
      try {
        if (win && !win.isDestroyed()) win.close();
      } catch (e) { }
    });
    laserOverlayWindows = [];
  }

  ipcMain.on('toggle-laser-overlay', (event, enable) => {
    if (enable) {
      createLaserOverlayWindows();
    } else {
      closeLaserOverlayWindows();
    }
  });

  // 動態監聽螢幕插拔與解析度改變，自動重構多螢幕 Overlay 視窗
  screen.on('display-added', () => {
    if (laserOverlayWindows.length > 0) createLaserOverlayWindows();
  });
  screen.on('display-removed', () => {
    if (laserOverlayWindows.length > 0) createLaserOverlayWindows();
  });
  screen.on('display-metrics-changed', () => {
    if (laserOverlayWindows.length > 0) createLaserOverlayWindows();
  });

  ipcMain.on('update-outfit-pos', (event, data) => {
    if (mainWindow) mainWindow.webContents.send('update-outfit-pos', data);
  });

  ipcMain.on('outfit-pos-updated', (event, data) => {
    if (outfitWin) outfitWin.webContents.send('outfit-pos-updated', data);
  });

  ipcMain.on('open-settings', () => {
    if (settingsWindow) {
      settingsWindow.focus();
      return;
    }
    settingsWindow = new BrowserWindow({
      icon: path.join(__dirname, '../../assets/images/kiwi.png'),
      width: 380,
      height: 520,
      minWidth: 360,
      minHeight: 480,
      title: 'Wiki Wiki 設定中心',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    settingsWindow.loadFile(path.join(__dirname, '../views/settings/settings.html'));
    settingsWindow.once('ready-to-show', () => settingsWindow.show());
    settingsWindow.on('closed', () => {
      settingsWindow = null;
      if (mainWindow) mainWindow.webContents.send('settings-closed');
    });
  });

  ipcMain.on('toggle-bed-edit', (event, isEditing) => {
    if (mainWindow) mainWindow.webContents.send('toggle-bed-edit', isEditing);
  });

  ipcMain.on('settings-changed', (event, settingsData) => {
    registerGlobalShortcut();
    if (mainWindow) mainWindow.webContents.send('update-settings', settingsData);
  });

  ipcMain.on('settings-preview', (event, settingsData) => {
    if (mainWindow) mainWindow.webContents.send('preview-settings', settingsData);
  });

  ipcMain.on('settings-dragged', (event, settingsData) => {
    if (settingsWindow) settingsWindow.webContents.send('update-settings-ui', settingsData);
  });

  ipcMain.on('request-close-confirm', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    dialog.showMessageBox(win, {
      type: 'question',
      title: '關閉 Wiki Wiki',
      message: '確定要關閉奇異鳥小助手嗎？',
      buttons: ['確定關閉', '取消'],
      defaultId: 1,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        app.quit();
      }
    });
  });

  ipcMain.on('alarms-changed', () => {
    if (alarmWin) alarmWin.webContents.send('reload-data');
    if (mainWindow) mainWindow.webContents.send('reload-data');
  });

  ipcMain.on('alarm-enabled-notify', (event, alarm) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('alarm-enabled-notify', alarm);
    }
  });

  ipcMain.on('pet-state-changed', () => {
    if (todoWin) todoWin.webContents.send('reload-data');
    if (mainWindow) mainWindow.webContents.send('reload-data');
    if (settingsWindow) settingsWindow.webContents.send('reload-data');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });


  if (app.isPackaged) {
    isManualCheck = false;
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates().catch(() => {});
      } catch (e) { }
    }, 5000);
  }
});

let isManualCheck = false;
autoUpdater.autoDownload = false;

ipcMain.on('check-update-manual', () => {
  isManualCheck = true;
  try {
    autoUpdater.checkForUpdates().then(result => {
      if (result === null) {
        // App is not packed
        dialog.showMessageBox({
          type: 'info',
          title: '檢查更新 (開發模式)',
          message: '目前處於開發模式，已自動跳過更新檢查。若要測試更新功能，請先執行打包 (npm run dist)。',
          buttons: ['確定']
        });
        if (settingsWindow) settingsWindow.webContents.send('update-check-done');
      }
    }).catch(err => {
      dialog.showErrorBox('檢查更新失敗', err.toString());
      if (settingsWindow) settingsWindow.webContents.send('update-check-done');
    });
  } catch (e) {
    dialog.showErrorBox('檢查更新發生錯誤', e.toString());
    if (settingsWindow) settingsWindow.webContents.send('update-check-done');
  }
});

autoUpdater.on('update-available', (info) => {
  const version = info.version;
  let state = {};
  if (fs.existsSync(petStatePath)) {
    try { state = JSON.parse(fs.readFileSync(petStatePath, 'utf8')); } catch (e) { }
  }

  if (!isManualCheck) {
    if (state.skippedVersion === version) return;
    const today = new Date().toISOString().split('T')[0];
    if (state.snoozedVersion === version && state.snoozeDate === today) return;
  }

  dialog.showMessageBox({
    type: 'info',
    title: '檢查更新',
    message: `發佈了新版本 v${version}！`,
    detail: (info.releaseNotes || '修復了一些 Bug，並帶來了新功能！').toString().replace(/<[^>]*>?/gm, ''),
    buttons: ['更新', '下次提醒', '跳過這個版本'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
      if (mainWindow) mainWindow.webContents.send('show-update-progress', { text: '🚀 準備下載新版本更新...' });
    } else if (result.response === 1) {
      state.snoozedVersion = version;
      state.snoozeDate = new Date().toISOString().split('T')[0];
      fs.writeFileSync(petStatePath, JSON.stringify(state, null, 2), 'utf8');
    } else if (result.response === 2) {
      state.skippedVersion = version;
      fs.writeFileSync(petStatePath, JSON.stringify(state, null, 2), 'utf8');
    }
    if (settingsWindow) settingsWindow.webContents.send('update-check-done');
  });
});

autoUpdater.on('update-not-available', () => {
  if (isManualCheck) {
    dialog.showMessageBox({
      type: 'info',
      title: '檢查更新',
      message: '目前已是最新版本！',
      buttons: ['確定']
    });
    if (settingsWindow) settingsWindow.webContents.send('update-check-done');
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  const speedMB = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(1);
  if (mainWindow) {
    mainWindow.webContents.send('show-update-progress', {
      percent,
      speed: `${speedMB} MB/s`
    });
  }
});

autoUpdater.on('error', (err) => {
  if (mainWindow) {
    mainWindow.webContents.send('show-update-progress', {
      text: '❌ 更新下載失敗，請稍後再試。'
    });
  }
  if (isManualCheck) {
    dialog.showErrorBox('檢查更新失敗', err.toString());
    if (settingsWindow) settingsWindow.webContents.send('update-check-done');
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    mainWindow.webContents.send('show-update-progress', {
      text: '🎉 新版本下載完成！<br>即將自動安裝並重啟...'
    });
  }

  dialog.showMessageBox({
    type: 'info',
    title: '更新完成',
    message: '新版本下載完成！點擊「確定」將立刻關閉並安裝新版本。',
    buttons: ['確定並安裝']
  }).then(() => {
    autoUpdater.quitAndInstall(false, true);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
