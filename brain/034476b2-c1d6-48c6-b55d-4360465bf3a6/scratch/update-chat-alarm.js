const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove snoozedAlarms declaration
content = content.replace("let snoozedAlarms = [];\n", "");

// 2. Add onSnooze parameter to showAlarmBubble
content = content.replace("function showAlarmBubble(alarm) {", "function showAlarmBubble(alarm, onSnooze) {");

// 3. Change "貪睡" to "稍後提醒" in HTML
content = content.replace("貪睡 ${snoozeMins}", "稍後提醒 ${snoozeMins}");

// 4. Change the snooze button logic
const oldSnoozeLogic = /document\.getElementById\('btn-alarm-snooze'\)\.onclick = \(\) => \{[\s\S]*?snoozedAlarms\.push\(\{ \.\.\.alarm, triggerTime \}\);\s*\};/m;
const newSnoozeLogic = `document.getElementById('btn-alarm-snooze').onclick = () => {
        isAlarmActive = false;
        chatBubble.style.display = 'none';
        if (onSnooze) onSnooze(alarm, snoozeMins);
      };`;
content = content.replace(oldSnoozeLogic, newSnoozeLogic);

fs.writeFileSync(file, content);
console.log('Successfully updated chat.js for alarm integration and text change');
