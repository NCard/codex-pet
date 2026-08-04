const fs = require('fs');
let content = fs.readFileSync('src/views/main/renderer.js', 'utf8');

content = content.replace(
  "getIsDraggingBed: () => typeof isDraggingBed !== 'undefined' ? isDraggingBed : false",
  "getIsDraggingBed: () => typeof isDraggingBed !== 'undefined' ? isDraggingBed : false,\n  petState,\n  savePetState,\n  showTempBubble"
);

content = content.replace(
  "laser\n});",
  "laser,\n  interaction\n});"
);

fs.writeFileSync('src/views/main/renderer.js', content, 'utf8');
console.log('Done');
