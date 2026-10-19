import * as THREE from 'three';

const _f = new THREE.Vector3(), _c = new THREE.Vector3();

const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const allies = (g, c, r) => g.chars.filter((o) => o.alive && o.team === c.team && d2(o.pos, c.pos) <= r);

// Each hero: a1 (Shift), a2 (E), ult (Q), and a bot heuristic that returns which slot to cast.
// Returning false from an ability means "didn't fire" (no cooldown spent).
export const ABILITIES = {
  ranger: {
    a1(g, c) {
      let dx = c.wish.x, dz = c.wish.z;
      if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(c.yaw); dz = Math.cos(c.yaw); }
      const l = Math.hypot(dx, dz);
      c.dash(dx / l, dz / l, 30, 0.22);
      g.audio.play('dash', c.pos);
      g.effects.burst(_c.set(c.pos.x, c.pos.y + 0.4, c.pos.z), 0xd6c7a1, 10, 3, 0.4);
    },
    a2(g, c, aim) { g.combat.throwProjectile(c, 'grenade', aim); },
    ult(g, c) { c.buffs.hog = 7; c.reloadT = 0; c.ammo = c.hero.weapon.mag; },
    bot(g, b, x) {
      const c = b.c;
      if (c.cd.a2 <= 0 && ((x.target && x.dist < 26) || (x.struct && x.structDist < 28))) return 'a2';
      if (c.cd.a1 <= 0 && x.target && x.hpFrac < 0.45) return 'a1';
      if (c.ult >= 100 && ((x.target && x.dist < 45) || x.struct)) return 'ult';
      return null;
    },
  },
  lumberjack: {
    a1(g, c) {
      const f = c.forward(_f);
      g.addStructure('barrier', c.team, c.pos.x + f.x * 2.5, c.pos.z + f.z * 2.5, c.yaw, { life: 8 });
      g.audio.play('build', c.pos);
    },
    a2(g, c) {
      const f = c.forward(_f);
      c.dash(f.x, f.z, 22, 0.5);
      c.chargeT = 0.5; c.chargeHit.clear();
      g.audio.play('dash', c.pos);
    },
    ult(g, c) {
      g.combat.explode(_c.set(c.pos.x, c.pos.y + 0.6, c.pos.z).clone(), 11, 140, c, { structMul: 1.4, knock: 16, color: 0xc08040 });
      let n = 0;
      g.terrain.forTreesNear(c.pos.x, c.pos.z, 14, (t) => {
        if (t.decor) return;
        g.terrain.fell(t, t.x - c.pos.x, t.z - c.pos.z);
        n++;
      });
      if (n) {
        c.team.lumber += n * 15; c.treesChopped += n;
        if (c.isPlayer) g.hud.toast(`+${n * 15} Lumber`, 'lumber');
      }
    },
    bot(g, b, x) {
      const c = b.c;
      if (c.cd.a2 <= 0 && ((x.target && x.dist < 14) || (x.struct && x.structDist < 10))) return 'a2';
      if (c.cd.a1 <= 0 && x.target && g.time - c.lastDamagedT < 0.6 && x.dist > 8) return 'a1';
      if (c.ult >= 100 && (x.enemiesClose >= 1 || (x.struct && x.structDist < 7))) return 'ult';
      return null;
    },
  },
  doc: {
    a1(g, c) {
      for (const o of allies(g, c, 13)) { o.heal(75); g.effects.burst(o.chest(_c), 0x4ade80, 8, 2, 0.7, -2); }
      g.effects.ring(c.pos, 13, 0x4ade80);
      g.audio.play('heal', c.pos);
    },
    a2(g, c) {
      for (const o of allies(g, c, 13)) o.buffs.speed = 4;
      g.effects.ring(c.pos, 13, 0xfacc15);
      g.audio.play('dash', c.pos);
    },
    ult(g, c) {
      for (const o of g.chars) {
        if (o.team !== c.team) continue;
        if (o.alive && d2(o.pos, c.pos) < 30) { o.hp = o.maxHp; o.shield = 100; }
        else if (!o.alive) g.respawnChar(o, c.pos);
      }
      g.effects.ring(c.pos, 30, 0x4ade80, 1);
      g.audio.play('heal', c.pos);
    },
    bot(g, b, x) {
      const c = b.c;
      if (c.cd.a1 <= 0 && (x.hpFrac < 0.6 || x.allyLow)) return 'a1';
      if (c.cd.a2 <= 0 && ((x.target && x.dist > 22) || x.raiding)) return 'a2';
      if (c.ult >= 100 && (x.allyDead || x.hpFrac < 0.3)) return 'ult';
      return null;
    },
  },
  hawk: {
    a1(g, c) {
      const f = c.forward(_f);
      c.vel.y = 15; c.vel.x += f.x * 6; c.vel.z += f.z * 6;
      c.onGround = false;
      g.effects.burst(c.pos, 0xd1d5db, 10, 4, 0.5);
      g.audio.play('dash', c.pos);
    },
    a2(g, c, aim) { g.combat.throwProjectile(c, 'dart', aim); },
    ult(g, c, aim) {
      if (!aim) return false;
      const p = aim.clone();
      const d = d2(p, c.pos);
      if (d > 160) { p.x = c.pos.x + ((p.x - c.pos.x) / d) * 160; p.z = c.pos.z + ((p.z - c.pos.z) / d) * 160; }
      g.combat.airstrike(c, p);
    },
    bot(g, b, x) {
      const c = b.c;
      if (c.cd.a1 <= 0 && x.target && x.hpFrac < 0.5 && Math.random() < 0.3) return 'a1';
      if (c.cd.a2 <= 0 && !x.target && (x.raiding || Math.random() < 0.05)) return 'a2';
      if (c.ult >= 100 && (x.struct || (x.target && x.dist < 120))) return 'ult';
      return null;
    },
  },
  engineer: {
    a1(g, c, aim) {
      let p = aim;
      if (!p || d2(p, c.pos) > 20) { const f = c.forward(_f); p = _c.set(c.pos.x + f.x * 3, 0, c.pos.z + f.z * 3); }
      g.addStructure('miniturret', c.team, p.x, p.z, c.yaw, { life: 20 });
      g.audio.play('build', c.pos);
    },
    a2(g, c) {
      for (const s of g.structures) {
        if (s.alive && s.team === c.team && d2(s.pos, c.pos) < 16) {
          s.hp = Math.min(s.maxHp, s.hp + 250);
          g.effects.burst(s.center(_c), 0xfb923c, 6, 2, 0.6, -2);
        }
      }
      for (const o of allies(g, c, 16)) o.heal(30);
      g.effects.ring(c.pos, 16, 0xfb923c);
      g.audio.play('build', c.pos);
    },
    ult(g, c) { c.team.fortifyT = 10; g.audio.play('build', c.pos); },
    bot(g, b, x) {
      const c = b.c;
      if (c.cd.a1 <= 0 && (x.target || (x.struct && x.structDist < 30))) return 'a1';
      if (c.cd.a2 <= 0 && x.ownDamaged) return 'a2';
      if (c.ult >= 100 && x.hqUnderAttack && x.nearHQ) return 'ult';
      return null;
    },
  },
};
