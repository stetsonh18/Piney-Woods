import * as THREE from 'three';
import { HEROES } from './config.js';
import { heightAt, HALF } from './terrain.js';

const matCache = new Map();
function lam(color) {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); matCache.set(color, m); }
  return m;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Characters face local +Z. Their right hand is local -X.
function buildCharMesh(hero, teamColor) {
  const g = new THREE.Group();
  const skin = lam(0xd9a37c), pants = lam(0x2f3b52), boots = lam(0x3b2a1a), team = lam(teamColor), accent = lam(hero.accent), gunM = lam(0x222222);
  const leg = (x) => {
    const p = new THREE.Group(); p.position.set(x, 0.9, 0);
    p.add(box(0.24, 0.8, 0.28, pants, 0, -0.4, 0), box(0.26, 0.16, 0.36, boots, 0, -0.84, 0.04));
    g.add(p);
    return p;
  };
  const legL = leg(0.17), legR = leg(-0.17);
  g.add(box(0.72, 0.78, 0.42, team, 0, 1.3, 0));
  g.add(box(0.74, 0.14, 0.44, accent, 0, 0.98, 0));
  const arm = (x) => {
    const p = new THREE.Group(); p.position.set(x, 1.6, 0); p.rotation.x = -1.35;
    p.add(box(0.2, 0.68, 0.22, team, 0, -0.32, 0), box(0.18, 0.14, 0.18, skin, 0, -0.7, 0));
    g.add(p);
    return p;
  };
  const armL = arm(0.45), armR = arm(-0.45);
  armL.rotation.z = -0.35;
  const gun = new THREE.Group();
  gun.add(box(0.12, 0.16, 0.95, gunM, 0, 0, 0.2), box(0.1, 0.22, 0.12, gunM, 0, -0.15, -0.05));
  gun.position.set(-0.2, 1.38, 0.45);
  g.add(gun);
  const axe = new THREE.Group();
  axe.add(box(0.07, 0.07, 0.9, lam(0x7a5230), 0, 0, 0.45), box(0.06, 0.3, 0.22, lam(0xb0b0b0), 0, 0.08, 0.85));
  axe.position.set(0, -0.72, 0); axe.visible = false;
  armR.add(axe);
  g.add(box(0.4, 0.42, 0.4, skin, 0, 1.95, 0));
  g.add(box(0.08, 0.06, 0.02, lam(0x111111), 0.09, 2.0, 0.205), box(0.08, 0.06, 0.02, lam(0x111111), -0.09, 2.0, 0.205));
  switch (hero.hat) {
    case 'cowboy': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), lam(0x6b4423));
      brim.position.y = 2.18; brim.castShadow = true;
      g.add(brim, box(0.34, 0.24, 0.34, lam(0x6b4423), 0, 2.32, 0));
      break;
    }
    case 'beanie':
      g.add(box(0.44, 0.2, 0.44, lam(0xb91c1c), 0, 2.2, 0), box(0.38, 0.2, 0.08, lam(0x5a3a1e), 0, 1.8, 0.2));
      break;
    case 'cap':
      g.add(box(0.44, 0.12, 0.44, lam(0xf1f5f9), 0, 2.2, 0), box(0.3, 0.04, 0.22, lam(0xf1f5f9), 0, 2.16, 0.3));
      g.add(box(0.1, 0.32, 0.02, lam(0xdc2626), 0, 1.35, -0.215), box(0.32, 0.1, 0.02, lam(0xdc2626), 0, 1.35, -0.215));
      break;
    case 'hood':
      g.add(box(0.48, 0.5, 0.36, lam(0x4d5d2a), 0, 2.0, -0.08), box(0.48, 0.1, 0.44, lam(0x4d5d2a), 0, 2.22, 0));
      break;
    case 'hardhat': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xeab308));
      dome.position.y = 2.15; dome.castShadow = true;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 12), lam(0xeab308));
      brim.position.y = 2.16;
      g.add(dome, brim);
      break;
    }
  }
  const chute = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshLambertMaterial({ color: teamColor, side: THREE.DoubleSide }));
  canopy.position.y = 4.2;
  chute.add(canopy);
  for (const [x, z] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) {
    const line = box(0.02, 2.6, 0.02, lam(0xdddddd), x * 0.5, 3.1, z * 0.5);
    line.rotation.set(z * 0.22, 0, -x * 0.22);
    chute.add(line);
  }
  chute.visible = false;
  g.add(chute);
  return { group: g, legL, legR, armL, armR, gun, axe, chute };
}

const _f = new THREE.Vector3(), _c = new THREE.Vector3();

export class Character {
  constructor(game, team, heroId, opts = {}) {
    this.isChar = true;
    this.game = game; this.team = team; this.heroId = heroId; this.hero = HEROES[heroId];
    this.isPlayer = !!opts.isPlayer; this.name = opts.name || this.hero.name;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.wish = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.maxHp = this.hero.hp; this.hp = this.maxHp; this.shield = 0; this.alive = false;
    this.ammo = this.hero.weapon.mag; this.reloadT = 0; this.fireCd = 0; this.fireMul = 1;
    this.cd = { a1: 0, a2: 0 }; this.ult = 0;
    this.buffs = { speed: 0, hog: 0 };
    this.dashT = 0; this.dashVel = new THREE.Vector3(); this.chargeT = 0; this.chargeHit = new Set();
    this.slowT = 0; this.onGround = false; this.parachute = false; this.wantJump = false; this.ads = false;
    this.lastDamagedT = -99; this.lastFireT = -99; this.lastAttacker = null; this.respawnT = 0; this.revealedTo = {};
    this.kills = 0; this.deaths = 0; this.damageDealt = 0; this.treesChopped = 0; this.built = 0;
    this.walkPhase = 0; this.swingT = 0; this.chopCd = 0;
    this.dmgMulVsPlayer = 1;
    const parts = buildCharMesh(this.hero, team.color);
    this.parts = parts; this.mesh = parts.group;
    this.mesh.visible = false;
    game.scene.add(this.mesh);
  }

  forward(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  eye(out) { return out.set(this.pos.x, this.pos.y + 1.6, this.pos.z); }
  chest(out) { return out.set(this.pos.x, this.pos.y + 1.3, this.pos.z); }
  muzzle(out) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return out.set(this.pos.x + s * 0.7 - c * 0.22, this.pos.y + 1.42, this.pos.z + c * 0.7 + s * 0.22);
  }
  get hpFrac() { return this.hp / this.maxHp; }

  spawn(x, z, y) {
    this.pos.set(x, y ?? heightAt(x, z), z);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp; this.shield = 0; this.alive = true;
    this.ammo = this.hero.weapon.mag; this.reloadT = 0; this.dashT = 0; this.chargeT = 0;
    this.buffs.speed = 0; this.buffs.hog = 0; this.respawnT = 0;
    this.mesh.visible = true;
  }

  heal(n) { if (this.alive) this.hp = Math.min(this.maxHp, this.hp + n); }

  dash(dx, dz, speed, dur) {
    this.dashVel.set(dx * speed, 0, dz * speed);
    this.dashT = dur;
    if (this.onGround) this.vel.y = 2.5;
  }

  startReload() {
    const w = this.hero.weapon;
    if (this.reloadT > 0 || this.ammo >= w.mag || this.buffs.hog > 0) return;
    this.reloadT = w.reload;
    this.game.audio.play('reload', this.pos, 0.6);
  }

  tryFire(aim) {
    if (!this.alive || this.parachute || this.reloadT > 0 || this.fireCd > 0) return false;
    const w = this.hero.weapon;
    if (this.ammo <= 0) { this.startReload(); return false; }
    const rate = w.rate * (this.buffs.hog > 0 ? 2 : 1) * this.fireMul;
    this.fireCd = 1 / rate;
    if (!(this.buffs.hog > 0)) this.ammo--;
    this.game.combat.fire(this, aim);
    this.lastFireT = this.game.time;
    if (this.ammo <= 0) this.startReload();
    return true;
  }

  // F: melee an enemy, chop a pine, open a crate, or bash an enemy structure.
  melee() {
    if (!this.alive || this.chopCd > 0 || this.parachute) return null;
    const g = this.game;
    this.chopCd = 0.55; this.swingT = 0.35;
    const f = this.forward(_f);
    g.audio.play('swing', this.pos);
    for (const o of g.chars) {
      if (!o.alive || o.team === this.team) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.6 && (dx * f.x + dz * f.z) / (d || 1) > 0.4 && Math.abs(o.pos.y - this.pos.y) < 2) {
        g.combat.damageChar(o, this.heroId === 'lumberjack' ? 55 : 35, this, false);
        g.effects.burst(o.chest(_c), 0xaa2222, 6, 3, 0.4);
        return 'hit';
      }
    }
    const tree = g.terrain.nearestTree(this.pos.x + f.x, this.pos.z + f.z, 2.0, (t) => !t.decor);
    if (tree) {
      g.audio.play('chop', this.pos);
      const felled = g.terrain.chop(tree, this.heroId === 'lumberjack' ? 3 : 1, f);
      if (felled) {
        const amt = this.heroId === 'lumberjack' ? 15 : 10;
        this.team.lumber += amt;
        this.treesChopped++;
        if (this.isPlayer) g.hud.toast(`+${amt} Lumber`, 'lumber');
      }
      return 'tree';
    }
    const crate = g.terrain.nearestCrate(this.pos.x, this.pos.z, 2.6);
    if (crate) {
      g.terrain.openCrate(crate);
      this.team.scrap += 25; this.team.lumber += 10;
      if (this.isPlayer) { g.hud.toast('+25 Scrap  +10 Lumber', 'scrap'); g.audio.play('crate'); }
      return 'crate';
    }
    for (const s of g.structures) {
      if (s.alive && s.team !== this.team && s.containsXZ(this.pos.x + f.x * 1.5, this.pos.z + f.z * 1.5, 0.8)) {
        s.damage(this.heroId === 'lumberjack' ? 80 : 40, this);
        g.effects.burst(_c.set(this.pos.x + f.x * 1.5, this.pos.y + 1.2, this.pos.z + f.z * 1.5), 0x8b6a3e, 8, 3, 0.5);
        return 'struct';
      }
    }
    return null;
  }

  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    this.cd.a1 = Math.max(0, this.cd.a1 - dt);
    this.cd.a2 = Math.max(0, this.cd.a2 - dt);
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.fireCd -= dt; this.chopCd -= dt; this.swingT -= dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.reloadT = 0; this.ammo = this.hero.weapon.mag; } }
    if (this.shield > 0) this.shield = Math.max(0, this.shield - 3 * dt);
    if (!this.parachute) this.ult = Math.min(100, this.ult + dt * 0.7);
    if (this.heroId === 'doc' && g.time - this.lastDamagedT > 3) this.heal(7 * dt);
    this.physics(dt);
    if (this.chargeT > 0) this.chargeContacts();
    this.animate(dt);
  }

  physics(dt) {
    const g = this.game, v = this.vel;
    if (this.parachute) {
      v.x += (this.wish.x * 16 - v.x) * Math.min(1, 2 * dt);
      v.z += (this.wish.z * 16 - v.z) * Math.min(1, 2 * dt);
      v.y = -11;
    } else if (this.dashT > 0) {
      this.dashT -= dt; this.chargeT -= dt;
      v.x = this.dashVel.x; v.z = this.dashVel.z;
    } else {
      const sp = this.hero.speed * (this.buffs.speed > 0 ? 1.45 : 1) * (this.buffs.hog > 0 ? 1.2 : 1) * (this.slowT > 0 ? 0.55 : 1) * (this.ads ? 0.65 : 1);
      const acc = this.onGround ? 14 : 2.5;
      v.x += (this.wish.x * sp - v.x) * Math.min(1, acc * dt);
      v.z += (this.wish.z * sp - v.z) * Math.min(1, acc * dt);
    }
    if (!this.parachute) v.y -= 24 * dt;
    this.pos.addScaledVector(v, dt);
    this.collide();
    const lim = HALF - 1;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
    const gy = heightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gy || (v.y <= 0 && this.onGround && this.pos.y - gy < 0.45)) {
      if (this.parachute) { this.parachute = false; g.onLanded(this); }
      this.pos.y = gy;
      if (v.y < 0) v.y = 0;
      this.onGround = true;
    } else this.onGround = false;
    if (this.wantJump && this.onGround && !this.parachute) { v.y = 8; this.onGround = false; }
  }

  collide() {
    const g = this.game, p = this.pos, r = 0.5;
    g.terrain.forTreesNear(p.x, p.z, r, (t) => {
      if (p.y > g.terrain.treeTop(t)) return;
      const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz) || 0.001, min = r + t.r;
      if (d < min) { p.x += (dx / d) * (min - d); p.z += (dz / d) * (min - d); }
    });
    for (const s of g.structures) {
      if (!s.alive || !s.blocks) continue;
      if (s.type === 'barrier' && s.team === this.team) continue;
      const dx = p.x - s.pos.x, dz = p.z - s.pos.z;
      if (dx * dx + dz * dz > 64 || p.y > s.top - 0.2) continue;
      s.pushOut(p, r);
    }
  }

  chargeContacts() {
    const g = this.game;
    for (const o of g.chars) {
      if (!o.alive || o.team === this.team || this.chargeHit.has(o)) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.7) {
        this.chargeHit.add(o);
        g.combat.damageChar(o, 45, this, false);
        o.vel.x += (dx / (d || 1)) * 14; o.vel.z += (dz / (d || 1)) * 14; o.vel.y += 5;
      }
    }
    const f = this.forward(_f);
    for (const s of g.structures) {
      if (s.alive && s.team !== this.team && s.blocks && s.containsXZ(this.pos.x + f.x * 0.9, this.pos.z + f.z * 0.9, 0.3)) {
        s.damage(120, this);
        g.effects.burst(s.center(_c), 0x8b6a3e, 12, 5, 0.6);
        this.dashT = 0; this.chargeT = 0;
        break;
      }
    }
  }

  animate(dt) {
    const m = this.mesh, P = this.parts;
    m.position.copy(this.pos);
    m.rotation.y = this.yaw;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 0.5) this.walkPhase += dt * hs * 1.7;
    const sw = Math.sin(this.walkPhase) * Math.min(1, hs / 6) * 0.8;
    if (this.onGround) { P.legL.rotation.x = sw; P.legR.rotation.x = -sw; }
    else { P.legL.rotation.x = -0.5; P.legR.rotation.x = 0.3; }
    const swinging = this.swingT > 0;
    P.axe.visible = swinging; P.gun.visible = !swinging;
    if (swinging) {
      const k = 1 - this.swingT / 0.35;
      P.armR.rotation.x = -2.8 + k * 2.4;
    } else {
      const recoil = this.fireCd > 0 && this.game.time - this.lastFireT < 0.08 ? 0.15 : 0;
      P.armR.rotation.x = -1.35 + recoil;
      P.gun.position.z = 0.45 - recoil;
    }
    P.armL.rotation.x = this.reloadT > 0 ? -0.9 + Math.sin(this.game.time * 14) * 0.2 : -1.35;
    P.chute.visible = this.parachute;
  }
}
