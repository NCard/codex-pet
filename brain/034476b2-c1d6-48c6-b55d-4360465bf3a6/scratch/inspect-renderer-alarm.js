const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/renderer.js');
let content = fs.readFileSync(file, 'utf8');

// The block to remove starts around `let triggeredAlarms = {};` and ends at the end of the `setInterval` block for alarms
const oldAlarmRegex = /let triggeredAlarms = \{\};[\s\S]*?console\.error\('Failed to parse alarms:', e\);\s*\}\s*\}\s*\}, 5000\);/m;
content = content.replace(oldAlarmRegex, "");

// We also need to remove the `for (let i = snoozedAlarms.length - 1; ...` inside the setInterval if it was separate, but wait, it was inside the same `setInterval` which started right before it.
// Wait, let's look at `renderer.js` to see what exact string I need to replace.
