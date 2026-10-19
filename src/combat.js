import * as THREE from 'three';
import { heightAt, CELL, cellKey } from './terrain.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3();

// Ray vs vertical cylinder; returns t or -1.
function rayCyl(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1, maxT) {
  const fx = ox - cx, fz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
  for (const t of c < 0 ? [0, t2] : [t1, t2]) {
    if (t < 0 || t > maxT) continue;
    const y = oy + dy * t;
    if (y >= y0 && y <= y1) return t;
  }
  return -1;
}

function rayBox(s, ox, oy, oz, dx, dy, dz, maxT) {
  const col = s.collider;
  const [lx, lz] = s.toLocal(ox, oz);
  const ldx = dx * s.cos - dz * s.sin, ldz = dx * s.sin + dz * s.cos;
  const o = [lx, oy - s.pos.y, lz], d = [ldx, dy, ldz];
  const mn = [-col.hw, -0.3, -col.hd], mx = [col.hw, col.h, col.hd];
  let tmin = 0, tmax = maxT;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; continue; }
    let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pending = [];
    this.projGeo = { grenade: new THREE.SphereGeometry(0.16, 8, 6), dart: new THREE.BoxGeometry(0.06, 0.06, 0.5), shell: new THREE.CylinderGeometry(0.15, 0.15, 0.9, 6) };
    this.projMat = { grenade: new THREE.MeshLambertMaterial({ color: 0x2f3a1f }), dart: new THREE.MeshBasicMaterial({ color: 0xfacc15 }), shell: new THREE.MeshLambertMaterial({ color: 0x333333 }) };
  }

  // opts: ignore (char), ignoreStruct, team (own barriers are see-through), noChars
  raycast(origin, dir, maxT, opts = {}) {
    const g = this.game;
    const ox = origin.x, oy = origin.y, oz = origin.z, dx = dir.x, dy = dir.y, dz = dir.z;
    let best = maxT, hit = null;
    if (!opts.noChars) {
      for (const c of g.chars) {
        if (!c.alive || c === opts.ignore) continue;
        const t = rayCyl(ox, oy, oz, dx, dy, dz, c.pos.x, c.pos.z, 0.5, c.pos.y, c.pos.y + 1.95, best);
        if (t >= 0 && t < best) { best = t; hit = { kind: 'char', obj: c, head: oy + dy * t > c.pos.y + 1.55 }; }
      }
    }
    for (const s of g.structures) {
      if (!s.alive || s === opts.ignoreStruct) continue;
      const col = s.collider;
      if (col.kind === 'area' || s.type === 'campfire') continue;
      if (s.type === 'barrier' && opts.team === s.team) continue;
      const t = col.kind === 'box'
        ? rayBox(s, ox, oy, oz, dx, dy, dz, best)
        : rayCyl(ox, oy, oz, dx, dy, dz, s.pos.x, s.pos.z, col.r, s.pos.y - 0.3, s.pos.y + col.h, best);
      if (t >= 0 && t < best) { best = t; hit = { kind: 'struct', obj: s }; }
    }
    const terr = g.terrain;
    const st = ++terr.stamp;
    for (let s = 0; !opts.noTrees && s <= best + CELL; s += CELL * 0.75) {
      const cx = Math.floor((ox + dx * s) / CELL), cz = Math.floor((oz + dz * s) / CELL);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const arr = terr.grid.get(cellKey(cx + i, cz + j));
        if (!arr) continue;
        for (const t of arr) {
          if (!t.alive || t.stamp === st) continue;
          t.stamp = st;
          const tt = rayCyl(ox, oy, oz, dx, dy, dz, t.x, t.z, t.r * 0.9, t.y - 1, terr.treeTop(t), best);
          if (tt >= 0 && tt < best) { best = tt; hit = { kind: 'tree', obj: t }; }
        }
      }
    }
    const tg = terr.rayGround(ox, oy, oz, dx, dy, dz, best);
    if (tg >= 0 && tg < best) { best = tg; hit = { kind: 'ground' }; }
    if (!hit) hit = { kind: null };
    hit.t = best;
    hit.point = new THREE.Vector3(ox + dx * best, oy + dy * best, oz + dz * best);
    return hit;
  }

  canSee(from, target, opts = {}) {
    target.chest(_c);
    _d.subVectors(_c, from);
    const dist = _d.length();
    _d.divideScalar(dist);
    const hit = this.raycast(from, _d, dist + 1, opts);
    return hit.kind === 'char' && hit.obj === target;
  }

  fire(c, aim) {
    const g = this.game, w = c.hero.weapon;
    const m = c.muzzle(new THREE.Vector3());
    const base = _b.subVectors(aim, m).normalize();
    const spread = w.spread * (c.ads ? 0.35 : 1) * (c.onGround ? 1 : 1.6);
    const color = c.isPlayer ? 0xfff3b0 : c.team.isPlayerTeam ? 0x93c5fd : 0xffb4a0;
    for (let p = 0; p < w.pellets; p++) {
      const d = new THREE.Vector3(base.x + (Math.random() - 0.5) * 2 * spread, base.y + (Math.random() - 0.5) * 2 * spread, base.z + (Math.random() - 0.5) * 2 * spread).normalize();
      const hit = this.raycast(m, d, w.range, { ignore: c, team: c.team });
      if (p < 4 || hit.kind) g.effects.tracer(m, hit.point, color);
      if (hit.kind === 'char') {
        const o = hit.obj;
        if (o.team === c.team) continue;
        let dmg = w.dmg * (hit.head ? w.headMul || 1.5 : 1);
        if (w.falloff && hit.t > w.falloff) dmg *= Math.max(0.35, 1 - (hit.t - w.falloff) / (w.range - w.falloff));
        this.damageChar(o, dmg, c, hit.head);
        g.effects.burst(hit.point, 0xb91c1c, 3, 2.5, 0.3);
      } else if (hit.kind === 'struct') {
        if (hit.obj.team !== c.team) hit.obj.damage(w.dmg * 0.6, c);
        g.effects.burst(hit.point, 0xc89b62, 2, 3, 0.3);
      } else if (hit.kind === 'tree') {
        g.effects.burst(hit.point, 0xc89b62, 2, 3, 0.3);
      } else if (hit.kind === 'ground') {
        g.effects.burst(hit.point, 0x8a6a45, 2, 2, 0.3);
      }
    }
    g.audio.play(w.sound, m, c.isPlayer ? 0.8 : 0.7);
  }

  findTurretTarget(s, range) {
    const g = this.game;
    const from = s.gunPos(new THREE.Vector3());
    let best = null, bd = range * range;
    for (const c of g.chars) {
      if (!c.alive || c.team === s.team || c.parachute) continue;
      const d = (c.pos.x - from.x) ** 2 + (c.pos.z - from.z) ** 2;
      if (d >= bd) continue;
      if (!this.canSee(from, c, { ignoreStruct: s, team: s.team })) continue;
      bd = d; best = c;
    }
    return best;
  }

  structureShot(s, target) {
    const g = this.game;
    const from = s.gunPos(new THREE.Vector3());
    target.chest(_c);
    const d = _d.subVectors(_c, from).normalize();
    d.x += (Math.random() - 0.5) * 0.06; d.y += (Math.random() - 0.5) * 0.06; d.z += (Math.random() - 0.5) * 0.06;
    d.normalize();
    const hit = this.raycast(from, d, s.def.range + 5, { ignoreStruct: s, team: s.team });
    g.effects.tracer(from, hit.point, 0xfde68a);
    if (hit.kind === 'char' && hit.obj.team !== s.team) this.damageChar(hit.obj, s.def.dmg, s, false);
    g.audio.play('turret', from, 0.7);
  }

  damageChar(t, amount, attacker, head = false, opts = {}) {
    const g = this.game;
    if (!t.alive || t.parachute) return;
    if (attacker && attacker.team === t.team && attacker !== t) return;
    if (attacker && attacker.isChar && !attacker.isPlayer && !attacker.team.isPlayerTeam && t.team.isPlayerTeam) amount *= attacker.dmgMulVsPlayer;
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, amount);
      t.shield -= absorbed; amount -= absorbed;
    }
    t.hp -= amount;
    t.lastDamagedT = g.time;
    if (attacker) t.lastAttacker = attacker;
    if (attacker && attacker.isChar && attacker !== t) {
      attacker.damageDealt += amount;
      attacker.ult = Math.min(100, attacker.ult + amount * 0.22);
    }
    const killed = t.hp <= 0;
    if (attacker && attacker.isPlayer && !opts.quiet) g.hud.hitmarker(head, killed);
    if (t.isPlayer && !opts.quiet && !opts.storm) g.hud.damageFlash(attacker);
    if (killed) g.onKill(t, attacker, opts);
  }

  explode(pos, r, dmg, attacker, o = {}) {
    const g = this.game;
    for (const c of g.chars) {
      if (!c.alive || c === attacker) continue;
      if (attacker && c.team === attacker.team) continue;
      c.chest(_c);
      const d = _c.distanceTo(pos);
      if (d >= r) continue;
      const f = 1 - (d / r) * 0.65;
      this.damageChar(c, dmg * f, attacker, false);
      const hx = c.pos.x - pos.x, hz = c.pos.z - pos.z, hl = Math.hypot(hx, hz) || 1;
      const k = (o.knock ?? 7) * f;
      c.vel.x += (hx / hl) * k; c.vel.z += (hz / hl) * k; c.vel.y += k * 0.5;
      c.onGround = false;
    }
    for (const s of g.structures) {
      if (!s.alive || (attacker && s.team === attacker.team)) continue;
      const d = s.distanceTo2D(pos.x, pos.z);
      if (d < r && pos.y < s.top + 3) s.damage(dmg * (o.structMul ?? 1.5) * (1 - (d / r) * 0.5), attacker);
    }
    g.effects.explosion(pos, r, o.color);
    g.audio.play('boom', pos);
    const pd = Math.hypot(g.listenerPos.x - pos.x, g.listenerPos.z - pos.z);
    if (pd < r * 4) g.shake(0.35 * (1 - pd / (r * 4)) + 0.1);
  }

  throwProjectile(c, kind, aim) {
    const m = c.muzzle(new THREE.Vector3());
    const dir = aim ? new THREE.Vector3().subVectors(aim, m) : c.forward(new THREE.Vector3());
    const dist = dir.length();
    dir.normalize();
    const vel = dir.multiplyScalar(kind === 'dart' ? 60 : 22);
    if (kind === 'grenade') vel.y += 3 + Math.min(dist, 35) * 0.12;
    this.spawnProjectile(kind, m, vel, c);
  }

  spawnProjectile(kind, pos, vel, owner) {
    const mesh = new THREE.Mesh(this.projGeo[kind], this.projMat[kind]);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    this.game.scene.add(mesh);
    this.projectiles.push({ kind, pos: pos.clone(), vel, owner, team: owner.team, fuse: kind === 'grenade' ? 1.7 : 5, mesh });
  }

  airstrike(c, p) {
    const g = this.game;
    g.effects.ring(new THREE.Vector3(p.x, heightAt(p.x, p.z), p.z), 8, 0xef4444, 2.2, false);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 7;
      this.pending.push({ t: g.time + 1.3 + i * 0.2, x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, owner: c });
    }
  }

  impact(p) {
    const g = this.game;
    if (p.kind === 'grenade') this.explode(p.pos, 6, 85, p.owner, { structMul: 2.2 });
    else if (p.kind === 'shell') this.explode(p.pos, 6.5, 110, p.owner, { structMul: 2.2, knock: 10 });
    else if (p.kind === 'dart') {
      let n = 0;
      for (const c of g.chars) {
        if (c.alive && c.team !== p.team && c.pos.distanceTo(p.pos) < 55) { c.revealedTo[p.team.id] = g.time + 8; n++; }
      }
      g.effects.ring(p.pos, 55, 0xfacc15, 1.2);
      if (p.owner.isPlayer) g.hud.toast(n ? `Recon: ${n} enem${n === 1 ? 'y' : 'ies'} spotted` : 'Recon: area clear', 'info');
    }
  }

  update(dt) {
    const g = this.game;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      if (g.time >= q.t) {
        this.pending.splice(i, 1);
        this.spawnProjectile('shell', new THREE.Vector3(q.x, heightAt(q.x, q.z) + 55, q.z), new THREE.Vector3(0, -70, 0), q.owner);
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.fuse -= dt;
      p.vel.y -= (p.kind === 'shell' ? 0 : p.kind === 'dart' ? 9 : 20) * dt;
      p.pos.addScaledVector(p.vel, dt);
      let boom = p.fuse <= 0;
      if (p.kind !== 'shell') {
        for (const c of g.chars) {
          if (c.alive && c.team !== p.team && c.chest(_a).distanceTo(p.pos) < 0.9) boom = true;
        }
        for (const s of g.structures) {
          if (s.alive && s.blocks && p.pos.y < s.top && s.containsXZ(p.pos.x, p.pos.z, 0.15) && !(s.type === 'barrier' && s.team === p.team)) {
            if (p.kind === 'grenade' && s.team === p.team) { p.vel.x *= -0.4; p.vel.z *= -0.4; } else boom = true;
          }
        }
        g.terrain.forTreesNear(p.pos.x, p.pos.z, 0.2, (t) => {
          if (p.pos.y > g.terrain.treeTop(t)) return;
          if (p.kind === 'dart') boom = true;
          else { const hx = p.pos.x - t.x, hz = p.pos.z - t.z, l = Math.hypot(hx, hz) || 1; p.pos.x = t.x + (hx / l) * (t.r + 0.25); p.pos.z = t.z + (hz / l) * (t.r + 0.25); p.vel.x *= -0.4; p.vel.z *= -0.4; }
        });
      }
      const gy = heightAt(p.pos.x, p.pos.z);
      if (p.pos.y <= gy + 0.1) {
        if (p.kind === 'grenade') {
          p.pos.y = gy + 0.12;
          if (p.vel.y < 0) p.vel.y *= -0.35;
          p.vel.x *= 0.6; p.vel.z *= 0.6;
        } else boom = true;
      }
      p.mesh.position.copy(p.pos);
      if (p.kind === 'dart') p.mesh.lookAt(_a.copy(p.pos).add(p.vel));
      if (boom) {
        if (p.kind !== 'dart' || p.fuse > 0) this.impact(p);
        g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }
}
