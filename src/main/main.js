require('../utils/logger');
process.on('uncaughtException', (error) => {
  console.error('[Main UncaughtException]:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main UnhandledRejection]:', reason);
});
const { app, BrowserWindow, ipcMain, Tray, Menu, screen, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { petStatePath } = require('../utils/paths');
const { autoUpdater } = require('electron-updater');

if (!app.isPackaged) {
  try {
    const reloader = require('electron-reloader');
    reloader(module, {
      ignore: [
        /data/,
        /task\.md/,
        /implementation_plan\.md/,
        /walkthrough\.md/,
        /\.system_generated/,
        /logs/,
        /app\.log/
      ]
    });
  } catch (_) {}
}

let mainWindow = null;
let outfitWin = null;
let alarmWin = null;
let todoWin = null;
let historyWin = null;
let settingsWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const winWidth = 250;
  const winHeight = 550;
  
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
  } catch (e) {}

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
    } catch(err) {
      console.error('Failed to register shortcut', err);
    }
  }
}

app.whenReady().then(() => {
  registerGlobalShortcut();
  createWindow();

  let contextMenuWin = null;

  ipcMain.on('show-context-menu', (event, screenX, screenY) => {
    // 若已有選單視窗，先關閉
    if (contextMenuWin && !contextMenuWin.isDestroyed()) {
      contextMenuWin.close();
      contextMenuWin = null;
    }

    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

    // 先以較大的預估尺寸開窗，等選單測量完後 menu-resize 再縮小
    const estimatedW = 200;
    const estimatedH = 360;

    // 決定選單位置（靠左還是靠右、靠上還是靠下）
    let x = screenX + 5;
    let y = screenY - 10;
    if (x + estimatedW > sw) x = screenX - estimatedW - 5;
    if (y + estimatedH > sh) y = sh - estimatedH - 10;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    contextMenuWin = new BrowserWindow({
      x, y,
      width: estimatedW,
      height: estimatedH,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
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

    contextMenuWin.on('closed', () => {
      contextMenuWin = null;
    });
  });

  // 選單測量自己的尺寸後回報，讓視窗精確縮放
  ipcMain.on('menu-resize', (event, w, h) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    
    const newW = Math.ceil(w);
    const newH = Math.ceil(h);
    const [curX, curY] = win.getPosition();
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    
    let x = curX;
    let y = curY;
    // 若視窗展開後會超出螢幕，往反方向調整
    if (x + newW > sw) x = sw - newW - 5;
    if (y + newH > sh) y = sh - newH - 5;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    
    win.setPosition(x, y);
    win.setSize(newW, newH);
  });

  // 選單項目被點擊
  ipcMain.on('menu-item-clicked', (event, action) => {
    if (action === 'quit') {
      app.quit();
      return;
    }
    if (action !== 'cancel') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('menu-action', action);
      }
    }
    // 關閉選單視窗
    if (contextMenuWin && !contextMenuWin.isDestroyed()) {
      contextMenuWin.close();
      contextMenuWin = null;
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    // hide menu bar
    historyWin.setMenu(null);
    historyWin.loadFile(path.join(__dirname, '../views/history/history.html'));
    historyWin.on('closed', () => historyWin = null);
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    alarmWin.setMenu(null);
    alarmWin.loadFile(path.join(__dirname, '../views/alarm/alarm.html'));
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    todoWin.setMenu(null);
    todoWin.loadFile(path.join(__dirname, '../views/todo/todo.html'));
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    outfitWin.setMenu(null);
    outfitWin.loadFile(path.join(__dirname, '../views/outfit/outfit.html'));
    
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
    event.returnValue = screen.getCursorScreenPoint();
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
      } catch(e) {}
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
      width: 350,
      height: 500,
      title: 'Wiki Wiki 設定中心',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    settingsWindow.loadFile(path.join(__dirname, '../views/settings/settings.html'));
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

  ipcMain.on('pet-state-changed', () => {
    if (todoWin) todoWin.webContents.send('reload-data');
    if (mainWindow) mainWindow.webContents.send('reload-data');
    if (settingsWindow) settingsWindow.webContents.send('reload-data');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  

  isManualCheck = false;
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates();
    } catch (e) {}
  }, 5000);
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
  } catch(e) {
    dialog.showErrorBox('檢查更新發生錯誤', e.toString());
    if (settingsWindow) settingsWindow.webContents.send('update-check-done');
  }
});

autoUpdater.on('update-available', (info) => {
  const version = info.version;
  let state = {};
  if (fs.existsSync(petStatePath)) {
    try { state = JSON.parse(fs.readFileSync(petStatePath, 'utf8')); } catch(e){}
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
