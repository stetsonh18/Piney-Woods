import * as THREE from 'three';
import { STRUCTURES, BUILD_KEYS, HQ_LEVELS } from './config.js';
import { HALF, isRoad } from './terrain.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const fmtTime = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export class Hud {
  constructor(game) {
    this.g = game;
    this.root = $('hud');
    this.labelsEl = $('labels');
    this.labels = []; this.li = 0;
    this.feed = [];
    this.slowT = 0;
    this.toastT = 0; this.bigT = 0; this.hitT = 0; this.dmgT = 0;
    this.mm = $('minimap'); this.mmx = this.mm.getContext('2d');
    this.mmBg = null;
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setupHero(p) {
    const h = p.hero;
    $('heroName').innerHTML = `<b>${p.name}</b> <span>${h.role}</span>`;
    $('abilities').innerHTML = [
      ['a1', 'SHIFT', h.a1.name],
      ['a2', 'E', h.a2.name],
      ['ult', 'Q', h.ult.name],
    ].map(([k, key, name]) => `<div class="ab ${k === 'ult' ? 'ult' : ''}" id="ab_${k}"><div class="abFill"></div><div class="abKey">${key}</div><div class="abName">${name}</div><div class="abCd"></div></div>`).join('');
  }

  buildMinimapBg() {
    const c = document.createElement('canvas');
    c.width = c.height = 200;
    const x = c.getContext('2d');
    x.fillStyle = '#3f5a26'; x.fillRect(0, 0, 200, 200);
    x.fillStyle = '#a4522c';
    for (let i = 0; i < 200; i += 2) for (let j = 0; j < 200; j += 2) {
      const wx = (i / 200) * 2 * HALF - HALF, wz = (j / 200) * 2 * HALF - HALF;
      if (isRoad(wx, wz)) x.fillRect(i, j, 2, 2);
    }
    x.fillStyle = 'rgba(20,40,15,0.7)';
    for (const t of this.g.terrain.trees) {
      if (t.decor) continue;
      const [px, py] = this.toMap(t.x, t.z);
      x.fillRect(px - 1, py - 1, 2, 2);
    }
    this.mmBg = c;
  }

  toMap(x, z) { return [((x + HALF) / (2 * HALF)) * 200, ((z + HALF) / (2 * HALF)) * 200]; }

  toast(text, cls = '') {
    const el = $('toast');
    const d = document.createElement('div');
    d.className = 'toastItem ' + cls;
    d.textContent = text;
    el.appendChild(d);
    setTimeout(() => d.remove(), 1800);
    while (el.children.length > 4) el.firstChild.remove();
  }

  bigToast(text, color = '#fff', sub = '') {
    const el = $('bigToast');
    el.innerHTML = `<div style="color:${color}">${text}</div>${sub ? `<small>${sub}</small>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    this.bigT = 3;
  }

  hitmarker(head, kill) {
    const el = $('hitmarker');
    el.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    this.hitT = kill ? 0.35 : 0.12;
    this.g.audio.play(kill ? 'kill' : head ? 'head' : 'hit');
  }

  damageFlash() {
    this.dmgT = 0.35;
    this.g.audio.play('hurt');
  }

  addFeed(html) {
    const el = document.createElement('div');
    el.className = 'feedItem';
    el.innerHTML = html;
    $('killfeed').prepend(el);
    setTimeout(() => el.remove(), 7000);
    while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
  }

  label(pos, text, frac, color, extra = 0) {
    const cam = this.g.camera;
    _v.copy(pos).project(cam);
    if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) return;
    let l = this.labels[this.li];
    if (!l) {
      const el = document.createElement('div');
      el.className = 'label';
      el.innerHTML = '<div class="lname"></div><div class="lbar"><div class="lfill"></div><div class="lshield"></div></div>';
      this.labelsEl.appendChild(el);
      l = { el, name: el.firstChild, fill: el.querySelector('.lfill'), shield: el.querySelector('.lshield'), text: '' };
      this.labels.push(l);
    }
    this.li++;
    l.el.style.display = 'block';
    l.el.style.transform = `translate(${((_v.x + 1) / 2) * innerWidth}px, ${((1 - _v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    if (l.text !== text) { l.name.textContent = text; l.text = text; }
    l.name.style.color = color;
    l.fill.style.width = `${Math.max(0, frac) * 100}%`;
    l.fill.style.background = color;
    l.shield.style.width = `${Math.min(1, extra) * 100}%`;
  }

  updateLabels() {
    const g = this.g, p = g.player;
    this.li = 0;
    for (const c of g.chars) {
      if (!c.alive || c === p) continue;
      const d = c.pos.distanceTo(g.camera.position);
      const ally = c.team === p.team;
      const revealed = (c.revealedTo[p.team.id] || 0) > g.time;
      const hurtByMe = c.lastAttacker === p && g.time - c.lastDamagedT < 3;
      if (!ally && !(d < 40 || revealed || hurtByMe)) continue;
      if (d > 160) continue;
      this.label(_v.set(c.pos.x, c.pos.y + 2.6, c.pos.z).clone(), `${c.name} · ${c.hero.name}`, c.hpFrac, c.team.css, c.shield / c.maxHp);
    }
    for (const s of g.structures) {
      if (!s.alive) continue;
      const d = s.pos.distanceTo(g.camera.position);
      const isHQ = s.type === 'hq';
      if (!((isHQ && d < 110) || (g.time - s.lastHitT < 4 && d < 70) || (s.team === p.team && s.hp < s.maxHp * 0.99 && d < 30))) continue;
      this.label(_v.set(s.pos.x, s.top + 1.2, s.pos.z).clone(), isHQ ? `${s.team.name} HQ${s.level ? ' ★'.repeat(s.level) : ''}` : s.name, s.hp / s.maxHp, s.team.css);
    }
    for (let i = this.li; i < this.labels.length; i++) this.labels[i].el.style.display = 'none';
  }

  drawMinimap() {
    const g = this.g, x = this.mmx, p = g.player;
    if (!this.mmBg) this.buildMinimapBg();
    x.drawImage(this.mmBg, 0, 0);
    const s = g.storm, scale = 200 / (2 * HALF);
    if (s) {
      const [cx, cy] = this.toMap(s.center.x, s.center.y);
      x.save();
      x.fillStyle = 'rgba(124,58,237,0.38)';
      x.beginPath(); x.rect(0, 0, 200, 200); x.arc(cx, cy, Math.max(0, s.radius * scale), 0, Math.PI * 2, true); x.fill();
      x.restore();
      if (s.next) {
        const [nx, ny] = this.toMap(s.next.c.x, s.next.c.y);
        x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1; x.setLineDash([3, 3]);
        x.beginPath(); x.arc(nx, ny, s.next.r * scale, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
      }
    }
    for (const t of g.teams) {
      if (t.hq && t.hq.alive) {
        const [hx, hy] = this.toMap(t.hq.pos.x, t.hq.pos.z);
        x.fillStyle = t.css; x.strokeStyle = '#000'; x.lineWidth = 1.5;
        x.fillRect(hx - 5, hy - 5, 10, 10); x.strokeRect(hx - 5, hy - 5, 10, 10);
      } else if (g.state === 'drop' && t.dropPoint && !t.isPlayerTeam) {
        const [hx, hy] = this.toMap(t.dropPoint.x, t.dropPoint.z);
        x.strokeStyle = t.css; x.lineWidth = 2;
        x.beginPath(); x.arc(hx, hy, 6, 0, Math.PI * 2); x.stroke();
      }
    }
    for (const c of g.chars) {
      if (!c.alive || c === p) continue;
      const ally = c.team === p.team;
      const seen = ally || (c.revealedTo[p.team.id] || 0) > g.time || c.pos.distanceTo(p.pos) < 40 || (g.time - c.lastFireT < 1.5 && c.pos.distanceTo(p.pos) < 110);
      if (!seen) continue;
      const [cx, cy] = this.toMap(c.pos.x, c.pos.z);
      x.fillStyle = c.team.css; x.strokeStyle = '#000';
      x.beginPath(); x.arc(cx, cy, 3.5, 0, Math.PI * 2); x.fill(); x.stroke();
    }
    if (p) {
      const [px, py] = this.toMap(p.pos.x, p.pos.z);
      x.save(); x.translate(px, py); x.rotate(-p.yaw + Math.PI);
      x.fillStyle = '#fff'; x.strokeStyle = '#000';
      x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 5); x.lineTo(0, 2); x.lineTo(-5, 5); x.closePath(); x.fill(); x.stroke();
      x.restore();
    }
  }

  updateBuildPanel() {
    const g = this.g, p = g.player, el = $('buildPanel');
    if (!g.buildMode) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const hq = p.team.hq;
    const rows = BUILD_KEYS.map((k, i) => {
      const c = g.cost(k, p);
      const ok = p.team.lumber >= c.lumber && p.team.scrap >= c.scrap;
      return `<div class="bRow ${g.buildSel === k ? 'sel' : ''} ${ok ? '' : 'poor'}"><span class="bKey">${i + 1}</span><span class="bName">${STRUCTURES[k].name}</span><span class="bCost">🪵${c.lumber}${c.scrap ? ` ⚙️${c.scrap}` : ''}</span><span class="bBlurb">${STRUCTURES[k].blurb}</span></div>`;
    });
    let up = '<span class="bName">Upgrade HQ</span><span class="bCost">MAX</span>';
    if (hq && hq.alive && hq.level < HQ_LEVELS.length - 1) {
      const c = g.upgradeCost(p.team, p);
      up = `<span class="bName">Upgrade HQ → ★${hq.level + 1}</span><span class="bCost">🪵${c.lumber} ⚙️${c.scrap}</span><span class="bBlurb">${hq.level === 0 ? 'More HP, roof gun, faster respawns' : 'Even more HP + self-repair'}</span>`;
    }
    rows.push(`<div class="bRow"><span class="bKey">5</span>${up}</div>`);
    el.innerHTML = `<div class="bTitle">BUILD MODE</div>${rows.join('')}<div class="bStatus ${g.buildReason ? 'bad' : 'good'}">${g.buildReason || 'Click to place'}</div><div class="bHint">LMB place · R / wheel rotate · B exit</div>`;
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (!p) return;
    // Every frame: vitals, abilities, crosshair, labels.
    $('hpFill').style.width = `${Math.max(0, p.hpFrac) * 100}%`;
    $('shieldFill').style.width = `${Math.min(1, p.shield / p.maxHp) * 100}%`;
    $('hpText').textContent = `${Math.max(0, Math.ceil(p.hp))}${p.shield > 1 ? ` +${Math.ceil(p.shield)}` : ''} / ${p.maxHp}`;
    for (const k of ['a1', 'a2']) {
      const el = $('ab_' + k);
      if (!el) continue;
      const cd = p.cd[k], max = p.hero[k].cd;
      el.querySelector('.abFill').style.height = `${(1 - cd / max) * 100}%`;
      el.querySelector('.abCd').textContent = cd > 0 ? Math.ceil(cd) : '';
      el.classList.toggle('ready', cd <= 0);
    }
    const ult = $('ab_ult');
    if (ult) {
      ult.querySelector('.abFill').style.height = `${p.ult}%`;
      ult.querySelector('.abCd').textContent = p.ult >= 100 ? 'READY' : `${Math.floor(p.ult)}%`;
      ult.classList.toggle('ready', p.ult >= 100);
    }
    const w = p.hero.weapon;
    $('ammo').innerHTML = p.buffs.hog > 0 ? `<b>∞</b> <span>${w.name}</span>` : p.reloadT > 0 ? `<b>RELOADING</b> <span>${w.name}</span>` : `<b>${p.ammo}</b>/${w.mag} <span>${w.name}</span>`;
    if (this.hitT > 0 && (this.hitT -= dt) <= 0) $('hitmarker').className = '';
    if (this.dmgT > 0) this.dmgT -= dt;
    $('damageVignette').style.opacity = Math.max(0, this.dmgT / 0.35) * 0.8 + (p.alive && p.hpFrac < 0.3 ? 0.35 : 0);
    const inStorm = g.storm && p.alive && g.storm.outside(p.pos.x, p.pos.z);
    $('stormVignette').style.opacity = inStorm ? 1 : 0;
    $('crosshair').className = (p.ads ? 'ads ' : '') + (g.buildMode ? 'build' : '');
    $('scope').style.opacity = p.ads && p.heroId === 'hawk' ? 1 : 0;
    this.updateLabels();

    this.slowT -= dt;
    if (this.slowT > 0) return;
    this.slowT = 0.1;
    const t = p.team;
    $('resources').innerHTML = `<div>🪵 <b>${Math.floor(t.lumber)}</b> Lumber</div><div>⚙️ <b>${Math.floor(t.scrap)}</b> Scrap</div><div class="hint">B: Build${t.fortifyT > 0 ? ' · <span class="fort">FORTIFIED</span>' : ''}</div>`;
    $('teams').innerHTML = g.teams.map((tm) => {
      const alive = tm.members.filter((m) => m.alive).length;
      const hq = tm.hq && tm.hq.alive ? tm.hq : null;
      return `<div class="teamRow ${tm.eliminated ? 'dead' : ''}"><span class="sw" style="background:${tm.css}"></span><span class="tn">${tm.name}</span><span class="tm">${'●'.repeat(alive)}${'○'.repeat(tm.members.length - alive)}</span><span class="thq">${hq ? `<i style="width:${(hq.hp / hq.maxHp) * 100}%;background:${tm.css}"></i>` : tm.eliminated ? 'OUT' : 'NO HQ'}</span></div>`;
    }).join('');
    const s = g.storm;
    let stormTxt = '';
    if (g.state === 'drop') stormTxt = '<b>DROP IN</b> — steer with WASD, your base deploys where you land';
    else if (s && s.next) stormTxt = s.state === 'wait' ? `Storm closes in <b>${fmtTime(s.timeLeft)}</b>` : `<b class="purple">Storm closing</b> ${fmtTime(s.timeLeft)}`;
    else if (s) stormTxt = '<b class="purple">FINAL CIRCLE</b>';
    const left = g.teams.filter((tm) => !tm.eliminated).length;
    $('stormInfo').innerHTML = `${stormTxt}<div class="sub">${left} teams left · ${fmtTime(g.time)}</div>`;
    this.updateBuildPanel();
    this.drawMinimap();
    let prompt = '';
    if (p.alive && !p.parachute && !g.buildMode) {
      const tr = g.terrain.nearestTree(p.pos.x + Math.sin(p.yaw), p.pos.z + Math.cos(p.yaw), 2.0, (tt) => !tt.decor);
      if (tr) prompt = `<b>F</b> Chop Pine (+${p.heroId === 'lumberjack' ? 15 : 10} lumber)`;
      else if (g.terrain.nearestCrate(p.pos.x, p.pos.z, 2.6)) prompt = '<b>F</b> Open Supply Crate';
      else if (inStorm) prompt = '<span class="purple">You are in the storm — get to the circle!</span>';
    }
    $('prompt').innerHTML = prompt;
  }
}

export { hex, fmtTime };
