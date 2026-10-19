import * as THREE from 'three';
import { ABILITIES } from './abilities.js';
import { DIFFICULTY } from './config.js';

const _e = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Vector3(), _d = new THREE.Vector3();
const PREF_RANGE = { lumberjack: 7, doc: 18, ranger: 22, engineer: 22, hawk: 60 };

function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15; }

export class Bot {
  constructor(game, char) {
    this.g = game; this.c = char;
    this.params = char.team.isPlayerTeam ? DIFFICULTY.normal : game.diff;
    char.fireMul = this.params.fireMul;
    char.dmgMulVsPlayer = this.params.dmgMul;
    this.thinkT = Math.random() * 0.3;
    this.mode = 'idle'; this.goal = null;
    this.target = null; this.struct = null; this.tree = null;
    this.reactT = 0; this.strafeDir = 1; this.strafeT = 0;
    this.avoidSide = Math.random() < 0.5 ? 1 : -1;
    this.stuckT = 0; this.lastPos = new THREE.Vector3(); this.unstickT = 0; this.unstickDir = new THREE.Vector2();
    this.errT = 0; this.errYaw = 0; this.errPitch = 0;
    this.patrolT = 0; this.patrol = null;
  }

  update(dt) {
    const c = this.c, g = this.g;
    if (!c.alive) { this.target = null; this.struct = null; return; }
    if (c.parachute) {
      const dp = c.team.isPlayerTeam && g.player ? { x: g.player.pos.x + 4, z: g.player.pos.z + 3 } : c.team.dropPoint;
      const dx = dp.x - c.pos.x, dz = dp.z - c.pos.z, d = Math.hypot(dx, dz);
      c.wish.set(d > 2 ? dx / d : 0, 0, d > 2 ? dz / d : 0);
      if (d > 2) c.yaw = Math.atan2(dx, dz);
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.28 + Math.random() * 0.15; this.think(); }
    this.steer(dt);
    this.shoot(dt);
  }

  findTarget() {
    const c = this.c, g = this.g;
    const vision = c.heroId === 'hawk' ? 150 : 90;
    const eye = c.eye(_e);
    const cands = [];
    for (const o of g.chars) {
      if (!o.alive || o.team === c.team || o.parachute) continue;
      const d = c.pos.distanceTo(o.pos);
      const v = o === c.lastAttacker && g.time - c.lastDamagedT < 2 ? vision * 1.4 : vision;
      if (d < v) cands.push([d, o]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    if (this.target && this.target.alive && cands.some(([, o]) => o === this.target) && g.combat.canSee(eye, this.target, { ignore: c, team: c.team })) return this.target;
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      if (g.combat.canSee(eye, cands[i][1], { ignore: c, team: c.team })) return cands[i][1];
    }
    return null;
  }

  think() {
    const c = this.c, g = this.g, team = c.team, hq = team.hq && team.hq.alive ? team.hq : null;
    const prev = this.target;
    this.target = this.findTarget();
    if (this.target && this.target !== prev) this.reactT = this.params.reaction * (0.7 + Math.random() * 0.6);
    const storm = g.storm;
    const edge = storm.distToEdge(c.pos.x, c.pos.z);
    const raidTeam = team.raidTarget && !team.raidTarget.eliminated ? team.raidTarget : null;
    if (!this.target && !raidTeam) this.struct = null;

    if (edge < 3 && (storm.dps >= 5 || !this.target || c.hpFrac < 0.5)) {
      this.mode = 'storm';
      const dx = storm.center.x - c.pos.x, dz = storm.center.y - c.pos.z, d = Math.hypot(dx, dz) || 1;
      const into = Math.min(d, Math.max(10, storm.radius * 0.4));
      this.goal = { x: c.pos.x + (dx / d) * (-edge + into), z: c.pos.z + (dz / d) * (-edge + into) };
    } else if (this.target) {
      this.mode = 'fight';
      const t = this.target;
      const dx = c.pos.x - t.pos.x, dz = c.pos.z - t.pos.z, d = Math.hypot(dx, dz) || 1;
      const pref = PREF_RANGE[c.heroId];
      this.strafeT -= 0.35;
      if (this.strafeT <= 0) { this.strafeT = 3 + Math.random() * 4; this.strafeDir *= -1; }
      const px = -dz / d, pz = dx / d;
      this.goal = { x: t.pos.x + (dx / d) * pref + px * this.strafeDir * 6, z: t.pos.z + (dz / d) * pref + pz * this.strafeDir * 6 };
    } else if (hq && g.time - hq.lastHitT < 6 && c.pos.distanceTo(hq.pos) < 150) {
      this.mode = 'defend';
      this.goal = { x: hq.pos.x + Math.sin(hq.rot) * 8, z: hq.pos.z + Math.cos(hq.rot) * 8 };
    } else if (raidTeam && raidTeam.hq && raidTeam.hq.alive) {
      this.mode = 'raid';
      const eh = raidTeam.hq;
      const d = c.pos.distanceTo(eh.pos);
      if (d < 60) {
        if (!this.struct || !this.struct.alive || Math.random() < 0.1) this.struct = this.pickStructure(raidTeam);
        const s = this.struct || eh;
        const pref = Math.max(6, Math.min(PREF_RANGE[c.heroId], 30));
        const dx = c.pos.x - s.pos.x, dz = c.pos.z - s.pos.z, dd = Math.hypot(dx, dz) || 1;
        this.goal = { x: s.pos.x + (dx / dd) * pref, z: s.pos.z + (dz / dd) * pref };
      } else this.goal = { x: eh.pos.x, z: eh.pos.z };
    } else if (raidTeam) {
      // Raid target has no HQ left: hunt its survivors.
      this.mode = 'hunt';
      const m = raidTeam.members.find((o) => o.alive);
      this.goal = m ? { x: m.pos.x, z: m.pos.z } : null;
    } else if (team.isPlayerTeam && g.player.alive && c.pos.distanceTo(g.player.pos) > 22) {
      this.mode = 'follow';
      this.goal = { x: g.player.pos.x + 3, z: g.player.pos.z + 3 };
    } else if (hq && team.lumber < 160) {
      this.mode = 'gather';
      if (!this.tree || !this.tree.alive) this.tree = g.terrain.nearestTree(hq.pos.x + (Math.random() - 0.5) * 30, hq.pos.z + (Math.random() - 0.5) * 30, 50, (t) => !t.decor);
      this.goal = this.tree ? { x: this.tree.x, z: this.tree.z } : null;
    } else {
      this.mode = 'patrol';
      this.patrolT -= 0.35;
      const base = hq ? hq.pos : { x: storm.center.x, z: storm.center.y };
      if (!this.patrol || this.patrolT <= 0) {
        this.patrolT = 5 + Math.random() * 5;
        const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 20;
        this.patrol = { x: base.x + Math.cos(a) * r, z: base.z + Math.sin(a) * r };
      }
      this.goal = this.patrol;
    }
    this.useAbilities(hq, raidTeam);
  }

  pickStructure(team) {
    const c = this.c, g = this.g;
    let best = null, bs = Infinity;
    const eye = c.eye(_e);
    for (const s of g.structures) {
      if (!s.alive || s.team !== team || s.collider.kind === 'area') continue;
      const d = c.pos.distanceTo(s.pos);
      if (d > 70) continue;
      const score = d - (s.isTurret ? 25 : 0) - (s.type === 'hq' ? 10 : 0);
      if (score >= bs) continue;
      s.center(_c);
      _d.subVectors(_c, eye);
      const dist = _d.length();
      _d.divideScalar(dist);
      const hit = g.combat.raycast(eye, _d, dist + 1, { ignore: c, team: c.team, noChars: true });
      if (hit.kind === 'struct' && hit.obj.team === team) { best = hit.obj; bs = score; }
    }
    return best;
  }

  useAbilities(hq, raidTeam) {
    const c = this.c, g = this.g;
    const ctx = {
      target: this.target,
      dist: this.target ? c.pos.distanceTo(this.target.pos) : Infinity,
      hpFrac: c.hpFrac,
      struct: this.struct && this.struct.alive ? this.struct : null,
      structDist: this.struct ? c.pos.distanceTo(this.struct.pos) : Infinity,
      raiding: this.mode === 'raid',
      enemiesClose: g.chars.filter((o) => o.alive && o.team !== c.team && o.pos.distanceTo(c.pos) < 10).length,
      allyLow: g.chars.some((o) => o.alive && o !== c && o.team === c.team && o.hpFrac < 0.6 && o.pos.distanceTo(c.pos) < 13),
      allyDead: c.team.members.some((o) => !o.alive),
      hqUnderAttack: hq && g.time - hq.lastHitT < 4,
      nearHQ: hq && c.pos.distanceTo(hq.pos) < 35,
      ownDamaged: g.structures.some((s) => s.alive && s.team === c.team && s.hp < s.maxHp * 0.7 && s.pos.distanceTo(c.pos) < 16),
    };
    const slot = ABILITIES[c.heroId].bot(g, this, ctx);
    if (!slot) return;
    let aim = null;
    if (this.target) aim = this.target.chest(new THREE.Vector3());
    else if (ctx.struct) aim = ctx.struct.center(new THREE.Vector3());
    else if (raidTeam && raidTeam.hq && raidTeam.hq.alive) aim = raidTeam.hq.center(new THREE.Vector3());
    if (aim) c.yaw = Math.atan2(aim.x - c.pos.x, aim.z - c.pos.z);
    g.castAbility(c, slot, aim);
  }

  blockedAt(x, z) {
    const g = this.g;
    let hit = null;
    g.terrain.forTreesNear(x, z, 0.7, (t) => { hit = t; });
    if (hit) return { tree: hit };
    for (const s of g.structures) {
      if (!s.alive || !s.blocks) continue;
      if (s.type === 'barrier' && s.team === this.c.team) continue;
      if (Math.abs(s.pos.x - x) > 6 || Math.abs(s.pos.z - z) > 6) continue;
      if (s.containsXZ(x, z, 0.6)) return { struct: s };
    }
    return null;
  }

  steer(dt) {
    const c = this.c, g = this.g;
    let wx = 0, wz = 0, jump = false;
    if (this.goal) {
      const dx = this.goal.x - c.pos.x, dz = this.goal.z - c.pos.z, d = Math.hypot(dx, dz);
      const arrive = this.mode === 'gather' ? 1.9 : 1.5;
      if (d > arrive) { wx = dx / d; wz = dz / d; }
    }
    if (this.mode === 'gather' && this.tree && this.tree.alive && Math.hypot(this.tree.x - c.pos.x, this.tree.z - c.pos.z) < 2.3) {
      wx = wz = 0;
      c.yaw = Math.atan2(this.tree.x - c.pos.x, this.tree.z - c.pos.z);
      if (!this.target) c.melee();
    }
    if (this.unstickT > 0) {
      this.unstickT -= dt;
      wx = this.unstickDir.x; wz = this.unstickDir.y;
    } else if (wx || wz) {
      const probe = 2.2;
      let b = this.blockedAt(c.pos.x + wx * probe, c.pos.z + wz * probe);
      if (b) {
        if (b.struct && b.struct.team !== c.team && (this.mode === 'raid' || this.mode === 'hunt' || this.mode === 'fight')) this.struct = b.struct;
        for (const ang of [0.8, 1.6, -0.8, -1.6, 2.4]) {
          const a = ang * this.avoidSide, ca = Math.cos(a), sa = Math.sin(a);
          const nx = wx * ca - wz * sa, nz = wx * sa + wz * ca;
          if (!this.blockedAt(c.pos.x + nx * probe, c.pos.z + nz * probe)) { wx = nx; wz = nz; b = null; break; }
        }
      }
    }
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      const moved = Math.hypot(c.pos.x - this.lastPos.x, c.pos.z - this.lastPos.z);
      if (moved < 1 && (wx || wz) && this.mode !== 'gather') {
        this.avoidSide *= -1;
        jump = true;
        const a = Math.random() * Math.PI * 2;
        this.unstickDir.set(Math.cos(a), Math.sin(a));
        this.unstickT = 0.7;
      }
      this.stuckT = 0;
      this.lastPos.copy(c.pos);
    }
    c.wish.set(wx, 0, wz);
    c.wantJump = jump;
    const aimObj = this.target || this.struct;
    if (!aimObj && (wx || wz) && !(this.mode === 'gather' && !wx)) {
      const want = Math.atan2(wx, wz);
      let diff = want - c.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      c.yaw += diff * Math.min(1, dt * 8);
    }
  }

  shoot(dt) {
    const c = this.c, g = this.g, w = c.hero.weapon;
    let aim = null;
    if (this.target && this.target.alive) aim = this.target.chest(_c);
    else if (this.struct && this.struct.alive) aim = this.struct.center(_c);
    c.ads = false;
    if (!aim) {
      if (c.ammo < w.mag * 0.5) c.startReload();
      return;
    }
    const want = Math.atan2(aim.x - c.pos.x, aim.z - c.pos.z);
    let diff = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw));
    c.yaw += diff * Math.min(1, dt * 10);
    this.reactT -= dt;
    const m = c.muzzle(_m);
    const dist = m.distanceTo(aim);
    if (this.reactT > 0 || dist > w.range * 0.95 || Math.abs(diff) > 0.3) return;
    this.errT -= dt;
    if (this.errT <= 0) {
      this.errT = 0.12 + Math.random() * 0.1;
      const tv = this.target ? Math.hypot(this.target.vel.x, this.target.vel.z) : 0;
      const e = this.params.aimErr * (1 + tv / 9) * (c.heroId === 'hawk' ? 0.6 : 1);
      this.errYaw = gauss() * e; this.errPitch = gauss() * e * 0.7;
    }
    _d.subVectors(aim, m).normalize();
    const yaw = Math.atan2(_d.x, _d.z) + this.errYaw, pitch = Math.asin(Math.max(-1, Math.min(1, _d.y))) + this.errPitch;
    _e.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist).add(m);
    if (c.heroId === 'hawk') c.ads = true;
    c.tryFire(_e);
  }
}
