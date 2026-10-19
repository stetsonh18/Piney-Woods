// All the tunable numbers live here. Balance the game by editing this file.

export const TEAM_DEFS = [
  { name: 'Your Squad', color: 0x3b82f6, css: '#3b82f6' },
  { name: 'Lufkin Lumberjacks', color: 0xef4444, css: '#ef4444' },
  { name: 'Nacogdoches Night Owls', color: 0xa855f7, css: '#a855f7' },
  { name: 'Tyler Rose Raiders', color: 0xf59e0b, css: '#f59e0b' },
];

export const BOT_NAMES = [
  'Bubba', 'Cooter', 'Dusty', 'Hank', 'Jolene', 'Lurleen', 'Boone', 'Wade',
  'Darlene', 'Earl', 'Tammy', 'Clem', 'Rhett', 'Luann', 'Jeb', 'Mae',
];

// Bots get meaner, not tankier. Hard mode is for getting your tail whooped and clawing back.
export const DIFFICULTY = {
  easy: {
    label: 'Sunday Drive', blurb: 'Bots miss a lot and rarely raid.',
    aimErr: 0.1, reaction: 0.9, fireMul: 0.55, dmgMul: 0.7,
    raidStart: 120, raidEvery: 85, buildEvery: 30, income: 0.6, focusPlayer: 0.25,
  },
  normal: {
    label: 'Piney Woods', blurb: 'A fair fight. Bases get raided.',
    aimErr: 0.055, reaction: 0.55, fireMul: 0.75, dmgMul: 0.9,
    raidStart: 75, raidEvery: 55, buildEvery: 22, income: 1, focusPlayer: 0.35,
  },
  hard: {
    label: 'Get Your Tail Whooped', blurb: 'Sharp aim, early raids, fortified bases.',
    aimErr: 0.028, reaction: 0.3, fireMul: 0.95, dmgMul: 1.1,
    raidStart: 45, raidEvery: 40, buildEvery: 15, income: 1.4, focusPlayer: 0.5,
  },
};

// a1 = Shift, a2 = E, ult = Q (Overwatch layout).
export const HEROES = {
  ranger: {
    name: 'Ranger', role: 'Damage', hp: 200, speed: 7.6, hat: 'cowboy', accent: 0x8b5a2b,
    blurb: 'Fast rifleman. Dash in, frag their walls, get out.',
    weapon: { name: 'Lever Rifle', dmg: 19, rate: 7, spread: 0.014, range: 130, mag: 30, reload: 1.6, pellets: 1, zoom: 1.5, sound: 'rifle' },
    a1: { name: 'Dash', cd: 5, desc: 'Burst in the direction you are moving.' },
    a2: { name: 'Frag Grenade', cd: 9, desc: 'Explosive lob. Wrecks structures.' },
    ult: { name: 'Hog Wild', desc: '7s of double fire rate, no reloads, +20% speed.', line: 'HOG WILD!' },
  },
  lumberjack: {
    name: 'Lumberjack', role: 'Tank', hp: 360, speed: 6.6, hat: 'beanie', accent: 0xb91c1c,
    blurb: 'Shotgun bruiser. Fells a pine in one swing (+50% lumber).',
    weapon: { name: 'Scattergun', dmg: 10, rate: 1.3, spread: 0.075, range: 38, mag: 6, reload: 2.2, pellets: 9, zoom: 1.2, sound: 'shotgun', falloff: 14 },
    a1: { name: 'Bark Barrier', cd: 12, desc: 'Deploy a shield that blocks enemy fire.' },
    a2: { name: 'Axe Charge', cd: 8, desc: 'Charge forward, knocking enemies back.' },
    ult: { name: 'TIMBER!', desc: 'Ground slam. Huge damage and fells every pine nearby for lumber.', line: 'TIMBERRR!' },
  },
  doc: {
    name: 'Doc', role: 'Support', hp: 180, speed: 7.8, hat: 'cap', accent: 0xf1f5f9,
    blurb: 'Keeps the squad standing. Regenerates out of combat.',
    weapon: { name: 'Bramble SMG', dmg: 10, rate: 12, spread: 0.035, range: 60, mag: 40, reload: 1.4, pellets: 1, zoom: 1.3, sound: 'smg' },
    a1: { name: 'Heal Pulse', cd: 8, desc: 'Heal yourself and nearby allies.' },
    a2: { name: 'Adrenaline', cd: 12, desc: 'Speed boost for you and nearby allies.' },
    ult: { name: 'Second Wind', desc: 'Full heal + overshield nearby and revive fallen teammates — even without an HQ.', line: "Y'ALL GET UP!" },
  },
  hawk: {
    name: 'Hawk', role: 'Recon', hp: 160, speed: 7.4, hat: 'hood', accent: 0x4d7c0f,
    blurb: 'Deer-stand sniper. Spots raiders and calls in artillery.',
    weapon: { name: 'Deer Rifle', dmg: 85, rate: 0.85, spread: 0.002, range: 230, mag: 5, reload: 2.4, pellets: 1, zoom: 3.5, sound: 'sniper', headMul: 2 },
    a1: { name: 'Jump Pack', cd: 7, desc: 'Launch into the air.' },
    a2: { name: 'Recon Dart', cd: 14, desc: 'Reveals enemies near impact on your minimap.' },
    ult: { name: 'Airstrike', desc: 'Artillery on the aimed spot. Flattens bases.', line: 'DANGER CLOSE!' },
  },
  engineer: {
    name: 'Engineer', role: 'Builder', hp: 200, speed: 7.0, hat: 'hardhat', accent: 0xeab308,
    blurb: 'Base builder. Builds cost 35% less and are 25% tougher.',
    weapon: { name: 'Rivet Carbine', dmg: 14, rate: 6.5, spread: 0.02, range: 85, mag: 28, reload: 1.6, pellets: 1, zoom: 1.5, sound: 'rifle' },
    a1: { name: 'Mini Sentry', cd: 16, desc: 'Drop a temporary turret anywhere.' },
    a2: { name: 'Repair Pulse', cd: 10, desc: 'Repair nearby structures and patch up allies.' },
    ult: { name: 'Fortify', desc: 'Your structures are invulnerable and fire twice as fast for 10s.', line: 'BATTEN DOWN THE HATCHES!' },
  },
};

export const STRUCTURES = {
  wall: { name: 'Log Wall', lumber: 20, scrap: 0, hp: 450, key: '1', blurb: 'Cover. Stops raiders cold.' },
  turret: { name: 'Sentry Stand', lumber: 30, scrap: 20, hp: 320, key: '2', range: 38, dmg: 9, rate: 2.2, blurb: 'Auto-shoots enemies.' },
  campfire: { name: 'Campfire', lumber: 25, scrap: 0, hp: 160, key: '3', radius: 9, heal: 14, blurb: 'Heals allies nearby.' },
  wire: { name: 'Barbed Wire', lumber: 10, scrap: 10, hp: 220, key: '4', dps: 22, blurb: 'Slows and cuts enemies.' },
  // Ability-only structures (not in the build menu).
  barrier: { name: 'Bark Barrier', hp: 500 },
  miniturret: { name: 'Mini Sentry', hp: 150, range: 32, dmg: 7, rate: 3 },
  hq: { name: 'HQ', hp: 1500, range: 45, dmg: 11, rate: 2 },
};

export const BUILD_KEYS = ['wall', 'turret', 'campfire', 'wire'];

export const HQ_LEVELS = [
  { hp: 1500, respawn: 7 },
  { hp: 2200, respawn: 5, gun: true, cost: { lumber: 60, scrap: 40 } },
  { hp: 3000, respawn: 4, gun: true, regen: 8, cost: { lumber: 110, scrap: 80 } },
];

export const BUILD_RADIUS = 40;
export const START_RES = { lumber: 40, scrap: 20 };
