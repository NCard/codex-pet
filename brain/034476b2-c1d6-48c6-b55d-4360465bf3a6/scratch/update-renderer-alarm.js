const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/renderer.js');
let content = fs.readFileSync(file, 'utf8');

const regex = /let triggeredAlarms = \{\};[\s\S]*?console\.error\('Failed to parse alarms:', e\);\s*\}\s*\}\s*\}, 5000\);/m;

const replacement = `const alarmModule = require('./modules/alarm');
alarmModule.init({ alarmsPath, laser, resetIdle, showAlarmBubble, kiwi, ipcRenderer });`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
console.log('Removed old alarm logic and injected alarm.js');
