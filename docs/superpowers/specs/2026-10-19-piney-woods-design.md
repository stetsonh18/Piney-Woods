# Piney Woods: Timber Wars: Design Spec

**Date:** 2026-10-19
**Status:** Approved (revised 2026-10-19: stylized art and low-end PC support)
**Pitch doc:** [Piney Woods: Timber Wars — Game Pitch](https://claude.ai/code/artifact/b57a4241-f9ea-4886-a58b-61fc7ca6a54c)

All numbers in this spec are starting values for playtesting, not final balance. Tuning values live in data assets (see §11) so they can change without code changes.

---

## 1. What we're building

Piney Woods is a 5-player squad shooter set in East Texas, built in Unreal Engine 5 for Windows PC. It mixes:
- **Overwatch-style heroes** with abilities and ultimates.
- **Battlefield-style zone capture** and a shared pool of lives (tickets).
- **Fortnite and Once Human-style base building.**

There is no grind: progression only adds options, never power.

**This spec covers the first release: co-op Conquest on Pine Harbor.** Your squad of five fights an AI squad that plays by the same rules. PvP 5v5, battle royale, the Longview and ETR Airport maps, and consoles are later phases (§13), but the architecture must not block them.

### 1.1 Design pillars

1. **Challenge over grind.** Fun comes from beating a strong enemy, not from unlocking things. Every run starts at the same power level.
2. **Build and fight at the same time.** Some of the squad fortifies while the rest pushes. Neither job is busywork.
3. **East Texas through and through.** Pines, red clay, lakes, Hometown Heroes in overalls, coolers of energy drinks. Funny, but the game itself is played straight.
4. **Squad decisions.** Big choices are made together by vote; no one player runs the show.
5. **Runs on almost any Windows PC.** A stylized art style plus two graphics tiers (Fortnite's approach) means a cheap laptop and a gaming rig can play in the same squad.

---

## 2. The run: co-op Conquest

A **run** is one match, 60–90 minutes long.

### 2.1 Flow

1. **Lobby vote** (§8): the squad picks the map, home base style, difficulty and a wildcard rule.
2. **Deploy:** the squad spawns at its home base. The AI squad spawns at the enemy HQ.
3. **Fortify phase (first 10 minutes):** respawns are free. The AI doesn't attack the home base during this window, but it does garrison and defend its own sub-bases.
4. **Conquest phase:** tickets start counting (§2.3). Both sides capture sub-bases, raid, defend and counterattack.
5. **Win** by detonating a demolition charge on the enemy HQ (§2.4).
6. **Lose** if your HQ is destroyed, or if your squad is fully wiped with 0 tickets left.
7. **Final Push:** at 75 minutes, the AI commits everything to an all-out assault on your HQ, so runs can't stall forever.

### 2.2 Capture zones (sub-bases)

| Rule | Value |
| --- | --- |
| Capture radius | 12 m |
| Capture time, 1 player | 20 s |
| Capture time with more players | Speeds up per extra player, minimum 8 s |
| Contested (both sides in the zone) | Progress freezes |
| Neutral zone | Must be captured from neutral |
| Enemy-held zone | Must first be drained to neutral, then captured |
| Owned zone | Becomes a respawn point (once the Conquest phase starts) and grants its unlock (§5.2) |
| Garrison | Each zone starts with an AI garrison: 2–4 Hometown Heroes plus defenses |

### 2.3 Tickets (shared lives)

- **Fortify phase:** deaths cost nothing.
- **Conquest phase:** the squad starts with **15 tickets**. Each death costs 1, and capturing a sub-base grants +3 (once per zone per run).
- **At 0 tickets:** dead players don't respawn. If every player is dead, the run is lost.
- **Respawn timer:** 8 s at the home base, 12 s at a sub-base.
- **Doc's ultimate** revives fallen teammates for free, even at 0 tickets.
- **The AI squad** uses the same ticket rules.

### 2.4 The demolition charge (Search & Destroy)

- Any player can carry the charge, which spawns at the home base. Only one charge exists per side.
- **Planting:** 4 s of interaction within 3 m of the enemy HQ core.
- **Arming:** 45 s, during which defenders can defuse it with 8 s of interaction.
- **Detonation:** destroys the HQ and wins the run.
- **Dropped charge:** if the carrier dies, the charge drops. After 30 s untouched, it returns home.
- **Taking sub-bases first is optional.** A sneak attack is always allowed; the sub-base unlocks just make the push much easier.
- **The AI** gets its own charge and runs the same play against you.

---

## 3. Heroes

All heroes are available from the first run. Each player picks a hero in the lobby and can switch at the home base. Duplicates are allowed in co-op.

**Shared kit:** every hero has a primary weapon, a melee/chop action (F), two abilities (Shift, E) and an ultimate (Q). Ultimate charge comes from damage dealt plus a slow passive trickle.

| Hero | Role | HP | Primary | Passive / extras | Shift | E | Q (ultimate) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ranger | Damage | 200 | Lever rifle: 19 dmg, 7 shots/s | n/a | Dash (5 s cd) | Frag Grenade: 85 dmg, 6 m radius, 2.2× vs structures (9 s cd) | Hog Wild: 7 s of double fire rate, no reloads, +20% speed |
| Lumberjack | Tank | 360 | Scattergun: 9 pellets × 10 dmg | Chainsaw (heavy melee, 60 dmg) and hatchet (light melee, 30 dmg, faster). Fells a pine in one hit, +50% lumber | Bark Barrier: 500 HP shield for 8 s (12 s cd) | Axe Charge: knockback, 45 dmg, 120 vs structures (8 s cd) | TIMBER!: 11 m slam for 140 dmg; fells every pine within 14 m (dropping any Hawk in them) for lumber |
| Doc | Support | 180 | SMG: 10 dmg, 12 shots/s | Regenerates 7 HP/s after 3 s out of combat | Heal Pulse: 75 HP to allies within 13 m (8 s cd) | Adrenaline: +45% speed for allies within 13 m for 4 s (12 s cd) | Second Wind: full heal + 100 overshield to allies within 30 m; revives every fallen teammate |
| Hawk | Recon / sniper | 160 | Deer rifle: 85 dmg, 2× headshot | Climbs pines to perch near the top; anyone chopping his tree drops him | Jump Pack (7 s cd) | Recon Dart: reveals enemies within 55 m for 8 s (14 s cd) | Drone Swarm: 8 drone strikes on the marked spot over about 3 s, 110 dmg each, 2.2× vs structures |
| Engineer | Builder | 200 | Carbine: 14 dmg, 6.5 shots/s | Builds cost 35% less and have 25% more HP | Mini Sentry: lasts 20 s, 150 HP (16 s cd) | Repair Pulse: +250 HP to structures and +30 HP to allies within 16 m (10 s cd) | Fortify: your structures can't be damaged and turrets fire 2× faster for 10 s |

**Open:** does the Lumberjack keep the Scattergun (assumed yes), or go all-melee? See §14.

---

## 4. Base building

### 4.1 Resources

- **Resources are shared** across the squad: one pool of lumber and one of scrap.
- **Lumber:** chopping a pine gives 10 (the Lumberjack gets 15). A pine takes 3 hits to fell (1 for the Lumberjack). Felled pines regrow after about 2 minutes, unless something is built on the spot.
- **Scrap sources:**

| Source | Scrap |
| --- | --- |
| Supply crate (refills every 90 s) | 25 (plus 10 lumber) |
| Kill | 15 |
| Destroying an enemy structure | 10 |
| Destroying the enemy HQ | 60 |

- **Passive trickle:** a slow flow of resources keeps coming while your HQ stands.

### 4.2 Structures

- **Where you can build:** only within 40 m of your HQ or of an owned sub-base.
- **Placement:** a ghost preview turns green or red. R or the mouse wheel rotates it.
- **Blockers:** pines block placement until they're chopped.

| Structure | Cost (lumber / scrap) | HP | Notes |
| --- | --- | --- | --- |
| Log Wall | 20 / 0 | 450 | Blocks movement and bullets |
| Sentry Turret | 30 / 20 | 320 | 38 m range, 9 dmg, 2.2 shots/s |
| Cooler | 25 / 0 | 160 | Energy drinks heal allies within 9 m (14 HP/s) |
| Barbed Wire | 10 / 10 | 220 | Slows enemies 45% and deals 22 dmg/s |
| Booby Trap | 15 / 15 | 1 | Hidden tripwire; 70 dmg blast, single use |
| AA Turret | 30 / 30 | 300 | Targets vehicles only; the counter to the boat, train and plane |
| HQ upgrade ★1 | 60 / 40 | +700 | Roof gun and faster respawns |
| HQ upgrade ★2 | 110 / 80 | +800 | HQ self-repairs at 8 HP/s when not hit for 4 s |

### 4.3 Home base styles

Chosen by lobby vote (§8). Every style has the same total HP budget. They differ in layout and perks, not in power.

| Style | Layout | Perk | Weakness | Unlock |
| --- | --- | --- | --- | --- |
| Two-Story Residence | One house with a second floor | Upstairs sniping windows; sturdy walls | One big target | Available at start |
| WowABurger | Burger joint with a parking lot | Kitchen: an interact that grants a 30 s food buff (+20% damage resist) on a 60 s cooldown per player; drive-thru window to shoot from | Big windows, open lot | Unlockable |
| Caravans | 4 linked mobile homes | Can't be wiped by a single airstrike. Once per run, the squad can vote to tow one trailer, which becomes a new respawn point | Each trailer is flimsy | Unlockable |
| ShantyTown | A junk maze | Builds and repairs cost 30% less; 2 free booby traps | Structures take 25% more damage | Unlockable |

**Win condition with Caravans:** the HQ core sits in the main trailer, so the demolition charge must be planted there.

**Legal note:** WowABurger must not copy Whataburger's real trade dress (the orange-and-white striped A-frame, the logo or the fonts). The parody name is fine; the building should be original.

### 4.4 Hometown Heroes

- **What they are:** stationary AI defenders, hillbillies in overalls.
- **Stats:** 60 HP each, about 8 dmg/shot at 1 shot per 1.5 s, 30 m range.
- **Behavior:** they hold their placed spot (a porch, a truck bed, a deer stand) and never move to capture.
- **Limits:** up to 4 per base.
- **Getting more:** you place them after owning the RV Campground sub-base (§5.2), at 10 scrap each.
- **The AI's own garrisons** use the same unit.
- **Voice lines:** a set of barks ("Git off my property!"). This is where most of the game's humor lives.

---

## 5. The first map: Pine Harbor (Lake O' the Pines)

### 5.1 Layout

- **Size:** a roughly 1 km × 1 km playable area around a lake.
- **Home base:** your squad's base is on the south shore.
- **Enemy HQ:** on the north shore.
- **Paths:** the lake is the fast route between them; the forest trails around it are slow but covered.
- **Five sub-bases** sit between the two HQs (§5.2).
- **Terrain:** dense loblolly pine forest (all choppable), red-clay roads, docks, cabins.

### 5.2 Sub-bases and unlocks

| Sub-base | Location | Unlock |
| --- | --- | --- |
| The Marina (center) | Peninsula in the middle of the lake | Signature vehicle: the boat (§6) |
| Bait & Tackle | West shore | Armory: squad weapons +1 tier (+15% damage), lasts the whole run |
| Lumber Mill | East woods | Lumber trickle ×3 and walls 25% cheaper |
| Fire Lookout Tower | Ridge top | Radar: enemies within 120 m of any owned zone show on the minimap |
| RV Campground | South-east cove | Hometown Heroes (§4.4) |

### 5.3 Later maps (out of scope for the first release)

- **Longview** (city): the signature vehicle is the train. Owning the Rail Yard lets your squad ride a train down a fixed track toward the enemy side as a moving fortress, which plays like a payload push.
- **ETR Airport:** the signature vehicle is a 2-seat plane for munitions drops. The map has hangars (armories), a control tower (radar) and a cargo terminal (Hometown Heroes).

---

## 6. The boat

- **Unlock:** owning the Marina spawns one boat at its dock. If it's destroyed, it respawns there after 90 s while you still own the Marina.
- **Seats (4):** a driver, a gunner on a mounted machine gun (12 dmg, 10 shots/s, 360° turret), and 2 passengers who can shoot their own weapons.
- **Stats:** 800 HP. It takes 2× damage from explosives and AA Turrets.
- **What it's for:** fast flanking across the lake, and landing a team (with the charge) right at the enemy shore.
- **The AI** uses the boat if it owns the Marina.

---

## 7. The AI enemy

The AI is split into three layers:

| Layer | Job |
| --- | --- |
| Squad Commander (one per AI side) | Reads the run state (zones owned, tickets, HQ health, the player squad's position) and assigns each bot a goal: defend, capture a zone, raid, escort the charge, or gather/build. Re-plans every 5 s. |
| Bot heroes (5) | Use the same hero classes and abilities as players. Each one runs a behavior tree that reaches its assigned goal and fights whatever it finds on the way. |
| Garrisons | Hometown Heroes and turrets: stationary, simple target selection |

**Pacing:**
- **During the fortify phase,** the commander only defends.
- **After that,** it launches a counterattack on a player-owned zone about every 4–6 minutes and attempts a charge run every 12–15 minutes.
- **It always responds** to a player push on its HQ.

**Difficulty** (lobby vote) changes bot aim error, reaction time, how often they attack and how much they build. It never changes HP or damage:

| Level | Name |
| --- | --- |
| Easy | Sunday Drive |
| Normal | Piney Woods |
| Hard | Get Your Tail Whooped |

**Fair-play rules:**
- Bots must have line of sight to shoot.
- The commander only knows player positions that its bots, garrisons or radar have seen in the last 10 s, so there's no wallhacking.

---

## 8. Squad votes

**Rules for every vote:**
- Majority wins; the host breaks ties.
- Votes are bundled together and on a timer, so they never stall the game.

| When | Options | Mechanics |
| --- | --- | --- |
| Lobby | Map (Pine Harbor only at first), home base style, difficulty, wildcard rule | One ballot screen, 20 s timer; if you don't vote, you abstain |
| In match | HQ upgrade, towing a Caravan trailer, retreat (everyone teleports home with a 10 s channel; once per run), restart run | Anyone proposes; it passes with 3 of 5 yes (or a majority of players present), 10 s timer, 60 s cooldown per proposer |
| Homestead | Which unlock to buy next | Open poll; runs between sessions |

**Starting wildcard rules** (one is picked per run):

| Wildcard | Effect |
| --- | --- |
| Night Raid | Dark map; flashlights and muzzle flashes give away positions |
| Low Tickets | Start with 8 tickets |
| Hometown Hoedown | Base limit of 8 Hometown Heroes, for both sides |
| Lumber Boom | Pines give double lumber |
| Hot Potato | The charge arms in 25 s |

Wildcard rules don't change hero power.

---

## 9. Progression: the Homestead

**The rule: options, never power.**

### 9.1 The hub

- **What it is:** a small persistent hub level, your squad's own patch of land.
- **What's there:**
  - A trophy wall showing past runs (won or lost, map, time, style, best moments).
  - Decorations: free placement of cosmetic props.
  - The unlock board.
- **When you're there:** between runs, and it doubles as the lobby. Votes happen here too.

### 9.2 Bragging Rights

- **The currency:** each player earns **Bragging Rights** (BR) per run: 100 for a win, 40 for a loss, and +20 per sub-base the squad captured.
- **What it buys:** the squad votes on what to spend it on:

| Unlock | Cost |
| --- | --- |
| Home base style | 300 BR |
| Hometown Hero variant (cosmetic; same stats) | 150 BR |
| New wildcard rule | 100 BR |
| Decorations and hero skins | 50–200 BR |

### 9.3 What never unlocks

- Heroes, weapons, weapon tiers, stat boosts and structures are never unlocked through progression.
- Armory upgrades only last for the run they were earned in.

### 9.4 Saving the Homestead

- **Where it lives:** the host's PC keeps a single squad save file.
- **What it holds:** unlocks, BR, trophies and decorations.
- **How it syncs:** the save is copied to every squad member when they join, so any member can host. Conflicts are resolved by newest timestamp.
- **Later:** move it to cloud storage (Epic Online Services Player Data Storage).

---

## 10. Platform and tech

### 10.1 Platform, engine and performance

| Area | Choice |
| --- | --- |
| Platform | Windows 10/11 PC; mouse and keyboard plus gamepad (PS5 DualSense via Steam Input / SDL) |
| Engine | Unreal Engine 5 (the current release when the project is created; we stay on it until a deliberate upgrade) |
| Art direction | Stylized, in the spirit of Overwatch and Fortnite: chunky pines, saturated East Texas sunsets, readable silhouettes, cartoony Hometown Heroes. No photoreal scanned assets. |
| Minimum PC (Performance mode) | Windows 10 64-bit, 4-core CPU, 8 GB RAM, DirectX 11 GPU (GTX 960-class, Intel Iris Xe, AMD Radeon Vega). Target: 30+ fps at 1080p output with 50–67% resolution scale. |
| Recommended PC (Epic mode) | RTX 3060-class GPU, 16 GB RAM. Target: 60 fps at 1080p with Lumen lighting. |
| Graphics tiers | **Performance mode:** no Lumen (simple sky and ambient lighting), no Nanite-only assets, low shadows, upscaling on; runs on DX11. **Epic mode:** Lumen global illumination and reflections, high shadows; DX12. The game auto-detects a tier on first launch and players can change it. Every asset must look right in both tiers. |
| Mixed squads | Graphics tier never affects gameplay: the same collision, visibility (foliage the same in both tiers) and hitboxes, so a Performance-mode player isn't advantaged or handicapped. |
| Dev PC | Building the game needs a stronger PC than playing it: about RTX 2070-class, 32 GB RAM, 150 GB free SSD. |

### 10.2 Multiplayer and online

- **Hosting:** one player hosts a **listen server**; up to 4 others join. There are no dedicated servers and no monthly costs.
- **Networking:** gameplay is server-authoritative using Unreal replication.
- **Online services:** Epic Online Services (free) through Unreal's EOS integration, for:
  - Friends and invites
  - Lobbies
  - Voice chat, both squad voice and proximity voice
  - Later, cloud saves
- **Future-proofing:** dedicated servers are a later option for PvP; the code shouldn't assume the host is a player.

### 10.3 Core systems

| System | Choice |
| --- | --- |
| Gameplay code | C++ for rules and systems, Blueprints for content and tuning |
| Hero abilities and stats | Gameplay Ability System (GAS) |
| Input | Enhanced Input |
| AI | Behavior Trees + EQS for bots, a C++ Squad Commander |
| UI | UMG |
| World | World Partition; Lumen in Epic mode only; stylized meshes with standard LODs (no Nanite-only assets, so they render on DX11); PCG for forest scattering |

### 10.4 Choppable trees

- **Rendering:** pines are instanced (hierarchical instanced static meshes), managed by a replicated **Tree Manager** that tracks which pine instances are standing.
- **Chopping:** the server hides the instance and spawns a short-lived falling-tree actor for the animation.
- **Late joiners** get the current felled-tree state when they connect.

### 10.5 Code modules

These live under `Source/PineyWoods/`:

| Module | Contents |
| --- | --- |
| `Core` | Conquest game mode, game state (tickets, phase, zone ownership), player state (resources share, stats) |
| `Heroes` | Base hero character, one GAS ability set per hero, hero data assets |
| `Objectives` | Capture zone, HQ core, demolition charge |
| `Building` | Placement and validation, structures, base styles |
| `World` | Tree Manager, supply crates, resource pickups |
| `Vehicles` | Boat |
| `AI` | Squad Commander, bot controllers, Hometown Heroes |
| `Meta` | Votes, Homestead save, Bragging Rights |
| `UI` | HUD, ballot screen, build menu, scoreboard |

Each module talks to the others through clear interfaces (e.g. the commander reads game state; it never pokes directly at UI).

### 10.6 Source control

- **Git with Git LFS** for binary assets (`.uasset`, `.umap`), using Unreal's recommended `.gitignore` (no `Saved/`, `Intermediate/`, `Binaries/` or `DerivedDataCache/`).
- **Storage limit:** GitHub's free LFS storage is limited, so large third-party art packs are kept out of git and re-downloaded from their source. If LFS outgrows GitHub, switch to Perforce or a paid LFS host.

---

## 11. Data-driven tuning

Every number in §§2–9 lives in data assets or data tables, not hard-coded:
- **Heroes:** `DA_Hero_*`
- **Structures:** `DT_Structures`
- **Rules:** `DA_ConquestRules`
- **Difficulty levels:** `DA_Difficulty_*`
- **Wildcard rules:** `DA_Wildcard_*`

This way, balancing after a playtest is a value edit, not code work.

---

## 12. Testing

### 12.1 Automated tests (Unreal Automation)

- Capture math: speed, contest freezing, draining
- Ticket accounting
- Charge plant, arm and defuse timing
- Build placement validation
- Vote resolution, including ties
- Homestead save round-trip

### 12.2 Functional test maps

- Bot reaches and captures a zone
- Turret targets an enemy
- Tree chop replicates to a client

### 12.3 Multiplayer and playtests

- **Multiplayer check:** every milestone is played in the editor with 1 host plus 2–4 clients and simulated lag (100 ms, 2% packet loss).
- **Squad playtest:** at the end of each milestone, the five of us play a run and fill out a 5-question feedback form; balance changes come from that.

---

## 13. Milestones

| # | Milestone | What "done" looks like |
| --- | --- | --- |
| M0 | Project setup | UE5 C++ project and Git + LFS repo. Claude Code is connected to the editor via the Unreal MCP plugin. An empty test map builds and runs. |
| M1 | Greybox slice | One untextured patch of Pine Harbor with your HQ, 1 sub-base and the enemy HQ. Ranger is fully playable (GAS). Capture, tickets and the charge win condition all work. 2 players on a listen server against 3 basic bots. |
| M2 | Core co-op | All 5 heroes. Building (all §4.2 structures), chopping and crates. Full Pine Harbor greybox with 5 sub-bases and their unlocks. The boat. The Squad Commander AI with 5 bots. Hometown Heroes. 5 players. |
| M3 | Squad features | EOS lobbies, invites and voice. Votes. Wildcard rules. Base styles. Homestead and Bragging Rights. |
| M4 | Art and audio pass | Stylized forest, lighting for both graphics tiers, character models and animation, VFX, sound, Hometown Hero voice barks. Hit both performance targets (§10.1) on real min-spec and recommended PCs. |
| Later | Expansion | 5v5 PvP, Longview with the train, ETR Airport with the plane, battle royale, more heroes, cloud saves, a Steam release |

The first implementation plan covers **M0 and M1 only**. Each later milestone gets its own plan.

---

## 14. Open questions

- [ ] **Lumberjack:** keep the Scattergun plus melee weapons (assumed here), or go all-melee?
- [ ] **Hardware:** whose PC is the weakest in the squad? It becomes our min-spec test machine. Who has a dev PC strong enough to build on?
- [ ] **Run length:** is 60–90 minutes right, or do we want a shorter mode?
- [ ] **Final name:** keep "Piney Woods: Timber Wars"?

## 15. Out of scope for the first release

- PvP of any kind
- Battle royale
- The Longview and ETR Airport maps, the train and the plane
- Consoles (PS5)
- Cloud streaming
- Dedicated servers
- Monetization
- Hero unlocks
- A single-player campaign
