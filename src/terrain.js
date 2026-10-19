import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm } from './noise.js';

export const HALF = 210; // playable half-size in meters
export const CELL = 8;
const TRUNK_H = 11;

let ox = 0, oz = 0;
export function seedTerrain(rng) { ox = rng() * 2000 - 1000; oz = rng() * 2000 - 1000; }

export function heightAt(x, z) {
  const nx = x + ox, nz = z + oz;
  return fbm(nx * 0.0055, nz * 0.0055, 4) * 18 + fbm(nx * 0.03 + 7, nz * 0.03 - 3, 2) * 2;
}

// Two red-clay county roads snake across the map.
export function isRoad(x, z) {
  return Math.abs(z - (38 * Math.sin(x * 0.012) + 15)) < 3.6 || Math.abs(x - (30 * Math.sin(z * 0.017) - 45)) < 3.6;
}

export const cellKey = (cx, cz) => (cx + 64) * 256 + (cz + 64);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class Terrain {
  constructor(game, rng) {
    this.game = game; this.rng = rng;
    this.grid = new Map(); this.trees = []; this.crates = []; this.falling = []; this.stamp = 0;
    this.buildGround();
    this.buildTrees();
    this.buildCrates();
  }

  buildGround() {
    const size = HALF * 2 + 90, seg = 170;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x5b7431), grass2 = new THREE.Color(0x3f5a26);
    const needles = new THREE.Color(0x7d6038), clay = new THREE.Color(0xa4522c), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      const n = fbm(x * 0.04 + 50, z * 0.04, 3) * 0.5 + 0.5;
      c.copy(grass).lerp(grass2, n);
      const nd = fbm(x * 0.02 - 20, z * 0.02 + 40, 2);
      if (nd > 0.1) c.lerp(needles, Math.min(1, (nd - 0.1) * 3) * 0.75);
      if (isRoad(x, z)) c.copy(clay).offsetHSL(0, 0, (n - 0.5) * 0.08);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.ground.receiveShadow = true;
    this.game.scene.add(this.ground);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2f4320 }));
    skirt.position.y = -10;
    this.game.scene.add(skirt);
  }

  buildTrees() {
    const rng = this.rng;
    const trunk = new THREE.CylinderGeometry(0.22, 0.42, TRUNK_H, 6); trunk.translate(0, TRUNK_H / 2, 0);
    const f1 = new THREE.ConeGeometry(2.3, 4.5, 7); f1.translate(0, 8.2, 0);
    const f2 = new THREE.ConeGeometry(1.7, 3.8, 7); f2.translate(0, 10.6, 0);
    const f3 = new THREE.ConeGeometry(1.0, 2.6, 7); f3.translate(0, 12.6, 0);
    this.trunkGeo = trunk;
    this.foliageGeo = mergeGeometries([f1, f2, f3]);
    this.trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3d24 });
    this.foliageMat = new THREE.MeshLambertMaterial({ color: 0x2e5527, flatShading: true });

    const tryAdd = (x, z, decor) => {
      if (!decor && isRoad(x, z)) return;
      const s = 0.8 + rng() * 0.5;
      const r = 0.42 * s;
      let ok = true;
      this.forTreesNear(x, z, 3.0, () => { ok = false; }, true);
      if (!ok) return;
      const t = { x, z, y: heightAt(x, z) - 0.3, s, hs: 0.85 + rng() * 0.35, rot: rng() * Math.PI * 2, r, alive: true, hp: 3, regrow: 0, decor, blocked: false, stamp: 0, grow: 1, i: this.trees.length };
      this.trees.push(t);
      const k = cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
      let arr = this.grid.get(k); if (!arr) this.grid.set(k, (arr = []));
      arr.push(t);
    };
    for (let i = 0; i < 6000 && this.trees.length < 950; i++) {
      const x = (rng() * 2 - 1) * (HALF - 4), z = (rng() * 2 - 1) * (HALF - 4);
      const d = fbm(x * 0.018 + 11, z * 0.018 - 5, 3);
      if (rng() < 0.22 + d * 1.1) tryAdd(x, z, false);
    }
    // Dense decorative tree line just outside the playable area.
    for (let i = 0; i < 1400; i++) {
      const side = Math.floor(rng() * 4), a = (rng() * 2 - 1) * (HALF + 40), b = HALF + 3 + rng() * 38;
      const [x, z] = side === 0 ? [a, b] : side === 1 ? [a, -b] : side === 2 ? [b, a] : [-b, a];
      tryAdd(x, z, true);
    }
    const n = this.trees.length;
    this.trunks = new THREE.InstancedMesh(this.trunkGeo, this.trunkMat, n);
    this.foliage = new THREE.InstancedMesh(this.foliageGeo, this.foliageMat, n);
    this.trunks.castShadow = this.foliage.castShadow = true;
    this.trunks.receiveShadow = true;
    for (const t of this.trees) this.setTreeMatrix(t, 1);
    this.trunks.computeBoundingSphere(); this.foliage.computeBoundingSphere();
    this.game.scene.add(this.trunks, this.foliage);
  }

  setTreeMatrix(t, scale) {
    _p.set(t.x, t.y, t.z);
    _q.setFromAxisAngle(_up, t.rot);
    _s.set(t.s * scale, t.s * t.hs * scale, t.s * scale);
    _m.compose(_p, _q, _s);
    this.trunks.setMatrixAt(t.i, _m);
    this.foliage.setMatrixAt(t.i, _m);
    this.trunks.instanceMatrix.needsUpdate = true;
    this.foliage.instanceMatrix.needsUpdate = true;
  }

  treeTop(t) { return t.y + TRUNK_H * t.s * t.hs; }

  forTreesNear(x, z, r, fn, includeDead = false) {
    const c0x = Math.floor((x - r - 1) / CELL), c1x = Math.floor((x + r + 1) / CELL);
    const c0z = Math.floor((z - r - 1) / CELL), c1z = Math.floor((z + r + 1) / CELL);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const arr = this.grid.get(cellKey(cx, cz));
      if (!arr) continue;
      for (const t of arr) {
        if (!includeDead && !t.alive) continue;
        const dx = t.x - x, dz = t.z - z, rr = r + t.r;
        if (dx * dx + dz * dz <= rr * rr) fn(t);
      }
    }
  }

  nearestTree(x, z, maxR, filter) {
    let best = null, bd = Infinity;
    this.forTreesNear(x, z, maxR, (t) => {
      if (filter && !filter(t)) return;
      const d = (t.x - x) ** 2 + (t.z - z) ** 2;
      if (d < bd) { bd = d; best = t; }
    });
    return best;
  }

  // Returns true when the tree is felled.
  chop(t, power, dir) {
    if (!t.alive || t.decor) return false;
    t.hp -= power;
    this.game.effects.burst(new THREE.Vector3(t.x, t.y + 1.2, t.z), 0xc89b62, 6, 3, 0.4);
    if (t.hp <= 0) { this.fell(t, dir ? dir.x : 1, dir ? dir.z : 0); return true; }
    return false;
  }

  fell(t, dx, dz) {
    if (!t.alive) return;
    t.alive = false; t.hp = 3; t.regrow = t.decor || t.blocked ? 0 : 110 + this.rng() * 40;
    this.setTreeMatrix(t, 0);
    const pivot = new THREE.Group();
    pivot.position.set(t.x, t.y, t.z);
    pivot.rotation.y = Math.atan2(dx, dz);
    const inner = new THREE.Group();
    const a = new THREE.Mesh(this.trunkGeo, this.trunkMat), b = new THREE.Mesh(this.foliageGeo, this.foliageMat);
    inner.add(a, b);
    inner.scale.set(t.s, t.s * t.hs, t.s);
    a.castShadow = b.castShadow = true;
    pivot.add(inner);
    this.game.scene.add(pivot);
    this.falling.push({ pivot, inner, age: 0 });
    this.game.audio.play('fell', pivot.position);
  }

  clearArea(x, z, r) {
    this.forTreesNear(x, z, r, (t) => {
      t.alive = false; t.blocked = true; t.regrow = 0;
      this.setTreeMatrix(t, 0);
    });
  }

  buildCrates() {
    const geo = new THREE.BoxGeometry(1.3, 0.8, 0.9);
    const mat = new THREE.MeshLambertMaterial({ color: 0x55652f });
    const band = new THREE.MeshLambertMaterial({ color: 0xd4b13c });
    const bandGeo = new THREE.BoxGeometry(1.34, 0.14, 0.94);
    for (let i = 0; i < 260 && this.crates.length < 34; i++) {
      const x = (this.rng() * 2 - 1) * (HALF - 10), z = (this.rng() * 2 - 1) * (HALF - 10);
      let blocked = false;
      this.forTreesNear(x, z, 2.5, () => { blocked = true; });
      if (blocked) continue;
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, mat); m.castShadow = true;
      const bnd = new THREE.Mesh(bandGeo, band);
      g.add(m, bnd);
      g.position.set(x, heightAt(x, z) + 0.4, z);
      g.rotation.y = this.rng() * Math.PI;
      this.game.scene.add(g);
      this.crates.push({ x, z, mesh: g, active: true, timer: 0 });
    }
  }

  nearestCrate(x, z, r) {
    let best = null, bd = r * r;
    for (const c of this.crates) {
      if (!c.active) continue;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  openCrate(c) { c.active = false; c.mesh.visible = false; c.timer = 90; }

  // Ray-march the heightfield. Returns hit distance or -1.
  rayGround(ox_, oy, oz_, dx, dy, dz, maxT) {
    let prev = 0;
    const step = 1.5;
    for (let t = step; ; t += step) {
      const tt = Math.min(t, maxT);
      if (oy + dy * tt < heightAt(ox_ + dx * tt, oz_ + dz * tt)) {
        let a = prev, b = tt;
        for (let i = 0; i < 7; i++) {
          const m = (a + b) / 2;
          if (oy + dy * m < heightAt(ox_ + dx * m, oz_ + dz * m)) b = m; else a = m;
        }
        return b;
      }
      prev = tt;
      if (tt >= maxT) return -1;
    }
  }

  update(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.age += dt;
      f.inner.rotation.x = (Math.PI / 2) * Math.min(1, (f.age / 1.3) ** 2);
      if (f.age > 2.6) f.pivot.position.y -= dt * 3;
      if (f.age > 4.2) { this.game.scene.remove(f.pivot); this.falling.splice(i, 1); }
    }
    for (const t of this.trees) {
      if (!t.alive && t.regrow > 0) {
        t.regrow -= dt;
        if (t.regrow <= 0) {
          let clear = true;
          for (const c of this.game.chars) if (c.alive && (c.pos.x - t.x) ** 2 + (c.pos.z - t.z) ** 2 < 4) clear = false;
          for (const s of this.game.structures) if (s.alive && s.containsXZ(t.x, t.z, 1)) { clear = false; t.blocked = true; }
          if (clear) { t.alive = true; t.grow = 0.15; } else if (!t.blocked) t.regrow = 5;
        }
      } else if (t.alive && t.grow < 1) {
        t.grow = Math.min(1, t.grow + dt / 3);
        this.setTreeMatrix(t, t.grow);
      }
    }
    for (const c of this.crates) {
      if (!c.active && (c.timer -= dt) <= 0) { c.active = true; c.mesh.visible = true; }
    }
  }
}
