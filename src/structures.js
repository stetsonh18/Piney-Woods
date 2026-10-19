import * as THREE from 'three';
import { STRUCTURES, HQ_LEVELS } from './config.js';
import { heightAt } from './terrain.js';

const mats = new Map();
function lam(color, opts) {
  const k = color + (opts ? JSON.stringify(opts) : '');
  let m = mats.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, ...opts }); mats.set(k, m); }
  return m;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(rt, rb, h, mat, seg = 7) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }

export const COLLIDERS = {
  hq: { kind: 'box', hw: 4, hd: 3.5, h: 7 },
  wall: { kind: 'box', hw: 3, hd: 0.45, h: 2.8 },
  turret: { kind: 'box', hw: 1.1, hd: 1.1, h: 3.6 },
  campfire: { kind: 'circle', r: 1, h: 0.7 },
  wire: { kind: 'area', hw: 3, hd: 0.9, h: 1.2 },
  barrier: { kind: 'box', hw: 2.5, hd: 0.2, h: 2.6 },
  miniturret: { kind: 'circle', r: 0.6, h: 1.4 },
};

function gunGroup(teamColor, scale = 1) {
  const g = new THREE.Group();
  g.add(box(0.5, 0.45, 0.8, lam(0x2d2d2d)));
  const barrel = cyl(0.07, 0.07, 0.9, lam(0x1a1a1a), 6);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.05, 0.75);
  g.add(barrel);
  g.add(box(0.52, 0.12, 0.3, lam(teamColor), 0, 0.28, -0.1));
  g.scale.setScalar(scale);
  return g;
}

export function buildStructureMesh(type, teamColor) {
  const g = new THREE.Group();
  const parts = {};
  const logs = lam(0x8b6a3e), dark = lam(0x4b3621), team = lam(teamColor);
  switch (type) {
    case 'hq': {
      g.add(box(8, 4.5, 7, lam(0x7a5230), 0, 2.25, 0));
      for (let i = 0; i < 5; i++) {
        for (const z of [-3.55, 3.55]) {
          const l = cyl(0.22, 0.22, 8.3, dark, 6);
          l.rotation.z = Math.PI / 2; l.position.set(0, 0.45 + i * 0.9, z);
          g.add(l);
        }
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 3.2, 4), lam(0x3d2f24));
      roof.rotation.y = Math.PI / 4; roof.scale.z = 0.9; roof.position.y = 6.1;
      g.add(roof);
      g.add(box(8.1, 0.5, 7.1, team, 0, 4.3, 0));
      g.add(box(1.6, 2.6, 0.2, dark, 0, 1.3, 3.62));
      const glow = lam(0xffd27a, { emissive: 0xffb340, emissiveIntensity: 0.8 });
      g.add(box(1.1, 0.9, 0.12, glow, -2.6, 2.4, 3.6), box(1.1, 0.9, 0.12, glow, 2.6, 2.4, 3.6));
      const pole = cyl(0.08, 0.08, 9, lam(0xcccccc), 6);
      pole.position.set(3.4, 4.5, -2.8);
      g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshLambertMaterial({ color: teamColor, side: THREE.DoubleSide }));
      flag.position.set(4.6, 8.2, -2.8);
      g.add(flag);
      parts.flag = flag;
      break;
    }
    case 'wall': {
      for (let i = 0; i < 3; i++) {
        const l = cyl(0.45, 0.45, 6, logs, 7);
        l.rotation.z = Math.PI / 2; l.position.y = 0.45 + i * 0.9;
        g.add(l);
      }
      g.add(box(0.3, 3.1, 0.95, team, -3, 1.55, 0), box(0.3, 3.1, 0.95, team, 3, 1.55, 0));
      break;
    }
    case 'turret': {
      for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
        const leg = cyl(0.12, 0.14, 2.9, logs, 6);
        leg.position.set(x, 1.45, z);
        g.add(leg);
      }
      g.add(box(2.3, 0.25, 2.3, dark, 0, 2.9, 0));
      g.add(box(2.3, 0.5, 0.1, team, 0, 3.25, 1.15), box(2.3, 0.5, 0.1, team, 0, 3.25, -1.15));
      const gun = gunGroup(teamColor);
      gun.position.y = 3.4;
      g.add(gun);
      parts.gun = gun;
      break;
    }
    case 'campfire': {
      const stone = lam(0x777777);
      for (let i = 0; i < 8; i++) {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25), stone);
        const a = (i / 8) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8);
        g.add(s);
      }
      for (let i = 0; i < 3; i++) {
        const l = cyl(0.1, 0.1, 1.2, dark, 5);
        l.rotation.z = Math.PI / 2 - 0.3; l.rotation.y = (i / 3) * Math.PI; l.position.y = 0.25;
        g.add(l);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 7), new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.9 }));
      flame.position.y = 0.75;
      g.add(flame);
      const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      flame2.position.y = 0.6;
      g.add(flame2);
      g.add(box(0.3, 0.3, 0.3, team, 0, 0.15, -1.1));
      parts.flame = flame;
      break;
    }
    case 'wire': {
      const metal = lam(0x9ca3af);
      for (const x of [-2.8, 0, 2.8]) {
        const p = cyl(0.06, 0.06, 1.2, dark, 5);
        p.position.set(x, 0.6, 0);
        g.add(p);
      }
      for (const y of [0.35, 0.7, 1.05]) {
        for (const z of [-0.5, 0.5]) {
          const w = cyl(0.025, 0.025, 6, metal, 4);
          w.rotation.z = Math.PI / 2; w.position.set(0, y, z);
          g.add(w);
        }
      }
      g.add(box(0.2, 0.2, 0.2, team, -2.8, 1.25, 0));
      break;
    }
    case 'barrier': {
      g.add(box(5, 2.6, 0.25, new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.35, depthWrite: false }), 0, 1.3, 0));
      g.add(box(5.1, 0.15, 0.3, team, 0, 2.6, 0), box(5.1, 0.15, 0.3, team, 0, 0.05, 0));
      break;
    }
    case 'miniturret': {
      for (let i = 0; i < 3; i++) {
        const l = cyl(0.04, 0.05, 1.1, lam(0x444444), 5);
        const a = (i / 3) * Math.PI * 2;
        l.position.set(Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3);
        l.rotation.z = Math.cos(a) * 0.3; l.rotation.x = -Math.sin(a) * 0.3;
        g.add(l);
      }
      const gun = gunGroup(teamColor, 0.7);
      gun.position.y = 1.1;
      g.add(gun);
      parts.gun = gun;
      break;
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, parts };
}

// Footprint sample points (world XZ) used for placement overlap tests.
export function footprintPoints(type, x, z, rot) {
  const col = COLLIDERS[type];
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = [];
  if (col.kind === 'circle') {
    pts.push([x, z]);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; pts.push([x + Math.cos(a) * col.r, z + Math.sin(a) * col.r]); }
    return pts;
  }
  for (const lx of [-col.hw, 0, col.hw]) for (const lz of [-col.hd, 0, col.hd]) {
    pts.push([x + lx * c + lz * s, z - lx * s + lz * c]);
  }
  return pts;
}

export function pointInFootprint(type, x, z, rot, px, pz, pad = 0) {
  const col = COLLIDERS[type];
  const dx = px - x, dz = pz - z;
  if (col.kind === 'circle') return dx * dx + dz * dz <= (col.r + pad) ** 2;
  const c = Math.cos(rot), s = Math.sin(rot);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) <= col.hw + pad && Math.abs(lz) <= col.hd + pad;
}

let nextId = 1;

export class Structure {
  constructor(game, type, team, x, z, rot, opts = {}) {
    this.id = nextId++;
    this.isStruct = true;
    this.game = game; this.type = type; this.team = team; this.rot = rot;
    this.def = STRUCTURES[type];
    this.name = this.def.name;
    this.collider = COLLIDERS[type];
    this.level = 0;
    this.maxHp = (opts.hp ?? this.def.hp) * (opts.hpMul || 1);
    this.hp = this.maxHp;
    this.alive = true;
    this.life = opts.life || 0;
    this.cd = Math.random() * 0.5;
    this.scanT = 0;
    this.target = null;
    this.lastHitT = -99;
    this.cos = Math.cos(rot); this.sin = Math.sin(rot);
    this.blocks = this.collider.kind === 'box' || this.collider.kind === 'circle';
    const { group, parts } = buildStructureMesh(type, team.color);
    this.mesh = group; this.parts = parts;
    let y = heightAt(x, z);
    if (this.collider.kind !== 'circle') {
      for (const [px, pz] of footprintPoints(type, x, z, rot)) y = Math.min(y, heightAt(px, pz));
    }
    this.pos = new THREE.Vector3(x, y - 0.05, z);
    group.position.copy(this.pos);
    group.rotation.y = rot;
    group.scale.setScalar(0.3);
    this.spawnT = 0;
    game.scene.add(group);
  }

  get top() { return this.pos.y + this.collider.h; }
  get isTurret() { return this.type === 'turret' || this.type === 'miniturret' || (this.type === 'hq' && this.level >= 1); }

  toLocal(x, z) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    return [dx * this.cos - dz * this.sin, dx * this.sin + dz * this.cos];
  }

  containsXZ(x, z, pad = 0) { return pointInFootprint(this.type, this.pos.x, this.pos.z, this.rot, x, z, pad); }

  distanceTo2D(x, z) {
    const col = this.collider;
    if (col.kind === 'circle') return Math.max(0, Math.hypot(x - this.pos.x, z - this.pos.z) - col.r);
    const [lx, lz] = this.toLocal(x, z);
    const ex = Math.max(0, Math.abs(lx) - col.hw), ez = Math.max(0, Math.abs(lz) - col.hd);
    return Math.hypot(ex, ez);
  }

  center(out) { return out.set(this.pos.x, this.pos.y + this.collider.h * 0.5, this.pos.z); }

  gunPos(out) {
    const y = this.type === 'hq' ? 7.9 : this.type === 'turret' ? 3.5 : 1.15;
    return out.set(this.pos.x, this.pos.y + y, this.pos.z);
  }

  pushOut(pos, r) {
    const col = this.collider;
    if (col.kind === 'circle') {
      const dx = pos.x - this.pos.x, dz = pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 0.001, min = col.r + r;
      if (d < min) { pos.x += (dx / d) * (min - d); pos.z += (dz / d) * (min - d); }
      return;
    }
    const [lx, lz] = this.toLocal(pos.x, pos.z);
    const cx = Math.max(-col.hw, Math.min(col.hw, lx)), cz = Math.max(-col.hd, Math.min(col.hd, lz));
    const ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
    if (d >= r) return;
    let nx, nz;
    if (d > 1e-6) { nx = cx + (ex / d) * r; nz = cz + (ez / d) * r; }
    else if (col.hw - Math.abs(lx) < col.hd - Math.abs(lz)) { nx = Math.sign(lx || 1) * (col.hw + r); nz = lz; }
    else { nz = Math.sign(lz || 1) * (col.hd + r); nx = lx; }
    pos.x = this.pos.x + nx * this.cos + nz * this.sin;
    pos.z = this.pos.z - nx * this.sin + nz * this.cos;
  }

  damage(amount, attacker, opts = {}) {
    if (!this.alive) return;
    if (this.team.fortifyT > 0) return;
    this.hp -= amount;
    if (!opts.storm) this.lastHitT = this.game.time;
    if (this.hp <= 0) this.destroy(attacker);
  }

  destroy(attacker, quiet = false) {
    if (!this.alive) return;
    this.alive = false;
    this.game.scene.remove(this.mesh);
    if (quiet) return;
    const c = this.center(new THREE.Vector3());
    this.game.effects.burst(c, 0x8b6a3e, 16, 6, 1, 12, 2);
    this.game.effects.explosion(c, this.type === 'hq' ? 7 : 2.5, 0xffb060);
    this.game.audio.play('boom', c, this.type === 'hq' ? 1.3 : 0.6);
    this.game.onStructureDestroyed(this, attacker);
  }

  upgrade() {
    this.level++;
    const L = HQ_LEVELS[this.level];
    const add = L.hp - this.maxHp;
    this.maxHp = L.hp; this.hp += add;
    if (L.gun && !this.parts.gun) {
      const gun = gunGroup(this.team.color, 1.2);
      gun.position.y = 7.9;
      gun.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.mesh.add(gun);
      this.parts.gun = gun;
    }
  }

  update(dt) {
    const g = this.game;
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt / 0.35);
      const k = this.spawnT;
      this.mesh.scale.setScalar(0.3 + 0.7 * (1 - (1 - k) * (1 - k)));
    }
    if (this.life > 0) {
      this.life -= dt;
      if (this.life <= 0) { this.destroy(null, true); return; }
    }
    if (this.isTurret) this.updateTurret(dt);
    if (this.type === 'campfire') {
      const f = this.parts.flame;
      f.scale.set(1, 0.85 + Math.sin(g.time * 13 + this.id) * 0.15 + Math.random() * 0.1, 1);
      const r2 = this.def.radius ** 2;
      for (const c of g.chars) {
        if (c.alive && c.team === this.team && (c.pos.x - this.pos.x) ** 2 + (c.pos.z - this.pos.z) ** 2 < r2) c.heal(this.def.heal * dt);
      }
    } else if (this.type === 'wire') {
      for (const c of g.chars) {
        if (c.alive && c.team !== this.team && c.pos.y < this.pos.y + 1.6 && this.containsXZ(c.pos.x, c.pos.z, 0.4)) {
          c.slowT = 0.3;
          g.combat.damageChar(c, this.def.dps * dt, this, false, { quiet: true });
        }
      }
    } else if (this.type === 'hq') {
      if (this.parts.flag) this.parts.flag.rotation.y = Math.sin(g.time * 2 + this.id) * 0.25;
      const regen = HQ_LEVELS[this.level].regen;
      if (regen && g.time - this.lastHitT > 4) this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    }
  }

  updateTurret(dt) {
    const g = this.game, def = this.def;
    const fort = this.team.fortifyT > 0 ? 2 : 1;
    this.cd -= dt * fort;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 0.3; this.target = g.combat.findTurretTarget(this, def.range); }
    const t = this.target;
    if (!t || !t.alive) return;
    const gun = this.parts.gun;
    if (gun) gun.rotation.y = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z) - this.rot;
    if (this.cd <= 0) {
      this.cd = 1 / def.rate;
      g.combat.structureShot(this, t);
    }
  }
}
