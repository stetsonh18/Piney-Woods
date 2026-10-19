import * as THREE from 'three';
import './style.css';
import { HEROES, DIFFICULTY, TEAM_DEFS, BOT_NAMES, STRUCTURES, BUILD_KEYS, HQ_LEVELS, BUILD_RADIUS, START_RES } from './config.js';
import { mulberry32 } from './noise.js';
import { Terrain, heightAt, seedTerrain, HALF } from './terrain.js';
import { Character } from './character.js';
import { Bot } from './bot.js';
import { Structure, buildStructureMesh, footprintPoints, pointInFootprint } from './structures.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Storm } from './storm.js';
import { Hud, fmtTime } from './hud.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { ABILITIES } from './abilities.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _f3 = new THREE.Vector3();
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const prefs = (() => { try { return JSON.parse(localStorage.getItem('pw_prefs') || '{}'); } catch (e) { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('pw_prefs', JSON.stringify(prefs)); } catch (e) { /* private mode */ } };

class Game {
  constructor() {
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    seedTerrain(this.rng);
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.skyColor = new THREE.Color(0xb8d3e0);
    this.stormColor = new THREE.Color(0x6d4a9e);
    this.scene.background = this.skyColor.clone();
    this.scene.fog = new THREE.Fog(this.skyColor.clone(), 70, 300);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    this.scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x4a5a2a, 1.1));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff0d0, 2.2));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 320 });
    sun.shadow.bias = -0.0008;
    this.scene.add(sun, sun.target);

    this.time = 0; this.state = 'menu'; this.paused = false;
    this.chars = []; this.bots = []; this.structures = []; this.teams = [];
    this.player = null; this.storm = null;
    this.listenerPos = new THREE.Vector3();
    this.buildMode = false; this.buildSel = 'wall'; this.buildRot = 0; this.buildReason = ''; this.ghosts = {};
    this.ghostOk = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghostBad = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.45, depthWrite: false });
    this.shakeT = 0; this.menuT = 0;

    this.effects = new Effects(this.scene);
    this.audio = new Sfx(this);
    this.terrain = new Terrain(this, this.rng);
    this.combat = new Combat(this);
    this.input = new Input(r.domElement);
    this.hud = new Hud(this);
    this.clock = new THREE.Clock();

    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      r.setSize(innerWidth, innerHeight);
    });
    this.input.onLockChange = (locked) => {
      if (locked) { this.paused = false; document.getElementById('pause').classList.add('hidden'); }
      else if (this.state === 'drop' || this.state === 'play') { this.paused = true; document.getElementById('pause').classList.remove('hidden'); }
    };
    document.getElementById('pause').addEventListener('click', () => this.input.lock());
    r.domElement.addEventListener('click', () => { if ((this.state === 'drop' || this.state === 'play') && !this.input.locked) this.input.lock(); });
    this.setupMenu();
    r.setAnimationLoop(() => this.frame());
    window.__game = this;
  }

  // ---------- Menu ----------
  setupMenu() {
    let hero = HEROES[prefs.hero] ? prefs.hero : 'ranger';
    let diff = DIFFICULTY[prefs.diff] ? prefs.diff : 'normal';
    const cards = document.getElementById('heroCards'), diffs = document.getElementById('diffBtns');
    const render = () => {
      cards.innerHTML = Object.entries(HEROES).map(([id, h]) => `
        <button class="heroCard ${id === hero ? 'sel' : ''}" data-hero="${id}">
          <div class="hcTop"><b>${h.name}</b><span class="role">${h.role}</span></div>
          <div class="hcBlurb">${h.blurb}</div>
          <div class="hcStats">❤ ${h.hp} · 🔫 ${h.weapon.name}</div>
          <ul><li><kbd>Shift</kbd> ${h.a1.name}</li><li><kbd>E</kbd> ${h.a2.name}</li><li><kbd>Q</kbd> ${h.ult.name}</li></ul>
        </button>`).join('');
      diffs.innerHTML = Object.entries(DIFFICULTY).map(([id, d]) => `<button class="diffBtn ${id === diff ? 'sel' : ''}" data-diff="${id}"><b>${d.label}</b><small>${d.blurb}</small></button>`).join('');
      const h = HEROES[hero];
      document.getElementById('heroDetail').innerHTML = `<b>${h.name}</b> — <kbd>Shift</kbd> ${h.a1.desc} <kbd>E</kbd> ${h.a2.desc} <kbd>Q</kbd> ${h.ult.desc}`;
    };
    cards.addEventListener('click', (e) => { const b = e.target.closest('[data-hero]'); if (b) { hero = b.dataset.hero; render(); } });
    diffs.addEventListener('click', (e) => { const b = e.target.closest('[data-diff]'); if (b) { diff = b.dataset.diff; render(); } });
    document.getElementById('startBtn').addEventListener('click', () => {
      prefs.hero = hero; prefs.diff = diff; savePrefs();
      this.startMatch(hero, diff);
    });
    render();
  }

  // ---------- Match setup ----------
  startMatch(heroId, diffKey) {
    this.audio.init();
    this.diff = DIFFICULTY[diffKey];
    this.storm = new Storm(this, this.rng);
    const rng = this.rng, heroIds = Object.keys(HEROES);
    const names = [...BOT_NAMES].sort(() => rng() - 0.5);
    this.teams = TEAM_DEFS.map((d, i) => ({
      id: i, ...d, isPlayerTeam: i === 0, hq: null, baseCreated: false, members: [],
      lumber: START_RES.lumber, scrap: START_RES.scrap, fortifyT: 0, eliminated: false,
      nextRaid: this.diff.raidStart + rng() * 25, raidTarget: null, raidUntil: 0,
      nextBuild: 8 + rng() * 8, dropPoint: null,
    }));
    // Bot teams pick spread-out drop zones.
    const pts = [];
    for (let i = 1; i < 4; i++) {
      let best = null;
      for (let k = 0; k < 60; k++) {
        const a = rng() * Math.PI * 2, rr = 80 + rng() * 90;
        const p = { x: Math.cos(a) * rr, z: Math.sin(a) * rr };
        const minD = Math.min(Infinity, ...pts.map((q) => Math.hypot(q.x - p.x, q.z - p.z)));
        if (!best || minD > best.minD) best = { ...p, minD };
        if (minD > 120) break;
      }
      pts.push(best);
      this.teams[i].dropPoint = { x: best.x, z: best.z };
    }
    const playerStartA = rng() * Math.PI * 2;
    const ps = { x: Math.cos(playerStartA) * 150, z: Math.sin(playerStartA) * 150 };
    for (const team of this.teams) {
      const used = new Set();
      for (let k = 0; k < 2; k++) {
        const isPlayer = team.isPlayerTeam && k === 0;
        let h = isPlayer ? heroId : heroIds[Math.floor(rng() * heroIds.length)];
        while (!isPlayer && (used.has(h) || (team.isPlayerTeam && h === heroId))) h = heroIds[Math.floor(rng() * heroIds.length)];
        used.add(h);
        const c = new Character(this, team, h, { isPlayer, name: isPlayer ? 'You' : names.pop() });
        team.members.push(c);
        this.chars.push(c);
        const base = team.isPlayerTeam ? ps : team.dropPoint;
        const off = team.isPlayerTeam ? { x: k * 4, z: k * 3 } : { x: (rng() - 0.5) * 50, z: (rng() - 0.5) * 50 };
        c.spawn(base.x + off.x, base.z + off.z, 125 + rng() * 10);
        c.parachute = true;
        c.yaw = Math.atan2(-c.pos.x, -c.pos.z);
        if (isPlayer) this.player = c; else this.bots.push(new Bot(this, c));
      }
    }
    this.state = 'drop';
    document.getElementById('menu').classList.add('hidden');
    this.hud.show();
    this.hud.setupHero(this.player);
    this.input.lock();
    this.hud.bigToast('DROP IN', '#fff', 'Steer with WASD · land anywhere to deploy your base');
  }

  onLanded(c) {
    const team = c.team;
    if (!team.baseCreated) { team.baseCreated = true; this.createBase(team, c.pos.x, c.pos.z); }
    if (c.isPlayer) {
      this.state = 'play';
      this.hud.bigToast('BASE DEPLOYED', '#86efac', 'F: chop pines & open crates · B: build · last base standing wins');
    }
  }

  createBase(team, x, z) {
    for (let iter = 0; iter < 3; iter++) {
      for (const o of this.teams) {
        if (o === team || !o.basePos) continue;
        const dx = x - o.basePos.x, dz = z - o.basePos.z, d = Math.hypot(dx, dz) || 1;
        if (d < 70) { x = o.basePos.x + (dx / d) * 70; z = o.basePos.z + (dz / d) * 70; }
      }
      const lim = HALF - 25;
      x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
    }
    const face = Math.atan2(-x, -z);
    team.basePos = { x, z };
    this.terrain.clearArea(x, z, 10);
    team.hq = this.addStructure('hq', team, x, z, face);
    const at = (a, r) => [x + Math.sin(face + a) * r, z + Math.cos(face + a) * r];
    for (const a of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const [wx, wz] = at(a, 12.5);
      this.terrain.clearArea(wx, wz, 3.6);
      this.addStructure('wall', team, wx, wz, face + a);
    }
    const [tx, tz] = at(Math.PI / 4, 9);
    this.terrain.clearArea(tx, tz, 2);
    this.addStructure('turret', team, tx, tz, face);
    const [fx, fz] = at(Math.PI * 0.75, 8);
    this.terrain.clearArea(fx, fz, 1.5);
    this.addStructure('campfire', team, fx, fz, face);
  }

  addStructure(type, team, x, z, rot, opts) {
    const s = new Structure(this, type, team, x, z, rot, opts);
    this.structures.push(s);
    return s;
  }

  cost(type, builder) {
    const d = STRUCTURES[type], mul = builder && builder.heroId === 'engineer' ? 0.65 : 1;
    return { lumber: Math.ceil(d.lumber * mul), scrap: Math.ceil(d.scrap * mul) };
  }

  upgradeCost(team, builder) {
    const L = HQ_LEVELS[team.hq.level + 1];
    const mul = builder && builder.heroId === 'engineer' ? 0.65 : 1;
    return { lumber: Math.ceil(L.cost.lumber * mul), scrap: Math.ceil(L.cost.scrap * mul) };
  }

  canPlace(type, x, z, rot, team, builder) {
    const c = this.cost(type, builder);
    if (!team.hq || !team.hq.alive) return 'Your HQ is gone — no building';
    if (team.lumber < c.lumber || team.scrap < c.scrap) return 'Not enough resources';
    if (Math.hypot(x - team.hq.pos.x, z - team.hq.pos.z) > BUILD_RADIUS) return `Must be within ${BUILD_RADIUS}m of your HQ`;
    if (Math.abs(x) > HALF - 3 || Math.abs(z) > HALF - 3) return 'Out of bounds';
    const pts = footprintPoints(type, x, z, rot);
    for (const [px, pz] of pts) {
      let blocked = false;
      this.terrain.forTreesNear(px, pz, 0.6, () => { blocked = true; });
      if (blocked) return 'Pines in the way — chop them (F)';
    }
    for (const s of this.structures) {
      if (!s.alive || Math.hypot(s.pos.x - x, s.pos.z - z) > 14) continue;
      if (pts.some(([px, pz]) => s.containsXZ(px, pz, 0.15))) return 'Overlaps a structure';
      if (footprintPoints(s.type, s.pos.x, s.pos.z, s.rot).some(([px, pz]) => pointInFootprint(type, x, z, rot, px, pz, 0.15))) return 'Overlaps a structure';
    }
    if (type !== 'wire') {
      for (const ch of this.chars) if (ch.alive && pointInFootprint(type, x, z, rot, ch.pos.x, ch.pos.z, 0.5)) return 'Someone is standing there';
    }
    return null;
  }

  place(type, team, x, z, rot, builder) {
    const c = this.cost(type, builder);
    team.lumber -= c.lumber; team.scrap -= c.scrap;
    const s = this.addStructure(type, team, x, z, rot, { hpMul: builder && builder.heroId === 'engineer' ? 1.25 : 1 });
    if (builder) builder.built++;
    this.audio.play('build', s.pos);
    this.effects.burst(_v.set(x, s.pos.y + 0.5, z), 0xc89b62, 10, 3, 0.6);
    return s;
  }

  tryUpgradeHQ(team, builder) {
    const hq = team.hq;
    if (!hq || !hq.alive || hq.level >= HQ_LEVELS.length - 1) return false;
    const c = this.upgradeCost(team, builder);
    if (team.lumber < c.lumber || team.scrap < c.scrap) {
      if (builder && builder.isPlayer) { this.hud.toast(`Need 🪵${c.lumber} ⚙️${c.scrap}`, 'bad'); this.audio.play('deny'); }
      return false;
    }
    team.lumber -= c.lumber; team.scrap -= c.scrap;
    hq.upgrade();
    this.audio.play('build', hq.pos);
    this.effects.ring(hq.pos, 12, 0xfacc15, 1);
    if (team.isPlayerTeam) this.hud.bigToast(`HQ UPGRADED ★${hq.level}`, '#fde68a', hq.level === 1 ? 'Roof gun online · faster respawns' : 'Self-repair online');
    return true;
  }

  castAbility(c, slot, aim) {
    if (!c.alive || c.parachute) return false;
    const def = ABILITIES[c.heroId];
    if (slot === 'ult') {
      if (c.ult < 100) return false;
      if (def.ult(this, c, aim) === false) return false;
      c.ult = 0;
      this.audio.play('ult', c.pos);
      const line = c.hero.ult.line;
      if (c.isPlayer) this.hud.bigToast(line, '#fde68a');
      else if (d2(c.pos, this.player.pos) < 60) this.hud.bigToast(`${c.team.isPlayerTeam ? 'Ally' : 'Enemy'} ${c.hero.name}: ${line}`, c.team.css);
      return true;
    }
    if (c.cd[slot] > 0) return false;
    if (def[slot](this, c, aim) === false) return false;
    c.cd[slot] = c.hero[slot].cd;
    return true;
  }

  // ---------- Deaths, respawns, eliminations ----------
  onKill(t, attacker, opts = {}) {
    if (!t.alive) return;
    t.alive = false; t.hp = 0; t.deaths++;
    t.mesh.visible = false;
    this.effects.burst(t.chest(_v), t.team.color, 18, 5, 0.9, 10, 1.4);
    const hq = t.team.hq;
    t.respawnT = hq && hq.alive ? HQ_LEVELS[hq.level].respawn : -1;
    let who;
    if (attacker && attacker !== t) {
      if (attacker.isChar) attacker.kills++;
      attacker.team.scrap += 15;
      who = `<span style="color:${attacker.team.css}">${attacker.name}${attacker.isChar ? '' : ` (${attacker.team.name})`}</span> <i>${attacker.isChar ? attacker.hero.weapon.name : '⚙'}</i>`;
      if (attacker.isPlayer) this.hud.toast(`Eliminated ${t.name}  +15 Scrap`, 'kill');
    } else who = opts.storm ? '<span class="purple">The Storm</span> <i>☁</i>' : '';
    this.hud.addFeed(`${who} <span style="color:${t.team.css}">${t.name}</span>`);
    if (t.isPlayer) {
      this.buildMode = false;
      this.hideGhosts();
    }
  }

  respawnChar(c, near) {
    const team = c.team, hq = team.hq && team.hq.alive ? team.hq : null;
    let x, z;
    if (near) { x = near.x + (Math.random() - 0.5) * 4; z = near.z + (Math.random() - 0.5) * 4; }
    else if (hq) {
      for (let i = 0; i < 8; i++) {
        const lat = (Math.random() - 0.5) * 6;
        x = hq.pos.x + Math.sin(hq.rot) * 7 + Math.cos(hq.rot) * lat;
        z = hq.pos.z + Math.cos(hq.rot) * 7 - Math.sin(hq.rot) * lat;
        if (!this.structures.some((s) => s.alive && s.blocks && s.containsXZ(x, z, 0.6))) break;
      }
    } else return;
    c.spawn(x, z);
    c.yaw = hq ? hq.rot : c.yaw;
    this.effects.ring(c.pos, 3, team.color, 0.6);
  }

  onStructureDestroyed(s, attacker) {
    if (attacker && attacker.team) attacker.team.scrap += s.type === 'hq' ? 60 : 10;
    if (s.type !== 'hq') return;
    const team = s.team;
    const by = attacker ? ` by <span style="color:${attacker.team.css}">${attacker.name}</span>` : '';
    this.hud.addFeed(`<b style="color:${team.css}">${team.name} HQ DESTROYED</b>${by}`);
    if (team.isPlayerTeam) this.hud.bigToast('YOUR HQ IS DOWN', '#f87171', 'No more respawns. Stay alive. Doc\'s ult can still revive.');
    else if (attacker && attacker.team.isPlayerTeam) this.hud.bigToast(`${team.name.toUpperCase()} HQ DESTROYED`, '#86efac', '+60 Scrap');
    for (const c of team.members) if (!c.alive && c.respawnT > 0) c.respawnT = -1;
  }

  checkEliminations() {
    for (const t of this.teams) {
      if (t.eliminated || !t.baseCreated) continue;
      const hqAlive = t.hq && t.hq.alive;
      if (!hqAlive && t.members.every((m) => !m.alive)) {
        t.eliminated = true;
        this.hud.addFeed(`<b style="color:${t.css}">${t.name.toUpperCase()} ELIMINATED</b>`);
        for (const s of this.structures) if (s.alive && s.team === t) s.destroy(null, true);
        if (!t.isPlayerTeam && !this.teams[0].eliminated) this.hud.bigToast(`${t.name} eliminated`, t.css);
      }
    }
    const left = this.teams.filter((t) => !t.eliminated);
    if (this.teams[0].eliminated) this.endMatch(false, left.length + 1);
    else if (left.length === 1) this.endMatch(true, 1);
  }

  endMatch(win, place) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.buildMode = false; this.hideGhosts();
    this.input.unlock();
    const p = this.player;
    const el = document.getElementById('endScreen');
    el.innerHTML = `
      <div class="endInner">
        <h1 class="${win ? 'win' : 'lose'}">${win ? 'PINEY WOODS CHAMPIONS' : 'GOT WHOOPED'}</h1>
        <h2>${win ? 'Last base standing.' : `Your squad placed #${place} of ${this.teams.length}.`}</h2>
        <div class="stats">
          <div><b>${p.kills}</b><span>Eliminations</span></div>
          <div><b>${p.deaths}</b><span>Deaths</span></div>
          <div><b>${Math.round(p.damageDealt)}</b><span>Damage</span></div>
          <div><b>${p.treesChopped}</b><span>Pines felled</span></div>
          <div><b>${p.built}</b><span>Structures built</span></div>
          <div><b>${fmtTime(this.time)}</b><span>Match time</span></div>
        </div>
        <p class="quip">${win ? 'That one was earned.' : 'Losing to a good team is how you get good. Run it back.'}</p>
        <button id="againBtn">RUN IT BACK</button>
      </div>`;
    el.classList.remove('hidden');
    document.getElementById('againBtn').onclick = () => location.reload();
  }

  // ---------- Per-frame ----------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.state === 'menu') this.menuCamera(dt);
    else if (this.state === 'over') { this.effects.update(dt); this.orbitCamera(dt, this.player.pos); }
    else if (!this.paused) this.update(dt);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    this.time += dt;
    this.updatePlayer(dt);
    for (const b of this.bots) b.update(dt);
    for (const c of this.chars) c.update(dt);
    for (const s of this.structures) if (s.alive) s.update(dt);
    this.structures = this.structures.filter((s) => s.alive);
    this.combat.update(dt);
    this.terrain.update(dt);
    this.effects.update(dt);
    if (this.state === 'play') this.storm.update(dt);
    this.updateTeams(dt);
    this.updateCamera(dt);
    this.listenerPos.copy(this.player.pos);
    this.hud.update(dt);
    this.checkEliminations();
  }

  updateTeams(dt) {
    const storm = this.storm, playing = this.state === 'play';
    for (const c of this.chars) {
      if (c.alive && !c.parachute && playing && storm.outside(c.pos.x, c.pos.z)) this.combat.damageChar(c, storm.dps * dt, null, false, { storm: true, quiet: true });
      if (!c.alive && c.respawnT > 0) {
        c.respawnT -= dt;
        if (c.respawnT <= 0) { if (c.team.hq && c.team.hq.alive) this.respawnChar(c); else c.respawnT = -1; }
      }
    }
    if (playing) {
      for (const s of this.structures) if (s.alive && storm.outside(s.pos.x, s.pos.z)) s.damage(storm.dps * 0.8 * dt, null, { storm: true });
    }
    for (const t of this.teams) {
      if (t.eliminated) continue;
      t.fortifyT = Math.max(0, t.fortifyT - dt);
      const mul = t.isPlayerTeam ? 1 : this.diff.income;
      if (t.hq && t.hq.alive) { t.lumber += 0.25 * mul * dt; t.scrap += 0.12 * mul * dt; }
      if (t.isPlayerTeam || !playing) continue;
      this.teamAI(t);
    }
  }

  teamAI(t) {
    const rng = this.rng;
    // Raids: periodically send the squad at someone's base.
    if (t.raidTarget && (this.time > t.raidUntil || t.raidTarget.eliminated)) { t.raidTarget = null; t.nextRaid = this.time + this.diff.raidEvery * (0.8 + rng() * 0.4); }
    const noHQ = !(t.hq && t.hq.alive);
    if (!t.raidTarget && (this.time >= t.nextRaid || noHQ)) {
      const others = this.teams.filter((o) => o !== t && !o.eliminated && o.baseCreated);
      if (others.length) {
        const me = t.hq && t.hq.alive ? t.hq.pos : t.members.find((m) => m.alive)?.pos || { x: 0, z: 0 };
        others.sort((a, b) => this.teamDist(me, a) - this.teamDist(me, b));
        const pt = this.teams[0];
        t.raidTarget = !pt.eliminated && rng() < this.diff.focusPlayer ? pt : others[0];
        t.raidUntil = this.time + (noHQ ? 40 : 80);
        if (t.raidTarget.isPlayerTeam && !noHQ) this.hud.toast(`⚠ ${t.name} are coming for your base`, 'bad');
      }
    }
    // Auto-build around HQ.
    if (!noHQ && this.time >= t.nextBuild) {
      t.nextBuild = this.time + this.diff.buildEvery * (0.7 + rng() * 0.6);
      const builder = t.members.find((m) => m.alive) || null;
      if (t.hq.level < 2 && this.time > 120 && rng() < 0.5 && this.tryUpgradeHQ(t, builder)) return;
      const count = (type) => this.structures.filter((s) => s.alive && s.team === t && s.type === type).length;
      let type = 'wall';
      if (count('turret') < 2 + (this.diff === DIFFICULTY.hard ? 2 : 0) && t.scrap >= 25 && rng() < 0.6) type = 'turret';
      else if (count('campfire') < 1) type = 'campfire';
      else if (count('wire') < 3 && rng() < 0.3) type = 'wire';
      else if (count('wall') > 12) type = t.scrap >= 25 ? 'turret' : 'wire';
      for (let i = 0; i < 12; i++) {
        const a = rng() * Math.PI * 2, r = 8 + rng() * 14;
        const x = t.hq.pos.x + Math.sin(a) * r, z = t.hq.pos.z + Math.cos(a) * r;
        const rot = a + (type === 'wall' || type === 'wire' ? 0 : rng());
        if (!this.canPlace(type, x, z, rot, t, builder)) { this.place(type, t, x, z, rot, builder); break; }
      }
    }
  }

  teamDist(p, team) {
    const q = team.hq && team.hq.alive ? team.hq.pos : team.members.find((m) => m.alive)?.pos;
    return q ? Math.hypot(p.x - q.x, p.z - q.z) : Infinity;
  }

  // ---------- Player ----------
  aimRay() {
    const cam = this.camera, p = this.player;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const head = p.eye(_w);
    const t0 = Math.max(0, _v.subVectors(head, cam.position).dot(dir));
    const origin = cam.position.clone().addScaledVector(dir, t0);
    return this.combat.raycast(origin, dir, 260, { ignore: p, team: p.team });
  }

  updatePlayer(dt) {
    const p = this.player, inp = this.input;
    const zoom = p.ads ? p.hero.weapon.zoom : 1;
    const sens = 0.0022 / zoom;
    p.yaw -= inp.dx * sens;
    p.pitch = Math.max(-1.3, Math.min(1.2, p.pitch - inp.dy * sens));
    // Arrow keys / keyboard-only look as a fallback when pointer lock is unavailable.
    if (inp.down('ArrowLeft')) p.yaw += 2.2 * dt;
    if (inp.down('ArrowRight')) p.yaw -= 2.2 * dt;
    if (inp.down('ArrowUp')) p.pitch = Math.min(1.2, p.pitch + 1.5 * dt);
    if (inp.down('ArrowDown')) p.pitch = Math.max(-1.3, p.pitch - 1.5 * dt);
    if (!p.alive) { p.ads = false; return; }
    const fwd = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    const str = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    p.wish.set(fwd * s - str * c, 0, fwd * c + str * s);
    if (p.wish.lengthSq() > 1) p.wish.normalize();
    p.wantJump = inp.down('Space');
    if (p.parachute) return;
    if (inp.pressed('KeyB')) {
      this.buildMode = !this.buildMode;
      if (!this.buildMode) this.hideGhosts();
      this.buildRot = 0;
    }
    if (this.buildMode && inp.pressed('Escape')) { this.buildMode = false; this.hideGhosts(); }
    if (inp.pressed('KeyF')) p.melee();
    if (this.buildMode) { p.ads = false; this.updateBuild(); return; }
    p.ads = inp.rmb;
    const hit = this.aimRay();
    this.aimPoint = hit.point;
    if (inp.lmb) p.tryFire(hit.point);
    if (inp.pressed('KeyR')) p.startReload();
    if (inp.pressed('ShiftLeft') || inp.pressed('ShiftRight')) this.castAbility(p, 'a1', hit.point);
    if (inp.pressed('KeyE')) this.castAbility(p, 'a2', hit.point);
    if (inp.pressed('KeyQ')) this.castAbility(p, 'ult', hit.kind ? hit.point : null);
  }

  getGhost(type) {
    if (!this.ghosts[type]) {
      const { group } = buildStructureMesh(type, 0xffffff);
      group.traverse((o) => { if (o.isMesh) { o.material = this.ghostOk; o.castShadow = false; } });
      this.scene.add(group);
      this.ghosts[type] = group;
    }
    return this.ghosts[type];
  }

  hideGhosts() { for (const k in this.ghosts) this.ghosts[k].visible = false; }

  updateBuild() {
    const p = this.player, inp = this.input;
    BUILD_KEYS.forEach((k, i) => { if (inp.pressed('Digit' + (i + 1))) this.buildSel = k; });
    if (inp.pressed('Digit5')) this.tryUpgradeHQ(p.team, p);
    if (inp.pressed('KeyR')) this.buildRot += Math.PI / 4;
    if (inp.wheel) this.buildRot += inp.wheel * (Math.PI / 12);
    const hit = this.aimRay();
    const pt = hit.point.clone();
    const d = d2(pt, p.pos);
    if (d > 20 || !hit.kind) {
      const k = Math.min(20, d) / (d || 1);
      pt.set(p.pos.x + (pt.x - p.pos.x) * k, 0, p.pos.z + (pt.z - p.pos.z) * k);
    }
    const rot = p.yaw + this.buildRot;
    this.hideGhosts();
    const ghost = this.getGhost(this.buildSel);
    ghost.visible = true;
    ghost.position.set(pt.x, heightAt(pt.x, pt.z), pt.z);
    ghost.rotation.y = rot;
    this.buildReason = this.canPlace(this.buildSel, pt.x, pt.z, rot, p.team, p) || '';
    const mat = this.buildReason ? this.ghostBad : this.ghostOk;
    ghost.traverse((o) => { if (o.isMesh) o.material = mat; });
    if (inp.lmbPressed) {
      if (this.buildReason) { this.audio.play('deny'); this.hud.toast(this.buildReason, 'bad'); }
      else this.place(this.buildSel, p.team, pt.x, pt.z, rot, p);
    }
  }

  // ---------- Camera ----------
  shake(amt) { this.shakeT = Math.max(this.shakeT, amt); }

  updateCamera(dt) {
    const p = this.player, cam = this.camera;
    let focus = p;
    const deathEl = document.getElementById('deathScreen');
    if (!p.alive) {
      const ally = p.team.members.find((m) => m.alive);
      if (p.respawnT < 0 && ally) focus = ally;
      deathEl.classList.remove('hidden');
      deathEl.innerHTML = p.respawnT > 0
        ? `<h2>YOU WERE ELIMINATED</h2><p>Respawning at HQ in <b>${Math.ceil(p.respawnT)}</b></p>`
        : `<h2>NO HQ — NO RESPAWN</h2><p>${ally ? `Spectating ${ally.name}. If they're a Doc, pray for that ult.` : 'Squad wiped.'}</p>`;
      if (focus === p) { this.orbitCamera(dt, p.pos); return; }
    } else deathEl.classList.add('hidden');
    const yaw = focus === p ? p.yaw : focus.yaw, pitch = focus === p ? p.pitch : -0.15;
    const fwd = _f3.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const right = _w.set(-Math.cos(yaw), 0, Math.sin(yaw));
    const head = new THREE.Vector3(focus.pos.x, focus.pos.y + 1.75, focus.pos.z);
    const dropping = focus.parachute;
    const dist = dropping ? 10 : focus === p && p.ads ? 2.3 : 4.3;
    const shoulder = dropping ? 0 : focus === p && p.ads ? 0.65 : 0.8;
    const desired = head.clone().addScaledVector(fwd, -dist).addScaledVector(right, shoulder);
    desired.y += 0.3;
    // Pull the camera in front of walls and trunks.
    const back = desired.clone().sub(head);
    const bl = back.length();
    back.divideScalar(bl);
    const hit = this.combat.raycast(head, back, bl, { noChars: true, noTrees: true, team: p.team });
    if (hit.kind) desired.copy(head).addScaledVector(back, Math.max(0.6, hit.t - 0.3));
    focus.mesh.visible = focus.alive && desired.distanceTo(head) > 1.4;
    desired.y = Math.max(desired.y, heightAt(desired.x, desired.z) + 0.4);
    cam.position.copy(desired);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const a = this.shakeT * 0.6;
      cam.position.x += (Math.random() - 0.5) * a; cam.position.y += (Math.random() - 0.5) * a; cam.position.z += (Math.random() - 0.5) * a;
    }
    cam.lookAt(desired.clone().addScaledVector(fwd, 20));
    const fov = 75 / (focus === p && p.ads ? p.hero.weapon.zoom : 1);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 14); cam.updateProjectionMatrix(); }
    this.sun.position.set(focus.pos.x + 60, focus.pos.y + 110, focus.pos.z + 35);
    this.sun.target.position.copy(focus.pos);
    // Tint the world purple while standing in the storm.
    const inStorm = this.storm && focus.alive && this.state === 'play' && this.storm.outside(focus.pos.x, focus.pos.z);
    const target = inStorm ? this.stormColor : this.skyColor;
    this.scene.background.lerp(target, Math.min(1, dt * 3));
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.far += ((inStorm ? 120 : 300) - this.scene.fog.far) * Math.min(1, dt * 3);
  }

  orbitCamera(dt, center) {
    this.menuT += dt * 0.12;
    const cam = this.camera;
    cam.position.set(center.x + Math.cos(this.menuT) * 30, center.y + 18, center.z + Math.sin(this.menuT) * 30);
    cam.lookAt(center.x, center.y + 2, center.z);
  }

  menuCamera(dt) {
    this.menuT += dt * 0.04;
    const cam = this.camera, r = 110;
    const x = Math.cos(this.menuT) * r, z = Math.sin(this.menuT) * r;
    cam.position.set(x, heightAt(x, z) + 34, z);
    cam.lookAt(0, heightAt(0, 0) + 6, 0);
    this.sun.position.set(60, 120, 35);
    this.sun.target.position.set(0, 0, 0);
  }
}

new Game();
