import * as THREE from 'three';

// Warzone-style closing circle. Damages players and slowly eats bases left outside.
const PHASES = [
  { wait: 75, shrink: 45, radius: 170, dps: 3 },
  { wait: 60, shrink: 40, radius: 100, dps: 5 },
  { wait: 50, shrink: 35, radius: 55, dps: 8 },
  { wait: 40, shrink: 30, radius: 22, dps: 12 },
  { wait: 30, shrink: 30, radius: 0, dps: 18 },
];

export class Storm {
  constructor(game, rng) {
    this.g = game; this.rng = rng;
    this.center = new THREE.Vector2((rng() - 0.5) * 60, (rng() - 0.5) * 60);
    this.radius = 300;
    this.phase = 0; this.t = 0; this.state = 'wait';
    this.from = { c: this.center.clone(), r: this.radius };
    this.next = this.pickNext();
    this.dps = 2;
    const geo = new THREE.CylinderGeometry(1, 1, 80, 96, 1, true);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9b5cf6, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.mesh.position.y = 20;
    this.mesh.renderOrder = 2;
    game.scene.add(this.mesh);
    this.syncMesh();
  }

  pickNext() {
    const p = PHASES[this.phase];
    if (!p) return null;
    const slack = Math.max(0, this.radius - p.radius);
    const a = this.rng() * Math.PI * 2, r = this.rng() * slack * 0.6;
    return { c: new THREE.Vector2(this.center.x + Math.cos(a) * r, this.center.y + Math.sin(a) * r), r: p.radius };
  }

  syncMesh() {
    const r = Math.max(0.5, this.radius);
    this.mesh.scale.set(r, 1, r);
    this.mesh.position.x = this.center.x; this.mesh.position.z = this.center.y;
  }

  get timeLeft() {
    const p = PHASES[this.phase];
    if (!p) return 0;
    return this.state === 'wait' ? p.wait - this.t : p.shrink - this.t;
  }

  update(dt) {
    const p = PHASES[this.phase];
    if (!p) return;
    this.t += dt;
    if (this.state === 'wait') {
      if (this.t >= p.wait) {
        this.state = 'shrink'; this.t = 0;
        this.from = { c: this.center.clone(), r: this.radius };
        this.g.hud.bigToast('THE STORM IS CLOSING IN', '#c4b5fd');
        this.g.audio.play('alarm');
      }
    } else {
      const k = Math.min(1, this.t / p.shrink);
      this.center.lerpVectors(this.from.c, this.next.c, k);
      this.radius = this.from.r + (this.next.r - this.from.r) * k;
      this.dps = p.dps;
      if (k >= 1) {
        this.phase++; this.state = 'wait'; this.t = 0;
        this.next = this.pickNext();
      }
    }
    this.syncMesh();
  }

  outside(x, z) { return Math.hypot(x - this.center.x, z - this.center.y) > this.radius; }
  distToEdge(x, z) { return this.radius - Math.hypot(x - this.center.x, z - this.center.y); }
}
