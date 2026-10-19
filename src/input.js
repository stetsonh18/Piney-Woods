export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set(); this.pressedKeys = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.lmb = false; this.rmb = false; this.lmbPressed = false;
    this.locked = false; this.onLockChange = null;
    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ShiftLeft'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.lmb = this.rmb = false; });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.lmb = true; this.lmbPressed = true; }
      if (e.button === 2) this.rmb = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2) this.rmb = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { this.wheel += e.deltaY > 0 ? 1 : -1; }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      this.onLockChange?.(this.locked);
    });
  }

  lock() {
    try { const p = this.el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* unsupported */ }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedKeys.has(code); }
  endFrame() { this.pressedKeys.clear(); this.dx = this.dy = 0; this.lmbPressed = false; this.wheel = 0; }
}
