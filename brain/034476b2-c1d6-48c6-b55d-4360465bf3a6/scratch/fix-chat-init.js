const fs = require('fs');
const path = require('path');
const file = path.resolve('src/views/main/modules/chat.js');
let content = fs.readFileSync(file, 'utf8');

const regex = /function init\(\{[\s\S]*?\}\) \{[\s\S]*?function showTempBubble/m;

const replacement = `function init({
  chatBubble, chatContent, chatClose, chatInput, chatEscHint, customMenu,
  kiwi, kiwiAccessory, namePrefix,
  petState, savePetState, loadPetState, applyOutfitPos,
  getIsWorking, setIsWorking,
  laser, ai, mcpClient, geminiTools, crypto,
  saveChatHistory, clearChatHistory, resetIdle, ipcRenderer
}) {

  // 點擊關閉按鈕隱藏泡泡
  chatClose.addEventListener('click', () => {
    chatBubble.style.display = 'none';
    chatInput.style.display = 'none';
    if(typeof chatEscHint !== 'undefined' && chatEscHint) chatEscHint.style.display = 'none';
  });
  
  // 按下 ESC 也可以隱藏各種浮動面板 (全域監聽)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (customMenu.style.display !== 'none') {
        customMenu.style.display = 'none';
      } else if (chatBubble.style.display === 'block' || chatInput.style.display === 'block') {
        chatBubble.style.display = 'none';
        chatInput.style.display = 'none';
        if(typeof chatEscHint !== 'undefined' && chatEscHint) chatEscHint.style.display = 'none';
      }
    }
  });

  function showTempBubble`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
console.log('Fixed init syntax');
