function init({
  kiwi, customMenu, ipcRenderer, petState, savePetState, 
  getCurrentAction, setCurrentAction, showTempBubble, kiwiAccessory, getIsWorking,
  setOutfitEditMode, setIgnoreWakeup,
  elements: {
    menuTodo, menuFeed, menuPet, menuOutfit, menuSettings,
    menuSleep, menuHistory, menuAlarm, menuClose, menuLaser,
    outfitContainer
  },
  laser
}) {
  // 右鍵點擊奇異鳥，顯示自訂右鍵選單
  kiwi.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    
    // 先顯示選單，才能取得實際寬高
    customMenu.style.display = 'flex';
    
    let menuWidth = customMenu.offsetWidth;
    let menuHeight = customMenu.offsetHeight;
    
    let left = e.clientX + 10;
    let top = e.clientY - 10;
    
    // 防止選單超出 250x250 的視窗邊界而被切掉
    if (left + menuWidth > 250) {
      left = e.clientX - menuWidth - 10;
    }
    if (top + menuHeight > 250) {
      top = e.clientY - menuHeight - 10;
    }
    
    // 終極防線：確保絕對不會掉出左邊和上面的邊界 (小於 0)
    if (left < 5) left = 5;
    if (top < 5) top = 5;
    
    customMenu.style.left = left + 'px';
    customMenu.style.top = top + 'px';
  });

  // 點擊其他地方關閉選單
  window.addEventListener('click', (e) => {
    if (e.target.className !== 'menu-item') {
      customMenu.style.display = 'none';
    }
  });

  // 綁定選單功能
  menuTodo.addEventListener('click', () => {
    customMenu.style.display = 'none';
    ipcRenderer.send('open-todo');
  });

  menuFeed.addEventListener('click', () => {
    const currentAction = getCurrentAction();
    if (currentAction !== 'idle' && currentAction !== 'moving') return; // 只有閒置或走動時可以餵食
    
    customMenu.style.display = 'none';
    petState.hunger = Math.min(100, petState.hunger + 30);
    savePetState();
    
    setCurrentAction('eating'); // 進入吃飯狀態
    
    const character = document.getElementById('kiwi-character');
    const food = document.getElementById('kiwi-food');
    
    character.classList.add('kiwi-pecking');
    food.style.display = 'block';
    
    setTimeout(() => {
      character.classList.remove('kiwi-pecking');
      food.style.display = 'none';
      showTempBubble('好飽好飽！嗝～🥝');
      kiwi.classList.add('jumping');
      setTimeout(() => { 
        kiwi.classList.remove('jumping'); 
        if (getCurrentAction() === 'eating') setCurrentAction('idle'); // 恢復閒置
      }, 500);
    }, 2000);
  });

  menuPet.addEventListener('click', () => {
    customMenu.style.display = 'none';
    
    // Instead of instantly petting, we start the petting mode
    if (interaction && interaction.startPettingMode) {
      interaction.startPettingMode();
      showTempBubble('好喔！來摸摸吧～(๑>◡<๑)');
    } else {
      petState.mood = Math.min(100, petState.mood + 20);
      savePetState();
      showTempBubble('咕啾～好舒服～(⁎˃ᴗ˂⁎) 心情變好了！');
      kiwiAccessory.innerText = '❤️';
      kiwiAccessory.style.display = 'block';
      setTimeout(() => { if(!getIsWorking()) kiwiAccessory.style.display = 'none'; }, 2000);
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
    }
  });

  menuOutfit.addEventListener('click', () => {
    customMenu.style.display = 'none';
    ipcRenderer.send('open-outfit');
    setOutfitEditMode(true);
    if (outfitContainer) {
      Array.from(outfitContainer.children).forEach(child => {
        child.style.pointerEvents = 'auto';
        child.style.cursor = 'grab';
      });
    }
    kiwi.style.animation = 'none'; // 換裝模式暫停呼吸動畫，避免座標跳動
  });

  menuSettings.addEventListener('click', () => {
    customMenu.style.display = 'none';
    ipcRenderer.send('open-settings');
  });

  menuSleep.addEventListener('click', () => {
    customMenu.style.display = 'none';
    setCurrentAction('sleeping');
    kiwi.classList.add('sleeping');
    const zzz = document.getElementById('kiwi-zzz');
    if (zzz) zzz.style.display = 'block';
    document.getElementById('kiwi-img').src = '../../../assets/images/kiwi_sleep.png';
    document.getElementById('kiwi-bed').style.display = 'block';
    if (outfitContainer) outfitContainer.style.display = 'none';
    
    showTempBubble('晚安... Zzz...');

    // 延遲解除忽略喚醒，避免點擊選單後滑鼠微動立刻喚醒
    setIgnoreWakeup(true);
    setTimeout(() => { setIgnoreWakeup(false); }, 1000);
  });

  menuHistory.addEventListener('click', () => {
    customMenu.style.display = 'none';
    ipcRenderer.send('open-history');
  });

  menuAlarm.addEventListener('click', () => {
    customMenu.style.display = 'none';
    ipcRenderer.send('open-alarm');
  });

  menuClose.addEventListener('click', () => {
    customMenu.style.display = 'none';
    ipcRenderer.send('request-close-confirm');
  });

  if (menuLaser) {
    menuLaser.addEventListener('click', () => {
      customMenu.style.display = 'none';
      laser.toggleLaserGame();
    });
  }
}

module.exports = { init };
