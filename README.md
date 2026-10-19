# Piney Woods: Timber Wars

> **The real game is being built in Unreal Engine 5.** Start with [`docs/SETUP-PC.md`](docs/SETUP-PC.md), the [design spec](docs/superpowers/specs/2026-10-19-piney-woods-design.md) and the [build plan](docs/superpowers/plans/2026-10-19-piney-woods-m0-m1-greybox-slice.md). Everything below describes the original browser prototype.

A browser game that mixes three genres:
- **Hero shooter** like Overwatch: five heroes, each with abilities and an ultimate.
- **Battle royale** like Warzone: drop in from the sky, then a storm circle closes in.
- **Light base building**: you land with a starter base, chop East Texas pines for lumber, and add to it during the match.

Four squads of two drop in: you and an AI teammate against three AI squads. While your HQ stands, you respawn at it. Once it falls, you don't. The last squad standing wins.

## Design goals (from the original chat)

| What was said | How the game handles it |
| --- | --- |
| "Don't make it 100 hours of looting just to build one base" | You land with an HQ, four log walls, a turret and a campfire already built. |
| "Chop some East TX pine trees to get add-ons" | **F** on a pine gives lumber. Supply crates give scrap. Each upgrade takes seconds, not hours. |
| "Earning loot to upgrade is half the fun" | Inside a match, resources go into walls, turrets, wire and HQ upgrades (★1 adds a roof gun and faster respawns, ★2 adds self-repair). |
| "The fun is overcoming challenge… not the handholding stuff and pointless titles" | No unlocks, ranks, or battle pass. Every hero and build is available from match one. Bots raid your base and scale with difficulty, up to **Get Your Tail Whooped**. |

## Heroes

| Hero | Role | Shift | E | Q (Ult) |
| --- | --- | --- | --- | --- |
| Ranger | Damage | Dash | Frag Grenade | Hog Wild: double fire rate, no reloads |
| Lumberjack | Tank | Bark Barrier | Axe Charge | TIMBER!: ground slam that fells every pine nearby for lumber |
| Doc | Support | Heal Pulse | Adrenaline | Second Wind: team heal + overshield, revives fallen teammates |
| Hawk | Recon | Jump Pack | Recon Dart | Airstrike |
| Engineer | Builder | Mini Sentry | Repair Pulse | Fortify: your structures can't be damaged |

## Controls

`WASD` move · `Mouse` aim · `LMB` fire · `RMB` aim down sights · `Space` jump · `R` reload
`Shift` / `E` abilities · `Q` ultimate · `F` chop / open crate / melee · `B` build mode (`1`–`5` pick, `LMB` place, `R` or wheel rotate) · `Esc` pause

## Run it on your computer

You need [Node.js](https://nodejs.org) 18 or newer and [Git](https://git-scm.com).

```bash
# Pick a folder for your projects, e.g. ~/Projects, then:
git clone https://github.com/stetsonh18/Video-Game.git
cd Video-Game
git checkout claude/practical-tesla-m0k3wy   # until this branch is merged into main
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173) in Chrome, Edge or Firefox. Click **DROP IN**, then click the game window to lock the mouse.

`npm run build` creates a static `dist/` folder that runs from any web host (GitHub Pages, itch.io, etc.).

## Code map

| File | What lives there |
| --- | --- |
| `src/config.js` | **All balance numbers**: heroes, weapons, structures, difficulty, HQ levels |
| `src/main.js` | Game loop, match flow, building, respawns, team AI (raids and auto-building), camera |
| `src/character.js` | Character model, movement and physics, shooting, melee/chopping |
| `src/abilities.js` | Every hero ability, plus when bots decide to use them |
| `src/bot.js` | Bot brain: fight, raid, defend, gather lumber, escape the storm |
| `src/combat.js` | Raycasting, damage, grenades, darts, airstrikes, explosions |
| `src/structures.js` | HQ, walls, turrets, campfires, barbed wire |
| `src/terrain.js` | Hills, red-clay roads, pine forest, supply crates |
| `src/storm.js` | Closing circle |
| `src/hud.js` | HUD, minimap, kill feed, build panel |

## Ideas for next steps

- **Online multiplayer** (e.g. a Node/WebSocket server). That would also enable the "permanent server, no wipe" mode from the chat, where your base persists between sessions.
- More heroes, plus map landmarks (a lake, an oil derrick, a deer stand you can climb).
- Wall snapping and gates for cleaner base layouts.
- Sound effects and music from real audio files (the current sounds are generated in code).
