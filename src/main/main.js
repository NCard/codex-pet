require('../utils/logger');
const { app, BrowserWindow, ipcMain, Tray, Menu, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { petStatePath } = require('../utils/paths');
const { autoUpdater } = require('electron-updater');

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
    win.setIgnoreMouseEvents(ignore, options || {});
  }
});

// 處理視窗拖曳 (允許超出螢幕)
ipcMain.on('window-move', (event, x, y) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const targetX = Math.round(Number(x));
    const targetY = Math.round(Number(y));
    if (Number.isFinite(targetX) && Number.isFinite(targetY) && Math.abs(targetX) < 100000 && Math.abs(targetY) < 100000) {
      win.setPosition(targetX, targetY);
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

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('show-context-menu', (event) => {
    const template = [
      {
        label: '睡覺 (Sleep)',
        click: () => { event.sender.send('force-sleep'); }
      },
      { type: 'separator' },
      {
        label: '關閉奇異鳥 (Exit)',
        click: () => { app.quit(); }
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });

  ipcMain.on('open-history', () => {
    if (historyWin) {
      historyWin.focus();
      return;
    }
    historyWin = new BrowserWindow({
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
  });

  ipcMain.on('open-outfit', () => {
    if (outfitWin) {
      outfitWin.focus();
      return;
    }
    outfitWin = new BrowserWindow({
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
    if (mainWindow) mainWindow.webContents.send('update-settings', settingsData);
  });
  
  ipcMain.on('settings-dragged', (event, settingsData) => {
    if (settingsWindow) settingsWindow.webContents.send('update-settings-ui', settingsData);
  });

  ipcMain.on('alarms-changed', () => {
    if (alarmWin) alarmWin.webContents.send('reload-data');
  });

  ipcMain.on('pet-state-changed', () => {
    if (todoWin) todoWin.webContents.send('reload-data');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  try {
    chokidar.watch(path.join(__dirname, '../views'), { ignored: /[\/\\]\./ }).on('all', () => {
      app.relaunch();
      app.exit();
    });
  } catch (err) {
    console.error('Failed to init chokidar:', err);
  }
  
  isManualCheck = false;
  try {
    autoUpdater.checkForUpdates();
  } catch (e) {}
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
