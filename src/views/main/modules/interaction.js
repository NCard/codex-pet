let petScore = 0;
let lastPetTime = 0;
let pettingTimeout = null;
let isPetting = false;

function init({ kiwi, getCurrentAction, setCurrentAction, physics, getIsDraggingOutfit, getIsDraggingBed }) {
  kiwi.addEventListener('mousemove', (e) => {
    const currentAction = getCurrentAction();
    if (currentAction === 'sleeping' || physics.getIsDragging() || getIsDraggingOutfit() || getIsDraggingBed()) return;
    
    const now = Date.now();
    if (now - lastPetTime > 500) {
      petScore = 0;
    }
    // 累加滑鼠移動距離
    petScore += Math.abs(e.movementX) + Math.abs(e.movementY);
    lastPetTime = now;
    
    // 累積移動超過 2000 像素才算作撫摸
    if (petScore > 2000 && !isPetting) {
      isPetting = true;
      const oldAction = currentAction;
      setCurrentAction('petting');
      kiwi.classList.remove('kiwi-pecking');
      kiwi.classList.add('kiwi-petting');
      
      const heart = document.getElementById('kiwi-heart');
      heart.style.display = 'block';
      heart.style.animation = 'none';
      heart.offsetHeight; // trigger reflow
      heart.style.animation = 'floatHeart 1s ease-out forwards';
      
      if (pettingTimeout) clearTimeout(pettingTimeout);
      pettingTimeout = setTimeout(() => {
        isPetting = false;
        petScore = 0;
        kiwi.classList.remove('kiwi-petting');
        heart.style.display = 'none';
        if (getCurrentAction() === 'petting') setCurrentAction(oldAction === 'eating' ? 'idle' : oldAction); 
      }, 1500);
    }
  });
}

module.exports = { init };
