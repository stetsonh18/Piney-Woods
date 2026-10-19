import * as THREE from 'three';

const _mid = new THREE.Vector3();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = []; this.parts = []; this.booms = []; this.rings = [];
    this.ti = 0; this.pi = 0; this.bi = 0; this.ri = 0;

    const tGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, depthWrite: false }));
      m.visible = false; m.frustumCulled = false;
      scene.add(m);
      this.tracers.push({ m, life: 0 });
    }
    const pGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    for (let i = 0; i < 300; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.parts.push({ m, vel: new THREE.Vector3(), life: 0, max: 1, grav: 9 });
    }
    const sGeo = new THREE.SphereGeometry(1, 14, 10);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.booms.push({ m, life: 0, r: 1 });
    }
    const rGeo = new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, life: 0, max: 1, r: 1, grow: true });
    }
  }

  tracer(a, b, color = 0xffe9a8) {
    const t = this.tracers[(this.ti = (this.ti + 1) % this.tracers.length)];
    const len = a.distanceTo(b);
    if (len < 0.5) return;
    _mid.addVectors(a, b).multiplyScalar(0.5);
    t.m.position.copy(_mid);
    t.m.lookAt(b);
    t.m.scale.set(1, 1, len);
    t.m.material.color.setHex(color);
    t.m.material.opacity = 0.85;
    t.m.visible = true;
    t.life = 0.07;
  }

  burst(pos, color, n = 8, speed = 4, life = 0.5, grav = 9, size = 1) {
    for (let i = 0; i < n; i++) {
      const p = this.parts[(this.pi = (this.pi + 1) % this.parts.length)];
      p.m.position.copy(pos);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      p.life = p.max = life * (0.6 + Math.random() * 0.6);
      p.grav = grav;
      p.m.material.color.setHex(color);
      p.m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      p.m.visible = true;
    }
  }

  explosion(pos, radius, color = 0xffa040) {
    const b = this.booms[(this.bi = (this.bi + 1) % this.booms.length)];
    b.m.position.copy(pos);
    b.m.material.color.setHex(color);
    b.m.visible = true;
    b.life = 0.4; b.r = radius;
    this.burst(pos, 0xff8c2a, 14, radius * 2.2, 0.6, 6, 1.6);
    this.burst(pos, 0x555555, 12, radius * 1.2, 1.1, -1, 2.2);
  }

  ring(pos, radius, color = 0x4ade80, life = 0.6, grow = true) {
    const r = this.rings[(this.ri = (this.ri + 1) % this.rings.length)];
    r.m.position.set(pos.x, pos.y + 0.25, pos.z);
    r.m.material.color.setHex(color);
    r.m.visible = true;
    r.life = r.max = life; r.r = radius; r.grow = grow;
    r.m.scale.setScalar(grow ? 0.1 : radius);
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.m.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
      if (t.life <= 0) t.m.visible = false;
    }
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= p.grav * dt;
      p.m.position.addScaledVector(p.vel, dt);
      p.m.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) p.m.visible = false;
    }
    for (const b of this.booms) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const k = 1 - b.life / 0.4;
      b.m.scale.setScalar(b.r * (0.3 + 0.7 * Math.sqrt(k)));
      b.m.material.opacity = Math.max(0, 1 - k) * 0.8;
      if (b.life <= 0) b.m.visible = false;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - r.life / r.max;
      if (r.grow) r.m.scale.setScalar(r.r * (0.1 + 0.9 * k));
      r.m.material.opacity = Math.max(0, 1 - k) * 0.9;
      if (r.life <= 0) r.m.visible = false;
    }
  }
}
