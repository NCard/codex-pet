const fs = require('fs');

const chatPath = 'src/views/main/modules/chat.js';
let lines = fs.readFileSync(chatPath, 'utf8').split('\n');

lines = lines.map(line => {
  if (line.includes("const chatContent = document.getElementById('chat-content');")) return '';
  if (line.includes("const chatClose = document.getElementById('chat-close');")) return '';
  if (line.includes("const namePrefix = '<span style=\"color: #c97a2e; font-weight: 900;\">Wiki Wiki：</span>';")) return '';
  return line;
});

fs.writeFileSync(chatPath, lines.join('\n'), 'utf8');
console.log('Fixed chat.js syntax errors.');
