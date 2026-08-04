const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

const regex = /\s*const physicsCtx = \{[\s\S]*?getPetState: \(\) => petState\s*\};\s*physics\.initDragging\(physicsCtx\);\s*/;
content = content.replace(regex, '\n\n');

fs.writeFileSync(file, content);
console.log('Removed physicsCtx');
