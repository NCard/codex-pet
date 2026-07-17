const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

// 啟用熱重載 (Hot Reload)
try {
  require('electron-reloader')(module);
} catch (_) {}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 250,
    height: 250,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

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
    const historyWin = new BrowserWindow({
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
    historyWin.loadFile(path.join(__dirname, 'history.html'));
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
