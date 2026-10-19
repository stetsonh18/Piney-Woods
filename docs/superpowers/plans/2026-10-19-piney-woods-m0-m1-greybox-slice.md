# Piney Woods M0–M1 (Project Setup + Greybox Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable greybox slice of co-op Conquest. Two players on a listen server play Ranger against 3 Ranger bots on a small untextured Pine Harbor patch, with one capture zone, tickets, and the demolition-charge win condition.

**Architecture:**
- **Pure C++ rules:** every rule (capture math, tickets, charge state machine, weapon state, match result, bot goal choice) lives in plain C++ structs with no world dependency, so Unreal Automation tests can cover it.
- **Thin actors:** actors and components wrap those structs, replicate their state, and run on the server.
- **GAS for heroes:** hero stats and abilities use the Gameplay Ability System, with the ability system component on the PlayerState.
- **Data assets:** all tuning values come from data assets.

**Tech Stack:**
- Unreal Engine 5 (current release when the project is created), C++ plus Blueprints
- Gameplay Ability System, Enhanced Input
- AIModule (Behavior Trees and AI Perception)
- UMG
- Unreal Automation tests
- Git with Git LFS
- Unreal MCP plugin (ModelContextProtocol + AllToolsets), so Claude Code can drive the editor
- Two graphics tiers via Unreal scalability: Performance (DX11, no Lumen) and Epic (DX12, Lumen)

**Spec:** `docs/superpowers/specs/2026-10-19-piney-woods-design.md` (sections 2, 3, 10, 11, 12 and 13 are the ones this plan implements)

**Where this runs:** on the developer's Windows PC, with Claude Code running locally in the repo and the Unreal editor open. It can't run in a cloud container.

## Global Constraints

**Environment**
- Platform: Windows 10/11, Win64, Development editor builds.
- Unreal project lives in `PineyWoods/` at the repo root. The game module is named `PineyWoods`.
- Class prefix is `PW`: `APW…` for actors, `UPW…` for UObjects, `FPW…` for structs, `EPW…` for enums.

**Units and data**
- 1 Unreal unit = 1 cm. Spec meters × 100 = cm (e.g. 12 m = 1200).
- Every tuning number comes from `UPWConquestRules` (`DA_ConquestRules`) or `UPWHeroData` (`DA_Hero_Ranger`). The C++ defaults in the tuning structs equal the spec values below.

**Spec values**

| Area | Values |
| --- | --- |
| Phases | Fortify phase 600 s. Final Push (75 min) is M2, not in this plan. |
| Tickets | Start 15; −1 per death in the Conquest phase; +3 per zone, once per zone per run; deaths in the fortify phase are free |
| Respawn | 8 s at home, 12 s at an owned zone |
| Capture | Radius 1200 cm; solo 20 s; each extra player adds +50% rate; minimum 8 s; contested freezes progress; enemy-owned zones drain to neutral first |
| Charge | Plant 4 s within 300 cm; arm 45 s; defuse 8 s; a dropped charge returns home after 30 s |
| Ranger | HP 200; speed 760 cm/s; rifle 19 dmg, 7 shots/s, mag 30, reload 1.6 s, spread 0.014 rad, range 13000 cm, headshot ×1.5 |
| Ranger abilities | Dash: 3000 cm/s for 0.22 s, 5 s cooldown. Frag: 85 dmg, radius 600 cm, fuse 1.7 s, 9 s cooldown, damage falloff `1 − 0.65·d/r`. Hog Wild: 7 s, 2× fire rate, no ammo use, +20% speed. |
| Ultimate charge | +0.22 per damage dealt to enemies, +0.7 per second passive, capped at 100. No charge for self-damage or friendly damage. |

**Graphics tiers** (spec §10.1)
- Performance mode must run on DX11 with Lumen off. Epic mode uses DX12 with Lumen GI and reflections.
- No Nanite-only meshes: every mesh keeps standard LODs so it renders on DX11.
- Graphics tier never changes collision, visibility or hitboxes. Foliage that blocks sight in one tier blocks it in both.
- Greybox target on the squad's weakest PC: 30+ fps at 1080p output in Performance mode.

**Networking**
- Server-authoritative. Clients send input and requests; the server runs every rule.
- Listen server: one player hosts.

**Source control**
- Git LFS tracks `*.uasset` and `*.umap`.
- `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/` and `.vs/` are git-ignored.

**Commands** (PowerShell). `$UE` is the engine root (e.g. `C:\Program Files\Epic Games\UE_5.x`); `$PROJ` is `<repo>\PineyWoods\PineyWoods.uproject`.
- **Build** (editor closed): `& "$UE\Engine\Build\BatchFiles\Build.bat" PineyWoodsEditor Win64 Development -Project="$PROJ" -WaitMutex`. With the editor open, use Live Coding through the Unreal MCP connection instead.
- **Test:** `& "$UE\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "$PROJ" -ExecCmds="Automation RunTests PineyWoods.<Filter>; Quit" -unattended -nopause -nullrhi -nosplash -log -testexit="Automation Test Queue Empty"`
- **Pass means:** every test logs `Result={Success}`, none logs `Result={Fail}`, and the exit code is 0.

**Test code**
- Tests live in `PineyWoods/Source/PineyWoods/Private/Tests/`, wrapped in `#if WITH_DEV_AUTOMATION_TESTS`, and named `PineyWoods.<Area>.<Case>`.
- Use `IMPLEMENT_SIMPLE_AUTOMATION_TEST` with the flags the installed engine accepts for editor and engine filter (e.g. `EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter`).
- When simulating time, tick in steps of 0.1 s with the helper `PWTest::Advance(TFunctionRef<void(float)> Tick, float Seconds, float Step = 0.1f)` from Task 2.

## Review Focus

1. **A dead pawn standing in a zone counts as present** and wrongly contests or captures it. Expected: only living pawns count. *(Task 3: `PineyWoods.Objectives.Capture.DeadPawnsIgnored`)*
2. **The carrier dies mid-plant or while carrying**, and the charge vanishes or stays "carried". Expected: it drops where they died and starts the 30 s return timer. *(Task 4: `PineyWoods.Objectives.Charge.CarrierDiesWhilePlanting`; Task 9 drops it at the death location)*
3. **The charge falls out of the world** (off the map or into water), or a dropped charge is otherwise unreachable. Expected: it returns home immediately, but an armed charge never moves. *(Task 4: `PineyWoods.Objectives.Charge.ReturnHomeIgnoredWhenArmed`; Task 9 kill-Z check)*
4. **A disconnected player is treated as alive or as dead** in the squad-wipe check. Expected: only connected players count, and a squad with tickets left is never "wiped". *(Task 2: `PineyWoods.Rules.Tickets.WipeCountsOnlyConnected`)*
5. **Ult charge from friendly fire or self-damage, or going past 100.** Expected: no charge from those sources, and a hard cap at 100. *(Task 5: `PineyWoods.Heroes.Ult.NoChargeFromFriendlyOrSelf`, `PineyWoods.Heroes.Ult.CapsAt100`)*

---

## File Structure

All paths are relative to `PineyWoods/Source/PineyWoods/`. Each file has one job.

| File | Responsibility |
| --- | --- |
| `PineyWoods.Build.cs` | Module dependencies |
| `Public/Core/PWTypes.h` | `EPWTeam`, `EPWMatchPhase`, `EPWMatchResult` |
| `Public/Core/PWConquestRules.h` / `Private/Core/PWConquestRules.cpp` | Rules data asset + tuning structs |
| `Public/Core/PWTicketPool.h` / `.cpp` | Ticket accounting (pure) |
| `Public/Core/PWMatchLogic.h` / `.cpp` | Phase clock + result evaluation (pure) |
| `Public/Core/PWGameMode.h` / `.cpp` | Spawning, deaths, respawns, phases, win/lose |
| `Public/Core/PWGameState.h` / `.cpp` | Replicated phase, timer, tickets, result |
| `Public/Core/PWPlayerState.h` / `.cpp` | Team, ASC, attribute set |
| `Public/Core/PWTeamStart.h` | PlayerStart with a team |
| `Public/Objectives/PWCaptureLogic.h` / `.cpp` | Capture math (pure) |
| `Public/Objectives/PWChargeLogic.h` / `.cpp` | Charge state machine (pure) |
| `Public/Objectives/PWCaptureZone.h` / `.cpp` | Zone actor |
| `Public/Objectives/PWHQCore.h` / `.cpp` | HQ actor and plant point |
| `Public/Objectives/PWDemolitionCharge.h` / `.cpp` | Charge actor |
| `Public/Heroes/PWHeroData.h` | Hero data asset |
| `Public/Heroes/PWAttributeSet.h` / `.cpp` | Health, MaxHealth, UltCharge |
| `Public/Heroes/PWUltLogic.h` / `.cpp` | Ult charge math (pure) |
| `Public/Heroes/PWWeaponState.h` / `.cpp` | Ammo, fire-rate, reload, damage math (pure) |
| `Public/Heroes/PWWeaponComponent.h` / `.cpp` | Server hitscan firing |
| `Public/Heroes/PWHeroCharacter.h` / `.cpp` | Hero pawn, input, interact |
| `Public/Heroes/Abilities/PWGA_Dash.h` / `.cpp` | Dash ability |
| `Public/Heroes/Abilities/PWGA_FragGrenade.h` / `.cpp` | Frag ability |
| `Public/Heroes/Abilities/PWGrenade.h` / `.cpp` | Frag projectile |
| `Public/Heroes/Abilities/PWGA_HogWild.h` / `.cpp` | Hog Wild ultimate |
| `Public/AI/PWBotBrain.h` / `.cpp` | Bot goal selection (pure) |
| `Public/AI/PWBotController.h` / `.cpp` | Bot controller, perception, firing |
| `Public/UI/PWHUDWidget.h` / `.cpp` | HUD widget base |
| `Private/Tests/*.cpp` | Automation tests, one file per pure-logic unit |

**Content assets:**

| Path | Assets |
| --- | --- |
| `Content/PineyWoods/Data/` | `DA_ConquestRules`, `DA_Hero_Ranger` |
| `Content/PineyWoods/Input/` | Input actions + `IMC_Hero` |
| `Content/PineyWoods/Heroes/` | `BP_Hero_Ranger`, `GE_Damage`, `GE_HogWild` |
| `Content/PineyWoods/AI/` | `BT_Bot`, `BB_Bot` |
| `Content/PineyWoods/UI/` | `WBP_HUD` |
| `Content/PineyWoods/Maps/` | `L_PineHarbor_Greybox` |

---

### Task 1: Project setup (M0)

**Files:**
- Create: `PineyWoods/` (UE5 C++ "Third Person" template project named `PineyWoods`), `.gitattributes`, `PineyWoods/.gitignore`, `PineyWoods/.mcp.json`
- Modify: `PineyWoods/PineyWoods.uproject` (plugins), `PineyWoods/Source/PineyWoods/PineyWoods.Build.cs`
- Test: `PineyWoods/Source/PineyWoods/Private/Tests/PWSmokeTest.cpp`

**Interfaces:**
- Produces: a buildable `PineyWoodsEditor` target; the `PineyWoods.` test namespace; an MCP connection for later tasks.

- [ ] **Step 1: Create the project.** In the Epic Launcher, create Games → Third Person → **C++**, without Starter Content, at `<repo>\PineyWoods`, named `PineyWoods`. Open it once, then close it.
- [ ] **Step 2: Set up git ignore and LFS.**
  - Add `.gitattributes` at the repo root, with `*.uasset filter=lfs diff=lfs merge=lfs -text` and the same line for `*.umap`.
  - Add `PineyWoods/.gitignore` with `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`, `.vs/`, `*.sln`.
  - Run `git lfs install`.
- [ ] **Step 3: Enable plugins and dependencies.**
  - In `PineyWoods.uproject`, enable `GameplayAbilities`, `ModelContextProtocol` and `AllToolsets`. EnhancedInput is already on in the template.
  - In `PineyWoods.Build.cs`, set `PublicDependencyModuleNames` to `Core, CoreUObject, Engine, InputCore, EnhancedInput, GameplayAbilities, GameplayTags, GameplayTasks, AIModule, NavigationSystem, UMG, Slate, SlateCore, NetCore`.
- [ ] **Step 3b: Set up the two graphics tiers.**
  - In `Config/DefaultEngine.ini`, set the Windows default RHI to DX12 with DX11 allowed as a fallback (`-dx11` launch flag), and target both SM5 and SM6 shader formats.
  - In `Config/DefaultScalability.ini`, make GI and reflection quality levels 0–1 (Low/Medium) use no Lumen (`r.DynamicGlobalIlluminationMethod=0`, `r.ReflectionMethod=2`), and levels 2–3 (High/Epic) use Lumen (`=1`, `=1`). Set low-tier shadows to non-virtual and turn on TSR upscaling with a resolution scale of 67 at Low.
  - Keep `r.Nanite.ProjectEnabled` on, but import no Nanite-only meshes (Global Constraints).
  - Verify: launch the editor with `-dx11`, set Engine Scalability to Low, and confirm the template map renders with no errors and `stat gpu` shows no Lumen passes. Switch to Epic (DX12) and confirm Lumen passes appear.
- [ ] **Step 4: Connect the editor to Claude Code.**
  - Add the MCP auto-start block to `PineyWoods/Saved/Config/WindowsEditor/EditorPerProjectUserSettings.ini`: `[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]` with `bAutoStartServer=True`.
  - Write `PineyWoods/.mcp.json` pointing `unreal-mcp` at `http://127.0.0.1:8000/mcp`.
  - Restart Claude Code in the repo and confirm the `unreal-mcp` tools are listed.
- [ ] **Step 5: Write the smoke test.** In `PWSmokeTest.cpp`, write test `PineyWoods.Smoke.ModuleLoads`, asserting `TestTrue("module loaded", FModuleManager::Get().IsModuleLoaded("PineyWoods"))`.
- [ ] **Step 6: Build and run it.** Use the Build command, then the Test command with filter `PineyWoods.Smoke`. Expected: `Result={Success}`, exit code 0.
- [ ] **Step 7: Commit.**

```bash
git add .gitattributes PineyWoods
git commit -m "chore: create PineyWoods UE5 project with GAS, MCP, graphics tiers and smoke test"
```

---

### Task 2: Teams, rules data asset and the ticket pool

**Files:**
- Create: `Public/Core/PWTypes.h`, `Public/Core/PWConquestRules.h`, `Private/Core/PWConquestRules.cpp`, `Public/Core/PWTicketPool.h`, `Private/Core/PWTicketPool.cpp`, `Private/Tests/PWTestHelpers.h`
- Test: `Private/Tests/PWTicketPoolTest.cpp`

**Interfaces:**
- Produces:
  - `enum class EPWTeam : uint8 { None, Squad, Enemy }` (UENUM, BlueprintType)
  - `enum class EPWMatchPhase : uint8 { Fortify, Conquest, Ended }`
  - `enum class EPWMatchResult : uint8 { InProgress, SquadWon, EnemyWon }`
  - `struct FPWTicketPool` with:
    - `int32 Tickets`, `bool bConquest`
    - `void StartConquest(int32 StartTickets)`
    - `bool OnDeath()`: returns whether the dead player may respawn
    - `bool AwardCapture(FName ZoneId, int32 Amount)`
    - `static bool IsWiped(int32 AliveConnectedPlayers, int32 Tickets, bool bConquest)`
  - `UPWConquestRules : UPrimaryDataAsset`, with UPROPERTYs `FortifySeconds=600`, `StartTickets=15`, `TicketsPerCapture=3`, `RespawnHomeSeconds=8`, `RespawnZoneSeconds=12`, `CaptureRadiusCm=1200`, `BotCount=3`. (Task 3 adds `FPWCaptureTuning Capture` and Task 4 adds `FPWChargeTuning Charge` to this class.)
  - `PWTest::Advance(TFunctionRef<void(float)> Tick, float Seconds, float Step = 0.1f)`

- [ ] **Step 1: Write the failing tests** in `PWTicketPoolTest.cpp`:
  - `PineyWoods.Rules.Tickets.FortifyDeathsAreFree`: 20 calls to `OnDeath()` before `StartConquest` all return true, and `Tickets` is unchanged.
  - `PineyWoods.Rules.Tickets.FifteenThenOut`: after `StartConquest(15)`, 15 calls to `OnDeath()` return true, the 16th returns false, and `Tickets == 0`.
  - `PineyWoods.Rules.Tickets.CaptureAwardsOncePerZone`: `AwardCapture("Marina", 3)` returns true and `Tickets` goes from 15 to 18. A second `AwardCapture("Marina", 3)` returns false and `Tickets` stays 18.
  - `PineyWoods.Rules.Tickets.WipeCountsOnlyConnected`:

    | Call | Expected |
    | --- | --- |
    | `IsWiped(0, 0, true)` | true |
    | `IsWiped(0, 2, true)` | false (respawns pending) |
    | `IsWiped(1, 0, true)` | false |
    | `IsWiped(0, 0, false)` | false (fortify) |
- [ ] **Step 2: Run them to see them fail.** Test command, filter `PineyWoods.Rules.Tickets`. Expected: compile error or FAIL (symbols undefined).
- [ ] **Step 3: Implement** `PWTypes.h`, `PWTicketPool.h/.cpp` (the zones already awarded go in a `TSet<FName> AwardedZones`), `UPWConquestRules`, and `PWTestHelpers.h`.
- [ ] **Step 4: Run them to see them pass.** Same command. Expected: 4× `Result={Success}`.
- [ ] **Step 5: Commit.**

```bash
git add PineyWoods/Source/PineyWoods
git commit -m "feat: add team types, conquest rules asset and ticket pool"
```

---

### Task 3: Capture logic

**Files:**
- Create: `Public/Objectives/PWCaptureLogic.h`, `Private/Objectives/PWCaptureLogic.cpp`
- Modify: `Public/Core/PWConquestRules.h` (add `UPROPERTY(EditAnywhere) FPWCaptureTuning Capture;`)
- Test: `Private/Tests/PWCaptureLogicTest.cpp`

**Interfaces:**
- Consumes: `EPWTeam` (Task 2).
- Produces:
  - `USTRUCT FPWCaptureTuning { float SoloSeconds = 20.f; float MinSeconds = 8.f; float ExtraPlayerBonus = 0.5f; }`
  - `struct FPWZoneState { EPWTeam Owner = EPWTeam::None; float Progress = 0.f; }`. Progress runs from −1 to +1: +1 is Squad-owned, −1 is Enemy-owned.
  - `struct FPWPresence { EPWTeam Team; bool bAlive; }`
  - `namespace PWCapture`:
    - `float SecondsToCapture(int32 Attackers, const FPWCaptureTuning&)`: returns `max(MinSeconds, SoloSeconds / (1 + ExtraPlayerBonus·(n−1)))` for n ≥ 1
    - `bool Tick(FPWZoneState&, int32 SquadCount, int32 EnemyCount, float Dt, const FPWCaptureTuning&)`: returns true when `Owner` changes
    - `int32 CountPresence(TArrayView<const FPWPresence>, EPWTeam)`

**How `Tick` behaves:**
- **Contested** (both counts > 0) or **empty zone:** no change.
- **Otherwise:** move `Progress` toward the present team's sign by `Dt / SecondsToCapture(n)`, clamped to [−1, 1].
- **Ownership changes:**
  - `Owner` becomes Squad when Progress reaches +1, and Enemy when it reaches −1.
  - A Squad-owned zone becomes `None` once Progress ≤ 0; an Enemy-owned zone, once Progress ≥ 0.

- [ ] **Step 1: Write the failing tests:**
  - `PineyWoods.Objectives.Capture.SecondsByPlayerCount`: n = 1 → 20, 2 → 13.333 (tolerance 0.01), 3 → 10, 4 → 8, 6 → 8.
  - `PineyWoods.Objectives.Capture.SoloFromNeutral`: after advancing 19.9 s, `Owner == None`. After 20.1 s, `Owner == Squad` and `Progress == 1`.
  - `PineyWoods.Objectives.Capture.EnemyZoneDrainsThenCaptures`: start `{Enemy, −1}` with 1 squad player. After 20.1 s, `Owner == None` and |Progress| < 0.02. After 40.2 s total, `Owner == Squad`.
  - `PineyWoods.Objectives.Capture.ContestedFreezes`: start `{None, 0.5}`, 1v1 for 10 s. Progress stays 0.5.
  - `PineyWoods.Objectives.Capture.EmptyZoneHolds`: start `{None, 0.5}`, nobody present for 30 s. Progress stays 0.5.
  - `PineyWoods.Objectives.Capture.DeadPawnsIgnored`: `CountPresence({{Squad,true},{Squad,false},{Enemy,false}}, Squad) == 1` and `CountPresence(…, Enemy) == 0`.
- [ ] **Step 2: Run them to see them fail.** Filter `PineyWoods.Objectives.Capture`. Expected: FAIL.
- [ ] **Step 3: Implement** `PWCaptureLogic.h/.cpp`.
- [ ] **Step 4: Run them to see them pass.** Expected: 6× `Result={Success}`.
- [ ] **Step 5: Commit.**

```bash
git add PineyWoods/Source/PineyWoods
git commit -m "feat: add capture zone logic with drain, contest and dead-pawn rules"
```

---

### Task 4: Demolition-charge logic

**Files:**
- Create: `Public/Objectives/PWChargeLogic.h`, `Private/Objectives/PWChargeLogic.cpp`
- Modify: `Public/Core/PWConquestRules.h` (add `UPROPERTY(EditAnywhere) FPWChargeTuning Charge;`)
- Test: `Private/Tests/PWChargeLogicTest.cpp`

**Interfaces:**
- Produces:
  - `USTRUCT FPWChargeTuning { float PlantSeconds = 4.f; float PlantRangeCm = 300.f; float ArmSeconds = 45.f; float DefuseSeconds = 8.f; float ReturnSeconds = 30.f; }`
  - `enum class EPWChargeState : uint8 { Home, Carried, Dropped, Planting, Armed, Defusing, Detonated }`
  - `enum class EPWChargeEvent : uint8 { None, Planted, Detonated, Defused, Returned }`
  - `struct FPWChargeLogic` with:
    - `EPWChargeState State`, `float Timer`, `float ActionProgress`
    - `bool TryPickup()`: works from Home or Dropped and gives Carried
    - `void Drop()`: works from Carried or Planting; gives Dropped and resets `Timer`
    - `bool BeginPlant(float DistanceToHQCm, const FPWChargeTuning&)`: needs Carried and a distance ≤ PlantRangeCm
    - `void CancelPlant()`: Planting back to Carried; resets `ActionProgress`
    - `bool BeginDefuse()`: Armed to Defusing; the arm timer keeps running
    - `void CancelDefuse()`: Defusing back to Armed; resets `ActionProgress`
    - `void ReturnHome()`: any state except Armed, Defusing or Detonated goes to Home
    - `EPWChargeEvent Tick(float Dt, const FPWChargeTuning&)`

**Defuse rule:** a completed defuse sets `State = Home` and returns `Defused`. If the arm timer reaches `ArmSeconds` during a defuse, the charge detonates.

- [ ] **Step 1: Write the failing tests:**
  - `PineyWoods.Objectives.Charge.PlantNeedsRange`: `BeginPlant(301)` → false; `BeginPlant(300)` → true.
  - `PineyWoods.Objectives.Charge.PlantTakesFourSeconds`: after 3.9 s, `State == Planting`. At 4.0 s, the event is `Planted` and `State == Armed`.
  - `PineyWoods.Objectives.Charge.CancelPlantResets`: cancel at 3.9 s gives `Carried`. A fresh plant then needs a full 4 s again.
  - `PineyWoods.Objectives.Charge.DetonatesAfter45`: the event `Detonated` fires once, at 45 s after arming.
  - `PineyWoods.Objectives.Charge.DefuseInTime`: defuse starting at arm-time 10 s gives `Defused` at 18 s, and `State == Home`.
  - `PineyWoods.Objectives.Charge.DefuseTooLate`: defuse starting at arm-time 40 s gives `Detonated` at 45 s.
  - `PineyWoods.Objectives.Charge.DroppedReturnsAfter30`: `Drop()`, then after 30 s the event is `Returned` and `State == Home`.
  - `PineyWoods.Objectives.Charge.PickupResetsReturnTimer`: drop, wait 20 s, pick up, drop again. The charge is not returned 15 s later.
  - `PineyWoods.Objectives.Charge.CarrierDiesWhilePlanting`: while Planting, `Drop()` gives `State == Dropped` and `ActionProgress == 0`.
  - `PineyWoods.Objectives.Charge.ReturnHomeIgnoredWhenArmed`: from Armed, `ReturnHome()` leaves `State == Armed`. From Dropped, it gives `Home`.
- [ ] **Step 2: Run them to see them fail.** Filter `PineyWoods.Objectives.Charge`. Expected: FAIL.
- [ ] **Step 3: Implement** `PWChargeLogic.h/.cpp`.
- [ ] **Step 4: Run them to see them pass.** Expected: 10× `Result={Success}`.
- [ ] **Step 5: Commit.**

```bash
git add PineyWoods/Source/PineyWoods
git commit -m "feat: add demolition charge state machine"
```

---

### Task 5: GAS foundation (PlayerState, attributes, damage, ult charge)

**Files:**
- Create: `Public/Core/PWPlayerState.h/.cpp`, `Public/Heroes/PWAttributeSet.h/.cpp`, `Public/Heroes/PWUltLogic.h/.cpp`, `Content/PineyWoods/Heroes/GE_Damage`
- Test: `Private/Tests/PWUltLogicTest.cpp`

**Interfaces:**
- Consumes: `EPWTeam`.
- Produces:
  - `APWPlayerState : APlayerState, IAbilitySystemInterface` with:
    - `UPROPERTY(Replicated) EPWTeam Team`
    - `UAbilitySystemComponent* GetAbilitySystemComponent() const`
    - `UPWAttributeSet* GetAttributes() const`
    - Replication mode: Mixed for players and Minimal for bots
  - `UPWAttributeSet` with replicated `Health`, `MaxHealth`, `UltCharge` (use `ATTRIBUTE_ACCESSORS`), plus a meta attribute `IncomingDamage`.
    - `PostGameplayEffectExecute` subtracts `IncomingDamage` from Health, clamped to [0, MaxHealth].
    - It credits ult charge to the instigator's attribute set through `PWUlt::ShouldGrant`.
    - When Health reaches 0, it calls `APWGameMode::OnHeroKilled(Victim, Instigator)` (declared in Task 8; the cast happens in the .cpp).
  - `namespace PWUlt`:
    - `float AddFromDamage(float Current, float Damage, float PerDamage = 0.22f)`
    - `float AddPassive(float Current, float Dt, float PerSecond = 0.7f)`
    - `bool ShouldGrant(EPWTeam InstigatorTeam, EPWTeam TargetTeam, bool bSelf)`
    - All results are clamped to [0, 100].
  - `GE_Damage`: an instant effect with SetByCaller tag `Data.Damage` → `IncomingDamage`.

- [ ] **Step 1: Write the failing tests:**
  - `PineyWoods.Heroes.Ult.FromDamage`: `AddFromDamage(0, 100) == 22`.
  - `PineyWoods.Heroes.Ult.Passive`: `AddPassive(0, 10) == 7`.
  - `PineyWoods.Heroes.Ult.CapsAt100`: `AddFromDamage(95, 100) == 100` and `AddPassive(99.9f, 10) == 100`.
  - `PineyWoods.Heroes.Ult.NoChargeFromFriendlyOrSelf`: `ShouldGrant(Squad, Squad, false)` → false; `ShouldGrant(Squad, Enemy, true)` → false; `ShouldGrant(Squad, Enemy, false)` → true.
- [ ] **Step 2: Run them to see them fail.** Filter `PineyWoods.Heroes.Ult`. Expected: FAIL.
- [ ] **Step 3: Implement** `PWUltLogic`, `UPWAttributeSet`, `APWPlayerState` (create the ASC and attribute set in the constructor) and the `GE_Damage` asset (create it via MCP).
- [ ] **Step 4: Run them to see them pass.** Expected: 4× `Result={Success}`, and Build succeeds.
- [ ] **Step 5: Commit.**

```bash
git add PineyWoods
git commit -m "feat: add GAS player state, attribute set, damage effect and ult charge"
```

---

### Task 6: Ranger hero, weapon and input

**Files:**
- Create: `Public/Heroes/PWHeroData.h`, `Public/Heroes/PWWeaponState.h/.cpp`, `Public/Heroes/PWWeaponComponent.h/.cpp`, `Public/Heroes/PWHeroCharacter.h/.cpp`
- Create assets: `DA_Hero_Ranger`, `BP_Hero_Ranger` (child of `APWHeroCharacter`, using the template mannequin), input actions `IA_Move, IA_Look, IA_Jump, IA_Fire, IA_Reload, IA_Ability1, IA_Ability2, IA_Ult, IA_Interact`, and `IMC_Hero`
- Test: `Private/Tests/PWWeaponStateTest.cpp`

**Interfaces:**
- Consumes: `APWPlayerState` and `GE_Damage` (Task 5).
- Produces:
  - `USTRUCT FPWWeaponTuning { float Damage = 19.f; float ShotsPerSecond = 7.f; int32 MagSize = 30; float ReloadSeconds = 1.6f; float SpreadRad = 0.014f; float RangeCm = 13000.f; float HeadshotMultiplier = 1.5f; }`
  - `struct FPWWeaponState` with:
    - `int32 Ammo`, `float Cooldown`, `float ReloadRemaining`
    - `void Init(const FPWWeaponTuning&)`, `bool CanFire() const`
    - `bool ConsumeShot(const FPWWeaponTuning&, bool bHogWild)`: sets `Cooldown = 1 / (rate·(hog ? 2 : 1))`; uses no ammo under Hog Wild; starts a reload automatically at 0
    - `void StartReload(const FPWWeaponTuning&)`, `void Tick(float Dt, const FPWWeaponTuning&)`
  - `namespace PWDamage`:
    - `float ForHit(const FPWWeaponTuning&, bool bHeadshot)`
    - `float Falloff(float Base, float DistanceCm, float RadiusCm)`: `Base·(1 − 0.65·d/r)` when d < r, otherwise 0
  - `UPWHeroData : UPrimaryDataAsset` with `FText DisplayName`, `float MaxHealth = 200`, `float MoveSpeed = 760`, `FPWWeaponTuning Weapon`, and `TSubclassOf<UGameplayAbility> Ability1, Ability2, Ultimate`
  - `UPWWeaponComponent` with:
    - `UFUNCTION(Server, Reliable) void ServerFire(FVector_NetQuantize AimStart, FVector_NetQuantizeNormal AimDir)`
    - `UFUNCTION(Server, Reliable) void ServerReload()`
    - Replicated `int32 Ammo`
    - It reads the tag `State.HogWild` from the owner's ASC.
  - `APWHeroCharacter : ACharacter, IAbilitySystemInterface` with:
    - `UPWHeroData* HeroData`, `UPWWeaponComponent* Weapon`
    - `bool IsAlive() const`, `EPWTeam GetTeam() const`
    - On possess it initializes the ASC from its PlayerState, sets Health and MaxHealth from `HeroData`, and grants its three abilities.
  - **Input bindings:** LMB fire (hold), R reload, Shift → Ability1, E → Ability2, Q → Ult, F (held) → Interact.
  - **Firing:** the server traces from the camera, then applies `GE_Damage` with damage from `PWDamage::ForHit`. A headshot is a hit on bone `head`.

- [ ] **Step 1: Write the failing tests:**
  - `PineyWoods.Heroes.Weapon.MagThenReload`: 30× `ConsumeShot` (ticking the cooldown between shots) succeed. Then `CanFire() == false` and `ReloadRemaining == 1.6`. After 1.6 s, `Ammo == 30`.
  - `PineyWoods.Heroes.Weapon.FireRate`: after one shot, `Cooldown == 1/7` (tolerance 1e-4).
  - `PineyWoods.Heroes.Weapon.HogWild`: after a shot with `bHogWild = true`, `Cooldown == 1/14` and `Ammo` is unchanged.
  - `PineyWoods.Heroes.Weapon.NoFireWhileReloading`: `StartReload`, then `CanFire() == false` until 1.6 s has passed.
  - `PineyWoods.Heroes.Weapon.HeadshotDamage`: `ForHit(t, true) == 28.5` and `ForHit(t, false) == 19`.
  - `PineyWoods.Heroes.Weapon.Falloff`: `Falloff(85, 0, 600) == 85`, `Falloff(85, 300, 600) == 57.375`, `Falloff(85, 600, 600) == 0`.
- [ ] **Step 2: Run them to see them fail.** Filter `PineyWoods.Heroes.Weapon`. Expected: FAIL.
- [ ] **Step 3: Implement** the C++ classes above. Then create the assets via MCP:
  - `DA_Hero_Ranger` with the spec values.
  - `BP_Hero_Ranger`.
  - The input actions and `IMC_Hero`, added in `BeginPlay` for locally controlled pawns.
- [ ] **Step 4: Run them to see them pass.** Then do a PIE check in the template map, as a single player with `BP_Hero_Ranger` as the default pawn. Expected:
  - 6× `Result={Success}`.
  - Shooting a placed target dummy (a second `BP_Hero_Ranger`) lowers its Health by 19 per body hit.
  - The ammo count drops and reloads.
- [ ] **Step 5: Commit.**

```bash
git add PineyWoods
git commit -m "feat: add Ranger hero, weapon state, hitscan firing and input"
```

---

### Task 7: Ranger abilities (Dash, Frag Grenade, Hog Wild)

**Files:**
- Create: `Public/Heroes/Abilities/PWGA_Dash.h/.cpp`, `PWGA_FragGrenade.h/.cpp`, `PWGrenade.h/.cpp`, `PWGA_HogWild.h/.cpp`; assets `GE_Cooldown_Dash`, `GE_Cooldown_Frag`, `GE_HogWild`
- Modify: `DA_Hero_Ranger` (assign the abilities), `PWHeroCharacter.cpp` (movement speed reads `State.HogWild`)
- Test: covered by the `Falloff` test from Task 6, plus a PIE checklist

**Interfaces:**
- Consumes: `APWHeroCharacter`, `GE_Damage`, `PWDamage::Falloff`, `FPWWeaponState` (Hog Wild flag).
- Produces:
  - **Dash:** `UPWGA_Dash : UGameplayAbility` (cooldown 5 s). Uses `LaunchCharacter` along the movement input, or forward if there's no input, at 3000 cm/s for 0.22 s, ignoring friction.
  - **Frag:** `UPWGA_FragGrenade` (cooldown 9 s) spawns `APWGrenade`:
    - A replicated projectile thrown at 2200 cm/s toward the aim, with a +300 cm/s upward lob.
    - It bounces, using a projectile movement component with `bShouldBounce`.
    - It explodes after a 1.7 s fuse, or immediately when touching an enemy pawn, for `Falloff(85, d, 600)` to each enemy hero within 600 cm.
  - **Hog Wild:** `UPWGA_HogWild` (the ultimate; needs `UltCharge ≥ 100` and sets it to 0) applies `GE_HogWild`: a 7 s duration effect that grants the tag `State.HogWild`. While the tag is present, the weapon fires 2× with no ammo use, and max walk speed is ×1.2.

- [ ] **Step 1: Implement** the three abilities, the grenade, and the cooldown and Hog Wild effects. Assign the abilities in `DA_Hero_Ranger`.
- [ ] **Step 2: Run the PIE checklist** (single player, against a dummy). Expected:
  - Shift dashes about 6.6 m and is then gray for 5 s.
  - E throws a grenade that bounces and explodes after 1.7 s. A dummy 3 m from the blast loses about 57 HP.
  - Q does nothing below 100 ult. After `UltCharge` is set to 100 via MCP, Q gives 7 s of doubled fire rate with no ammo drain and faster running, then everything reverts.
- [ ] **Step 3: Run the full test suite.** Filter `PineyWoods`. Expected: every test `Result={Success}`.
- [ ] **Step 4: Commit.**

```bash
git add PineyWoods
git commit -m "feat: add Ranger Dash, Frag Grenade and Hog Wild abilities"
```

---

### Task 8: Match flow (game mode, game state, spawning, respawns) and the greybox map

**Files:**
- Create: `Public/Core/PWMatchLogic.h/.cpp`, `Public/Core/PWGameMode.h/.cpp`, `Public/Core/PWGameState.h/.cpp`, `Public/Core/PWTeamStart.h/.cpp`; map `Content/PineyWoods/Maps/L_PineHarbor_Greybox`
- Modify: `DefaultEngine.ini` (`GameDefaultMap` and `EditorStartupMap` → `L_PineHarbor_Greybox`; `GlobalDefaultGameMode` → `APWGameMode`)
- Test: `Private/Tests/PWMatchLogicTest.cpp`

**Interfaces:**
- Consumes: `FPWTicketPool`, `UPWConquestRules`, `APWPlayerState`, `APWHeroCharacter`.
- Produces:
  - `struct FPWMatchClock { float Elapsed = 0.f; EPWMatchPhase Phase = EPWMatchPhase::Fortify; bool Tick(float Dt, float FortifySeconds); /* true on the Fortify→Conquest switch */ }`
  - `EPWMatchResult PWMatch::Evaluate(bool bSquadHQAlive, bool bEnemyHQAlive, bool bSquadWiped, bool bEnemyWiped)`:

    | Condition | Result |
    | --- | --- |
    | Enemy HQ destroyed, or enemy wiped | SquadWon |
    | Squad HQ destroyed, or squad wiped | EnemyWon |
    | Both at once | Squad HQ destruction is checked first (EnemyWon) |
  - `APWTeamStart : APlayerStart` with `UPROPERTY(EditAnywhere) EPWTeam Team`.
  - `APWGameState` with replicated `EPWMatchPhase Phase`, `float PhaseTimeRemaining`, `int32 SquadTickets`, `int32 EnemyTickets`, `EPWMatchResult Result`.
  - `APWGameMode` with:
    - `UPWConquestRules* Rules`
    - One `FPWTicketPool` per team
    - `void OnHeroKilled(APWHeroCharacter* Victim, AActor* Instigator)`: decides whether the victim respawns via `OnDeath()`; the respawn takes `RespawnHomeSeconds` (or `RespawnZoneSeconds` at an owned zone, wired in Task 9)
    - `void OnZoneCaptured(FName ZoneId, EPWTeam NewOwner)`
    - `void OnHQDestroyed(EPWTeam Team)`
    - `APWTeamStart* PickStart(EPWTeam Team)`
    - **Team assignment:** human players go to Squad; bots go to Enemy (bots spawn in Task 10).
    - **Each tick:** advance `FPWMatchClock` (calling `StartConquest` on both pools at the switch), check for wipes using connected, alive players, then evaluate the result.
    - **At match end:** set `Result` and stop respawns.
  - **Map `L_PineHarbor_Greybox`:**
    - Terrain: a 300 m × 300 m landscape, or a flat plane plus blocks, with a lake strip down the middle.
    - The Squad HQ area is at the south edge, with 3 `APWTeamStart` (Squad).
    - The Enemy HQ area is at the north edge, with 3 `APWTeamStart` (Enemy).
    - The center (the Marina) is reserved for the zone in Task 9.
    - Cover: about 20 cylinder "pines" as static meshes. They don't need to be choppable yet.
    - A `NavMeshBoundsVolume` covers the whole playable area.

- [ ] **Step 1: Write the failing tests:**
  - `PineyWoods.Rules.Match.FortifyEndsAt600`: `Tick` returns true exactly once, as `Elapsed` crosses 600, and then `Phase == Conquest`.
  - `PineyWoods.Rules.Match.ResultCases`:

    | Call | Expected |
    | --- | --- |
    | `Evaluate(true, false, false, false)` | SquadWon |
    | `Evaluate(false, true, false, false)` | EnemyWon |
    | `Evaluate(true, true, true, false)` | EnemyWon |
    | `Evaluate(true, true, false, true)` | SquadWon |
    | `Evaluate(true, true, false, false)` | InProgress |
- [ ] **Step 2: Run them to see them fail.** Filter `PineyWoods.Rules.Match`. Expected: FAIL.
- [ ] **Step 3: Implement** the logic, game mode and game state. Build the greybox map via MCP (spawn actors, the landscape or plane, team starts and the nav volume).
- [ ] **Step 4: Verify.** Run the tests, then do a PIE check with 2 players (Net Mode: Play As Listen Server). Set `FortifySeconds` to 30 in `DA_ConquestRules` for this check only, and don't commit that change. Expected:
  - Both tests pass.
  - Both players spawn at the south starts.
  - Killing a player during the first 30 s doesn't change the ticket count. After 30 s, each death drops `SquadTickets` by 1 on both screens (shown by `PW.ShowState`, a debug console command you add to the game mode).
  - Respawn happens after 8 s.
- [ ] **Step 5: Commit.**

```bash
git add PineyWoods
git commit -m "feat: add conquest match flow, team spawning, respawns and greybox map"
```

---

### Task 9: Objective actors (capture zone, HQ core, demolition charge, interact)

**Files:**
- Create: `Public/Objectives/PWCaptureZone.h/.cpp`, `PWHQCore.h/.cpp`, `PWDemolitionCharge.h/.cpp`
- Modify: `PWHeroCharacter.cpp` (holding F interacts with the nearest objective within 300 cm), `PWGameMode.cpp` (zone respawn point, HQ destroyed), `L_PineHarbor_Greybox` (place 1 zone "Marina" at the center, 2 HQ cores, 2 charges)

**Interfaces:**
- Consumes: `PWCapture`, `FPWChargeLogic`, `APWGameMode::OnZoneCaptured/OnHQDestroyed`, `APWHeroCharacter::IsAlive/GetTeam`.
- Produces:
  - `APWCaptureZone : AActor` with:
    - `UPROPERTY(EditAnywhere) FName ZoneId`
    - A sphere of radius `Rules->CaptureRadiusCm`
    - Replicated `FPWZoneState State` (Owner + Progress)
    - `FVector GetRespawnLocation() const`
    - **Server tick:** build `FPWPresence` from the overlapping heroes, `Tick` the zone, and call `OnZoneCaptured` when ownership changes. The game mode then awards tickets via `AwardCapture(ZoneId, TicketsPerCapture)` to the new owner's pool.
  - `APWHQCore : AActor` with:
    - `UPROPERTY(EditAnywhere) EPWTeam Team`
    - A plant point at the core's location
    - `void DestroyCore()`, which calls `OnHQDestroyed(Team)` and plays a placeholder explosion
  - `APWDemolitionCharge : AActor` with:
    - `UPROPERTY(EditAnywhere) EPWTeam OwnerTeam`, `APWHQCore* TargetHQ`
    - Replicated `EPWChargeState State`, `float ArmRemaining`, `float ActionProgress`
    - `void ServerInteract(APWHeroCharacter* Who, bool bHeld)`. Inside its radius:
      - An attacker can pick it up.
      - A carrier holding F near the enemy HQ plants it.
      - A defender holding F on an armed charge defuses it.
    - **On carrier death or disconnect:** `Drop()` at the carrier's location.
    - **Each tick:** if `GetActorLocation().Z < GetWorldSettings()->KillZ + 100`, call `ReturnHome()`. On `Detonated`, call `TargetHQ->DestroyCore()`.
  - **Zone respawn rule:** when the victim's team owns any zone, the respawn uses that zone and `RespawnZoneSeconds`. Otherwise it uses home and `RespawnHomeSeconds`.

- [ ] **Step 1: Implement** the three actors and the interact input. Place them in the map via MCP.
- [ ] **Step 2: Run the PIE checklist** (2 players, listen server, no bots, `FortifySeconds` set to 30 in an uncommitted change). Expected:
  - **Capture:** one player in the Marina captures it in about 20 s, and both players capture it in about 13 s. The client's HUD debug print shows the same progress as the host's.
  - **Tickets:** owning the Marina gives +3 tickets once. Leaving and recapturing gives nothing more.
  - **Zone respawn:** after the capture, a dead player respawns at the Marina after 12 s.
  - **Plant and win:** carrying the squad's charge to the enemy HQ core and holding F for 4 s arms it. 45 s later the core explodes and the result is `SquadWon`.
  - **Carrier death:** killing the carrier mid-plant drops the charge at their body, and it returns home 30 s later.
  - **Kill-Z:** a charge pushed below Kill-Z (via MCP, move it to Z = −100000) is back at home on the next tick.
- [ ] **Step 3: Run the full test suite.** Filter `PineyWoods`. Expected: all pass.
- [ ] **Step 4: Commit.**

```bash
git add PineyWoods
git commit -m "feat: add capture zone, HQ core and demolition charge actors"
```

---

### Task 10: Basic bots (3 Ranger bots on the Enemy team)

**Files:**
- Create: `Public/AI/PWBotBrain.h/.cpp`, `Public/AI/PWBotController.h/.cpp`; assets `BT_Bot`, `BB_Bot`
- Modify: `PWGameMode.cpp` (spawn `Rules->BotCount` bots on Enemy at match start; they respawn like players)
- Test: `Private/Tests/PWBotBrainTest.cpp`

**Interfaces:**
- Consumes: `EPWTeam`, `FPWZoneState`, `APWHeroCharacter`, `UPWWeaponComponent::ServerFire`, `APWGameMode::PickStart`.
- Produces:
  - `enum class EPWBotGoal : uint8 { AttackTarget, CaptureZone, DefendZone, DefendHQ }`
  - `struct FPWZoneView { FName Id; EPWTeam Owner; float DistanceCm; }`
  - `struct FPWBotWorldView { bool bHasVisibleEnemy; bool bHQThreatened; TArray<FPWZoneView> Zones; }`
  - `struct FPWBotDecision { EPWBotGoal Goal; FName ZoneId; }`
  - `FPWBotDecision PWBotBrain::Choose(const FPWBotWorldView&, EPWTeam MyTeam, int32 BotIndex)`. Rules, in order:
    1. A visible enemy → AttackTarget.
    2. HQ threatened (an enemy within 3000 cm of the HQ, or a charge armed on it) → DefendHQ.
    3. The nearest zone not owned by `MyTeam` → CaptureZone.
    4. Otherwise, `BotIndex == 0` → DefendHQ, and everyone else → DefendZone (the nearest one).
  - `APWBotController : AAIController` with:
    - `bWantsPlayerState = true`
    - AI Perception sight: 9000 cm radius, 70° half-angle; it only sees heroes from other teams
    - A re-decision every 0.5 s, written to the blackboard
    - **Aim:** aims at the target's chest with a random yaw/pitch error of σ = 0.055 rad (Normal difficulty), after a reaction delay of 0.55 s when a new target is acquired, firing at 0.75× the weapon rate
    - **Line of sight:** it only fires with line of sight
  - `BT_Bot`: a selector over the goal. AttackTarget = strafe + fire; CaptureZone/DefendZone = MoveTo the zone; DefendHQ = MoveTo the HQ plant point.

- [ ] **Step 1: Write the failing tests:**
  - `PineyWoods.AI.Brain.VisibleEnemyWins`: `bHasVisibleEnemy` together with `bHQThreatened` → AttackTarget.
  - `PineyWoods.AI.Brain.HQThreatBeatsZones` → DefendHQ.
  - `PineyWoods.AI.Brain.CapturesNearestUnowned`: `MyTeam = Enemy`, with zones A (Squad-owned, 5000 cm) and B (None, 8000 cm), plus a third zone Enemy-owned at 1000 cm. The bot chooses `{CaptureZone, A}`. (A is nearer than B, and the third zone is already owned by the bot's own team.)
  - `PineyWoods.AI.Brain.AllOwnedSplitsDuties`: all zones Enemy-owned. Index 0 → DefendHQ; index 1 → DefendZone with the nearest zone.
- [ ] **Step 2: Run them to see them fail.** Filter `PineyWoods.AI.Brain`. Expected: FAIL.
- [ ] **Step 3: Implement** the brain, the controller, `BT_Bot`/`BB_Bot` (via MCP) and bot spawning.
- [ ] **Step 4: Verify.** Run the tests, then do a PIE check (1 player). Expected:
  - Tests pass.
  - 3 bots spawn north and walk to the Marina.
  - A bot doesn't shoot through the cover pines.
  - Bots shoot the player on sight and respawn after dying.
  - Bot deaths drop `EnemyTickets` after the fortify phase.
- [ ] **Step 5: Commit.**

```bash
git add PineyWoods
git commit -m "feat: add Enemy bots with goal brain, perception and aiming"
```

---

### Task 11: HUD

**Files:**
- Create: `Public/UI/PWHUDWidget.h/.cpp`; asset `WBP_HUD` (child of `UPWHUDWidget`)
- Modify: `PWHeroCharacter.cpp` (create the HUD for the local player)

**Interfaces:**
- Consumes: `APWGameState` fields, `UPWAttributeSet`, `UPWWeaponComponent::Ammo`, ability cooldowns from the ASC, `APWCaptureZone::State`, `APWDemolitionCharge` state.
- Produces: `UPWHUDWidget : UUserWidget`, whose `NativeTick` fills these `BindWidget` elements:

| Widget | Contents |
| --- | --- |
| `TXT_Health` | `"<hp> / <max>"` |
| `TXT_Ammo` | `"<ammo> / 30"`, `"RELOADING"`, or `"∞"` during Hog Wild |
| `PB_Ult` | Ult percentage |
| `TXT_Ability1`, `TXT_Ability2` | Remaining cooldown, rounded up, or `"READY"` |
| `TXT_Phase` | `"FORTIFY m:ss"` or `"CONQUEST"` |
| `TXT_Tickets` | `"Squad <n> · Enemy <n>"` |
| `PB_Zone` | Progress mapped to 0–1, tinted by owner (blue = Squad, red = Enemy, gray = None) |
| `TXT_Charge` | Charge status: `"Charge: Home / Carried by <name> / Planting / ARMED m:ss / Defusing"` |
| `TXT_Result` | Hidden until the end, then `"PINEY WOODS CHAMPIONS"` (SquadWon) or `"GOT WHOOPED"` (EnemyWon) |

- [ ] **Step 1: Implement** `UPWHUDWidget` and build `WBP_HUD` via MCP. Reuse the pitch's fonts (Rye, Oswald) if they're imported; otherwise use the default font.
- [ ] **Step 2: Run the PIE check** (2 players plus bots). Expected:
  - Every field updates on both the host and the client.
  - The client's numbers match the host's within one tick.
  - The result banner appears for both players.
- [ ] **Step 3: Commit.**

```bash
git add PineyWoods
git commit -m "feat: add greybox HUD"
```

---

### Task 12: M1 multiplayer verification and squad playtest

**Files:**
- Create: `docs/playtests/2026-M1-greybox.md` (checklist results + feedback form answers)
- Modify: `DA_ConquestRules`, only if the playtest changes values (record each change and the reason in the playtest doc)

**Interfaces:**
- Consumes: everything above.
- Produces: an M1 sign-off record for starting the M2 plan.

- [ ] **Step 1: Network-condition check.**
  - Run PIE with 1 host + 1 client, and set the network emulation profile to `Average` (about 100 ms, about 1% loss) or custom 100 ms / 2%.
  - Repeat the Task 9 checklist.
  - **Expected:** no rubber-banding on Dash, captures and tickets agree on both screens, and a hit shown on the client is applied on the server.
- [ ] **Step 2: Late-join check.** Have a client join 2 minutes into a run. **Expected:** it sees the correct zone owner, ticket counts, phase timer and charge state immediately.
- [ ] **Step 3: Packaged-build check.**
  - Package Win64 Development and run 2 copies on 2 PCs. The host uses `open L_PineHarbor_Greybox?listen`, and the client uses `open <host-ip>`. Note: Steam/EOS invites are M3, so direct IP for now.
  - **Expected:** a full run from fortify to a detonation win.
- [ ] **Step 3b: Min-spec check.**
  - On the squad's weakest PC, run the packaged build with `-dx11` at Low scalability (Performance mode), at 1080p output.
  - Play a full run with 3 bots and watch `stat fps` and `stat unit`.
  - **Expected:** 30+ fps average, no drop below 20 fps during grenade explosions or 5-player fights. If it misses, record the `stat unit` numbers (Game, Draw, GPU) in the playtest doc.
- [ ] **Step 4: Squad playtest.**
  - Play at least 2 full runs with as many of the 5 as can join, against the 3 bots.
  - Record answers to:
    1. Was it fun?
    2. Did the fortify phase feel too long or too short?
    3. Did capturing the Marina feel worth it?
    4. Were the bots too easy or too hard?
    5. What's the one thing to fix first?
- [ ] **Step 5: Commit.**

```bash
git add docs/playtests PineyWoods/Content/PineyWoods/Data
git commit -m "docs: record M1 greybox playtest and tuning changes"
```
