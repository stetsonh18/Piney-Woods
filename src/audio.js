// Tiny procedural sound kit — no audio files needed.
export class Sfx {
  constructor(game) { this.g = game; this.ctx = null; this.last = {}; }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  }

  vol(pos) {
    if (!pos) return 1;
    const p = this.g.listenerPos;
    const d = Math.hypot(pos.x - p.x, pos.z - p.z);
    return Math.max(0, 1 - d / 130) ** 1.6;
  }

  nz(dur, freq, type, v, q = 1) {
    const c = this.ctx, now = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(now, Math.random() * 0.5);
    src.stop(now + dur + 0.05);
  }

  tone(f0, f1, dur, type, v, delay = 0) {
    const c = this.ctx, now = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + dur + 0.05);
  }

  play(name, pos, mul = 1) {
    if (!this.ctx) return;
    const v = this.vol(pos) * mul;
    if (v < 0.02) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return;
    this.last[name] = now;
    switch (name) {
      case 'rifle': this.nz(0.12, 1800, 'bandpass', 0.5 * v, 0.8); this.tone(180, 60, 0.08, 'square', 0.12 * v); break;
      case 'smg': this.nz(0.07, 2400, 'bandpass', 0.35 * v, 0.8); break;
      case 'shotgun': this.nz(0.28, 1100, 'lowpass', 0.9 * v); this.tone(120, 40, 0.15, 'square', 0.2 * v); break;
      case 'sniper': this.nz(0.45, 900, 'lowpass', 1 * v); this.tone(90, 30, 0.3, 'sawtooth', 0.25 * v); break;
      case 'turret': this.nz(0.06, 3000, 'bandpass', 0.25 * v); break;
      case 'hit': this.tone(1400, 1300, 0.05, 'square', 0.12); break;
      case 'head': this.tone(2200, 2000, 0.07, 'square', 0.14); break;
      case 'kill': this.tone(600, 1300, 0.18, 'triangle', 0.25); break;
      case 'hurt': this.tone(220, 120, 0.1, 'sawtooth', 0.12); break;
      case 'swing': this.nz(0.12, 900, 'highpass', 0.15 * v); break;
      case 'chop': this.tone(150, 70, 0.12, 'triangle', 0.6 * v); this.nz(0.06, 700, 'bandpass', 0.3 * v); break;
      case 'fell': this.nz(0.9, 380, 'lowpass', 0.6 * v); this.tone(80, 40, 0.6, 'triangle', 0.3 * v); break;
      case 'boom': this.nz(1.0, 480, 'lowpass', 1.1 * v); this.tone(70, 25, 0.7, 'sine', 0.6 * v); break;
      case 'build': this.tone(240, 180, 0.08, 'triangle', 0.5 * v); this.tone(200, 150, 0.08, 'triangle', 0.5 * v, 0.1); break;
      case 'ult': this.tone(200, 900, 0.6, 'sawtooth', 0.18 * v); break;
      case 'dash': this.nz(0.22, 800, 'highpass', 0.3 * v); break;
      case 'heal': this.tone(500, 950, 0.35, 'sine', 0.25 * v); break;
      case 'reload': this.tone(800, 700, 0.03, 'square', 0.1 * v); this.tone(600, 500, 0.03, 'square', 0.1 * v, 0.12); break;
      case 'crate': this.tone(400, 650, 0.2, 'triangle', 0.3); break;
      case 'deny': this.tone(200, 160, 0.12, 'square', 0.12); break;
      case 'alarm': this.tone(700, 500, 0.25, 'square', 0.12); this.tone(700, 500, 0.25, 'square', 0.12, 0.3); break;
    }
  }
}
