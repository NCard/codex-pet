const { getDialogue } = require('../../../utils/dialogues');

let petScore = 0;
let lastPetTime = 0;
let pettingTimeout = null;
let isPetting = false;

// 狀態控制：只有透過選單觸發後，才會進入等待被摸的狀態
let isWaitingForPet = false;
let petCount = 0;

function startPettingMode() {
  isWaitingForPet = true;
  petCount = 0;
  petScore = 0;
}

function init({ kiwi, getCurrentAction, setCurrentAction, physics, getIsDraggingOutfit, getIsDraggingBed, petState, savePetState, showTempBubble }) {
  kiwi.addEventListener('mousemove', (e) => {
    // 只有在等待被摸的狀態下才會觸發摸摸運算
    if (!isWaitingForPet) return;

    const currentAction = getCurrentAction();
    if (currentAction === 'sleeping' || physics.getIsDragging() || getIsDraggingOutfit() || getIsDraggingBed()) return;
    
    const now = Date.now();
    if (now - lastPetTime > 500) {
      petScore = 0;
    }
    // 累加滑鼠移動距離
    petScore += Math.abs(e.movementX) + Math.abs(e.movementY);
    lastPetTime = now;
    
    // 放寬標準：累積移動超過 300 像素就算作一次撫摸
    if (petScore > 300 && !isPetting) {
      isPetting = true;
      petCount++;
      const oldAction = currentAction;
      setCurrentAction('petting');
      kiwi.classList.remove('kiwi-pecking');
      kiwi.classList.add('kiwi-petting');
      
      const heart = document.getElementById('kiwi-heart');
      heart.style.display = 'block';
      heart.style.animation = 'none';
      heart.offsetHeight; // trigger reflow
      heart.style.animation = 'floatHeart 1s ease-out forwards';
      
      // 每次摸摸都跳一下
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
      
      if (pettingTimeout) clearTimeout(pettingTimeout);
      pettingTimeout = setTimeout(() => {
        isPetting = false;
        petScore = 0;
        kiwi.classList.remove('kiwi-petting');
        heart.style.display = 'none';
        if (getCurrentAction() === 'petting') setCurrentAction(oldAction === 'eating' ? 'idle' : oldAction); 
        
        // 摸摸觸發 3 次後跳出對話並結束摸摸
        if (petCount >= 3) {
          isWaitingForPet = false;
          petCount = 0;
          
          // 增加心情
          petState.mood = Math.min(100, petState.mood + 20);
          if (savePetState) savePetState();
          
          // 隨機抽選對話
          const text = getDialogue('interactions', 'petComfort');
          if (showTempBubble) showTempBubble(text);
        }
      }, 800); // 縮短每次摸摸的冷卻時間
    }
  });
}

module.exports = { init, startPettingMode };
