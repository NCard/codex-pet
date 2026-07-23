const os = require('os');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(os.homedir(), '.ai-pet-data');
const logDir = path.join(dataDir, 'logs');

// 確保目錄存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

module.exports = {
  dataDir,
  logDir,
  petStatePath: path.join(dataDir, 'pet_state.json'),
  alarmsPath: path.join(dataDir, 'alarms.json'),
  historyPath: path.join(dataDir, 'chat_history.dat')
};
