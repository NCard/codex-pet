const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

const targetStr = `
    // 全域監聽 ESC 鍵關閉對話
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (chatInput.style.display !== 'none' || chatBubble.style.display !== 'none') {
          chatInput.style.display = 'none';
          if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'none';
          chatBubble.style.display = 'none';
          chatInput.value = '';
        }
      }
    });
`;

content = content.replace(targetStr, '');

fs.writeFileSync(file, content);
console.log('Removed duplicate Escape listener');
