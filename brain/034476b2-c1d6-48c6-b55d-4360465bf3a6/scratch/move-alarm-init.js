const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/renderer.js');
let content = fs.readFileSync(file, 'utf8');

// Remove it from current location
content = content.replace(/const alarmModule = require\('\.\/modules\/alarm'\);\s*alarmModule\.init\(\{ alarmsPath, laser, resetIdle, showAlarmBubble, kiwi, ipcRenderer \}\);/m, "");

// Add it to the end of the file
content += `\n
const alarmModule = require('./modules/alarm');
alarmModule.init({ alarmsPath, laser, resetIdle, showAlarmBubble, kiwi, ipcRenderer });
`;

fs.writeFileSync(file, content);
console.log('Moved alarmModule.init to bottom');
