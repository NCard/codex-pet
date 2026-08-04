const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

const eventListeners = `
  chatClose.addEventListener('click', () => {
    chatBubble.style.display = 'none';
    chatInput.style.display = 'none';
    if (typeof chatEscHint !== 'undefined' && chatEscHint) chatEscHint.style.display = 'none';
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (customMenu.style.display !== 'none') {
        customMenu.style.display = 'none';
      } else if (chatBubble.style.display === 'block' || chatInput.style.display === 'block') {
        chatBubble.style.display = 'none';
        chatInput.style.display = 'none';
        if (typeof chatEscHint !== 'undefined' && chatEscHint) chatEscHint.style.display = 'none';
      }
    }
  });
`;

content = content.replace("function showTempBubble(text, duration = 5000) {", eventListeners + "\n  function showTempBubble(text, duration = 5000) {");

fs.writeFileSync(file, content);
