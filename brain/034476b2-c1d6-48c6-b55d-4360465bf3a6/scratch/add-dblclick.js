const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/interaction.js');
let content = fs.readFileSync(file, 'utf8');
content += "\nkiwi.addEventListener('dblclick', () => { require('electron').ipcRenderer.emit('summon-kiwi'); });\n";
fs.writeFileSync(file, content);
console.log('Added dblclick listener');
