const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove snoozedAlarms
content = content.replace(/let snoozedAlarms = \[\];\r?\n/, "");

// 2. Remove duplicates
content = content.replace(/  const chatContent = document\.getElementById\('chat-content'\);\r?\n/, "");
content = content.replace(/  const chatClose = document\.getElementById\('chat-close'\);\r?\n/, "");
content = content.replace(/  const namePrefix = '<span style="color: #c97a2e; font-weight: 900;">Wiki Wiki：<\/span>';\r?\n/, "");

fs.writeFileSync(file, content);
console.log('Fixed chat.js safely.');
