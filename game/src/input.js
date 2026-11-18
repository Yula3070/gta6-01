// Keyboard and mouse input: WASD + arrows to move/drive, mouse to look
// (pointer lock on the canvas), plus the action keys the game uses.
export const KEY = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  interact: ['KeyE'],
  punch: ['KeyF'],
  reload: ['KeyR'],
  horn: ['KeyH'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;
  let sensitivity = 1;

  function onKeyDown(e) {
    if (e.repeat) return;
    down.add(e.code);
    pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  }
  function onKeyUp(e) {
    down.delete(e.code);
  }
  function onMouseMove(e) {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    setSensitivity(v) {
      sensitivity = v;
    },
    lockPointer() {
      if (document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock();
        } catch {
          // Pointer lock can be refused (headless, iframes): mouse look then
          // degrades gracefully to keyboard-only turning.
        }
      }
    },
    unlockPointer() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
    get pointerLocked() {
      return locked;
    },
    axis(keys) {
      let v = 0;
      for (const k of keys) if (down.has(k)) v += 1;
      return v;
    },
    moveX() {
      return this.axis(KEY.right) - this.axis(KEY.left);
    },
    moveY() {
      return this.axis(KEY.forward) - this.axis(KEY.back);
    },
    isDown(code) {
      return down.has(code);
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    wasPressedAny(codes) {
      return codes.some((c) => pressed.has(c));
    },
    takeMouse() {
      const dx = mouseDX * sensitivity;
      const dy = mouseDY * sensitivity;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    get mouseHeld() {
      return mouseDown;
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    endFrame() {
      pressed.clear();
    },
  };
}
