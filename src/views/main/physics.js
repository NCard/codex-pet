const { ipcRenderer } = require('electron');

let isDragging = false;
let hasDragged = false;
let mouseOffsetX, mouseOffsetY;
let dragStartX, dragStartY;
let lastDragX = 0;
let lastDragTime = 0;
let smoothedVx = 0;
let swingAngle = 0;
let swingAnimFrame = null;

function initDragging(ctx) {
  function updatePhysicsSwing() {
    const kiwiWrapper = document.getElementById('kiwi-wrapper');
    const flip = (kiwiWrapper && parseInt(kiwiWrapper.style.getPropertyValue('--flip')) === -1) ? -1 : 1;

    if (isDragging || ctx.getCurrentAction() === 'grabbed') {
      smoothedVx *= 0.88;
      const absVx = Math.abs(smoothedVx);
      const rawAngle = Math.sign(smoothedVx) * Math.pow(absVx, 0.85) * 0.22;
      const targetAngle = Math.max(-30, Math.min(30, rawAngle));
      swingAngle += (targetAngle - swingAngle) * 0.22;

      const renderAngle = (swingAngle * flip).toFixed(2);
      ctx.kiwi.style.transform = `rotate(${renderAngle}deg)`;
      swingAnimFrame = requestAnimationFrame(updatePhysicsSwing);
    } else {
      smoothedVx = 0;
      swingAngle += (0 - swingAngle) * 0.22;

      if (Math.abs(swingAngle) < 0.05) {
        swingAngle = 0;
        ctx.kiwi.style.transform = 'rotate(0deg)';
        swingAnimFrame = null;
        return;
      }
      const renderAngle = (swingAngle * flip).toFixed(2);
      ctx.kiwi.style.transform = `rotate(${renderAngle}deg)`;
      swingAnimFrame = requestAnimationFrame(updatePhysicsSwing);
    }
  }

  ctx.kiwi.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasDragged = false;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    lastDragX = e.screenX;
    lastDragTime = performance.now();
    smoothedVx = 0;
    swingAngle = 0;
    mouseOffsetX = e.clientX;
    mouseOffsetY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const moveDist = Math.hypot(e.screenX - dragStartX, e.screenY - dragStartY);

    if (moveDist > 8 && ctx.getCurrentAction() !== 'grabbed') {
      hasDragged = true;
      ctx.setCurrentAction('grabbed');
      const rect = ctx.kiwi.getBoundingClientRect();
      mouseOffsetX = rect.left + (rect.width / 2);
      mouseOffsetY = rect.top + 25;

      ctx.kiwi.classList.remove('walking');
      const img = document.getElementById('kiwi-img');
      if (img) img.classList.remove('kiwi-tired');
      if (ctx.kiwiAccessory && ctx.kiwiAccessory.innerText === '💤') {
        ctx.kiwiAccessory.style.display = 'none';
      }

      ctx.kiwi.style.transformOrigin = '50% 15%';
      ctx.kiwi.classList.add('shock');
      if (img && ctx.getCurrentAction() !== 'sleeping') {
        img.src = '../../../assets/images/kiwi_dangling.png';
      }
      if (!swingAnimFrame) {
        swingAnimFrame = requestAnimationFrame(updatePhysicsSwing);
      }
    }

    if (hasDragged || ctx.getCurrentAction() === 'grabbed') {
      const x = e.screenX - mouseOffsetX;
      const y = e.screenY - mouseOffsetY;
      ctx.setPos(x, y);
      ipcRenderer.send('window-move', x, y);

      const now = performance.now();
      const dt = Math.max(0.008, (now - lastDragTime) / 1000);
      const rawVx = (e.screenX - lastDragX) / dt;
      lastDragX = e.screenX;
      lastDragTime = now;
      smoothedVx += (rawVx - smoothedVx) * 0.45;
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;

    if (ctx.getCurrentAction() === 'grabbed') {
      ctx.setCurrentAction('idle');
      ctx.kiwi.classList.remove('shock');
      if (!swingAnimFrame) {
        swingAnimFrame = requestAnimationFrame(updatePhysicsSwing);
      }
      const img = document.getElementById('kiwi-img');
      if (img && ctx.getCurrentAction() !== 'sleeping') {
        if (ctx.getPetState().hunger <= 20) {
          img.src = '../../../assets/images/kiwi_tired.png';
        } else {
          img.src = '../../../assets/images/kiwi.png';
        }
      }
    }
  });

  ctx.kiwi.addEventListener('click', (e) => {
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    ctx.kiwi.classList.add('jumping');
    setTimeout(() => { ctx.kiwi.classList.remove('jumping'); }, 500);

    ctx.chatInput.style.display = 'block';
    if (ctx.chatEscHint) ctx.chatEscHint.style.display = 'block';
    ctx.chatBubble.style.display = 'none';
    ctx.chatInput.focus();
  });
}

module.exports = { initDragging };
