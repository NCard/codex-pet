const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

// The original line:
// <button id="btn-alarm-snooze" style="flex:1; padding: 4px; border: none; background: #ff9800; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">稍後提醒 ${snoozeMins}分</button>

content = content.replace(
  'font-size: 12px; font-weight: bold;">我知道了',
  'font-size: 12px; font-weight: bold; white-space: nowrap;">我知道了'
);

content = content.replace(
  'font-size: 12px; font-weight: bold;">稍後提醒',
  'font-size: 12px; font-weight: bold; white-space: nowrap;">稍後提醒'
);

fs.writeFileSync(file, content);
console.log('Fixed chat.js button styles safely.');
