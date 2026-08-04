const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

content = content.replace("  const chatContent = document.getElementById('chat-content');\n", "");
content = content.replace("  const chatClose = document.getElementById('chat-close');\n", "");
content = content.replace("  const namePrefix = '<span style=\"color: #c97a2e; font-weight: 900;\">Wiki Wiki：</span>';\n", "");
content = content.replace("  physics.initDragging(physicsCtx);\n", "");

fs.writeFileSync(file, content);
console.log('Cleaned up duplicate declarations');
