const fs = require('fs');
const path = require('path');
const chatPath = path.resolve('src/views/main/modules/chat.js');
let chatContent = fs.readFileSync(chatPath, 'utf8');

chatContent = chatContent.replace(
  "ipcRenderer.on('summon-kiwi', () => {",
  "ipcRenderer.on('summon-kiwi', () => {\n    require('fs').writeFileSync('summon-triggered.txt', 'triggered');\n    try {"
);
chatContent = chatContent.replace(
  "    showTempBubble(`✨ ${phrase}`, 3000);\n  });",
  "    showTempBubble(`✨ ${phrase}`, 3000);\n    } catch(e) { require('fs').writeFileSync('summon-error.txt', e.stack); }\n  });"
);

fs.writeFileSync(chatPath, chatContent, 'utf8');
console.log('Injected debug into chat.js');
