const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove snoozedAlarms
content = content.replace("let snoozedAlarms = [];\n", "");

// 2. Remove duplicates
content = content.replace("  const chatContent = document.getElementById('chat-content');\n", "");
content = content.replace("  const chatClose = document.getElementById('chat-close');\n", "");
content = content.replace("  const namePrefix = '<span style=\"color: #c97a2e; font-weight: 900;\">Wiki Wiki：</span>';\n", "");

// 3. Update showAlarmBubble signature and text
content = content.replace("function showAlarmBubble(alarm) {", "function showAlarmBubble(alarm, onSnooze) {");
content = content.replace("貪睡 ${snoozeMins}分", "稍後提醒 ${snoozeMins}分");

// 4. Update snooze logic
const snoozeLogicOld = `    document.getElementById('btn-alarm-snooze').onclick = () => {
      isAlarmActive = false;
      chatBubble.style.display = 'none';
      const triggerTime = Date.now() + snoozeMins * 60000;
      snoozedAlarms.push({ ...alarm, triggerTime });
    };`;
const snoozeLogicNew = `    document.getElementById('btn-alarm-snooze').onclick = () => {
      isAlarmActive = false;
      chatBubble.style.display = 'none';
      if (onSnooze) onSnooze(alarm, snoozeMins);
    };`;
content = content.replace(snoozeLogicOld, snoozeLogicNew);

// 5. Remove physicsCtx and physics.initDragging
const physicsOld = `  const physicsCtx = {
    get kiwi() { return kiwi; },
    get kiwiAccessory() { return kiwiAccessory; },
    get chatInput() { return chatInput; },
    get chatEscHint() { return typeof chatEscHint !== 'undefined' ? chatEscHint : null; },
    get chatBubble() { return chatBubble; },
    getCurrentAction: () => currentAction,
    setCurrentAction: (val) => { currentAction = val; },
    setPos: (newX, newY) => { x = newX; y = newY; },
    getPetState: () => petState
  };
  
  physics.initDragging(physicsCtx);`;
content = content.replace(physicsOld, "");

fs.writeFileSync(file, content);
console.log('Fixed chat.js safely.');
