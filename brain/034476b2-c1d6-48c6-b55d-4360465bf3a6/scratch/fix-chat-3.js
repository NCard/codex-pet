const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

// 3. Update showAlarmBubble signature and text
content = content.replace(/function showAlarmBubble\(alarm\) \{/, "function showAlarmBubble(alarm, onSnooze) {");
content = content.replace(/貪睡 \$\{snoozeMins\}分/g, "稍後提醒 ${snoozeMins}分");

// 4. Update snooze logic
const snoozeLogicOld = /document\.getElementById\('btn-alarm-snooze'\)\.onclick = \(\) => \{[\s\S]*?snoozedAlarms\.push\(\{ \.\.\.alarm, triggerTime \}\);\s*\};/m;
const snoozeLogicNew = `document.getElementById('btn-alarm-snooze').onclick = () => {
      isAlarmActive = false;
      chatBubble.style.display = 'none';
      if (onSnooze) onSnooze(alarm, snoozeMins);
    };`;
content = content.replace(snoozeLogicOld, snoozeLogicNew);

// 5. Remove physicsCtx and physics.initDragging
const physicsOld = /const physicsCtx = \{[\s\S]*?physics\.initDragging\(physicsCtx\);/m;
content = content.replace(physicsOld, "");

fs.writeFileSync(file, content);
console.log('Fixed chat.js safely part 3.');
