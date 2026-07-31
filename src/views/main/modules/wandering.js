let deps = {};
let wanderingTimer = null;

function init(dependencies) {
  deps = dependencies;
  startWanderingLoop();
}

function startWanderingLoop() {
  if (wanderingTimer) clearInterval(wanderingTimer);

  wanderingTimer = setInterval(() => {
    const { laser, getCurrentAction, setCurrentAction, kiwi, getIsWorking, chatBubble, chatInput, getRealWindowPos, getResolutionScale, ipcRenderer, setWindowPos } = deps;

    if (laser.getIsLaserGameActive() || getCurrentAction() !== 'idle' || kiwi.classList.contains('sleeping') || getIsWorking()) return;
    if (chatBubble.style.display === 'block' || chatInput.style.display === 'block') return;

    if (Math.random() < 0.4) {
      setCurrentAction('moving');
      const currentPos = getRealWindowPos();
      let x = currentPos.x;
      let y = currentPos.y;
      
      const scale = getResolutionScale();
      let rangeX = 300 * scale;
      let rangeY = 100 * scale;
      if (Math.random() < 0.05) {
        rangeX = 1500 * scale;
        rangeY = 500 * scale;
      }
      
      const moveX = (Math.random() - 0.5) * rangeX;
      const moveY = (Math.random() - 0.5) * rangeY;
      
      let targetX = x + moveX;
      let targetY = y + moveY;
      
      const screenAvailTop = window.screen.availTop || 0;
      const screenAvailLeft = window.screen.availLeft || 0;
      
      const minX = screenAvailLeft - 20;
      const minY = screenAvailTop - 330;
      const maxX = screenAvailLeft + window.screen.availWidth - 230;
      const maxY = screenAvailTop + window.screen.availHeight - 520;
      
      targetX = Math.max(minX, Math.min(targetX, maxX));
      targetY = Math.max(minY, Math.min(targetY, maxY));

      const direction = (targetX < x) ? -1 : 1;
      document.getElementById('kiwi-wrapper').style.setProperty('--flip', direction);

      kiwi.classList.add('walking');

      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const stepSpeed = 2.5 * scale;
      const steps = Math.max(10, Math.round(distance / stepSpeed));
      
      let currentStep = 0;
      const stepX = dx / steps;
      const stepY = dy / steps;

      const moveInterval = setInterval(() => {
        if (getCurrentAction() !== 'moving') {
          clearInterval(moveInterval);
          kiwi.classList.remove('walking');
          return;
        }

        x += stepX;
        y += stepY;
        ipcRenderer.send('window-move', Math.round(x), Math.round(y));
        setWindowPos(x, y);
        currentStep++;

        if (currentStep >= steps) {
          clearInterval(moveInterval);
          x = targetX;
          y = targetY;
          setWindowPos(x, y);
          kiwi.classList.remove('walking');
          if (getCurrentAction() === 'moving') setCurrentAction('idle');
        }
      }, 16);
    }
  }, 3000);
}

module.exports = {
  init
};
