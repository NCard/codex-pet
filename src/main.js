const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

try {
  require('electron-reloader')(module, {
    ignore: [
      /chat_history\.json/,
      /pet_state\.json/,
      /task\.md/,
      /implementation_plan\.md/,
      /walkthrough\.md/,
      /\.system_generated/,
      /alarms\.json/,
      /pet_state\.json/
    ]
  });
} catch (_) {}

let mainWindow = null;
let outfitWin = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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

  ipcMain.on('open-alarm', () => {
    const alarmWin = new BrowserWindow({
      width: 500,
      height: 650,
      title: 'Wiki Wiki 提醒設定',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    alarmWin.setMenu(null);
    alarmWin.loadFile(path.join(__dirname, 'alarm.html'));
  });

  ipcMain.on('open-todo', () => {
    const todoWin = new BrowserWindow({
      width: 500,
      height: 650,
      title: 'Wiki Wiki 待辦事項',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    todoWin.setMenu(null);
    todoWin.loadFile(path.join(__dirname, 'todo.html'));
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
    outfitWin.loadFile(path.join(__dirname, 'outfit.html'));
    
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

  ipcMain.on('alarms-changed', () => {
    if (alarmWin) alarmWin.webContents.send('reload-data');
  });

  ipcMain.on('pet-state-changed', () => {
    if (todoWin) todoWin.webContents.send('reload-data');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
