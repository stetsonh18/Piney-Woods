# Handoff: starting the local build session

The cloud session that designed Piney Woods can't run Unreal. This file hands the work to a Claude Code session running on the dev PC.

## Before you start the local session (you, ~1 afternoon)

Follow `docs/SETUP-PC.md` sections 1–3:
1. Install Unreal Engine 5, Visual Studio 2022 (with the "Game development with C++" workload), Git and the Claude Code desktop app.
2. Clone the repo and check out the branch `claude/practical-tesla-m0k3wy`.
3. Create the Unreal project: Third Person, C++, no Starter Content, named `PineyWoods`, inside the repo folder.
4. Close Unreal.

## The kickoff message

Open the repo folder in Claude Code (desktop app or terminal) and paste this as the first message:

```text
We're building Piney Woods: Timber Wars, a 5-player co-op hero shooter in Unreal Engine 5.
Read these first, in order:
1. docs/HANDOFF-LOCAL.md (this handoff: status, rules, gotchas)
2. docs/superpowers/specs/2026-10-19-piney-woods-design.md (approved design spec)
3. docs/superpowers/plans/2026-10-19-piney-woods-m0-m1-greybox-slice.md (the build plan)

Then execute the plan natively with the superpowers:executing-plans skill.
Task 1 Steps 1 and 2 are already done (I created the Unreal project; LFS and .gitignore are in the repo).
Start at Task 1 Step 3. Work on branch claude/practical-tesla-m0k3wy and commit after every task.
Stop and tell me whenever a step needs me (restarting you, play-testing in the editor, the squad playtest).
```

## Status at handoff

| Item | State |
| --- | --- |
| Design spec | Approved |
| Build plan (M0 setup + M1 greybox slice, 12 tasks) | Approved; execution method: **Native** |
| Task 1, Step 1: create the UE project | Done by the user before kickoff |
| Task 1, Step 2: Git LFS + Unreal .gitignore | Done (`.gitattributes`, `PineyWoods/.gitignore`) |
| Everything from Task 1, Step 3 on | Not started |
| Browser prototype (`src/`, `index.html`) | Legacy idea sketchpad; don't modify it as part of this plan |
| Pitch PDF / shared pitch doc | `docs/Piney-Woods-Game-Pitch.pdf`; keep it in sync only if the design changes |

## Rules for the local session

- **The spec decides, then the plan.** If they disagree, follow the spec and tell the user.
- **Don't widen scope.** Anything beyond M1 (other heroes, building, the boat, EOS, votes, the Homestead, art) waits for its own plan.
- **Tuning numbers live in data assets** (`DA_ConquestRules`, `DA_Hero_Ranger`), not hard-coded.
- **Low-end PCs:** every choice must keep Performance mode working on DX11 without Lumen.
- **Test before claiming done.** Run the plan's Build and Test commands, and only report a step as done after seeing `Result={Success}` or the PIE checklist passing.
- **Use the repo's commit trailers** (the session's own attribution settings) and never commit `Binaries/`, `Intermediate/`, `Saved/` or `DerivedDataCache/`.

## Gotchas the local session should expect

1. **Restart after `.mcp.json`.** Task 1 Step 4 writes `PineyWoods/.mcp.json`. Claude Code only loads MCP servers at startup, so after that step, stop and ask the user to:
   - Open the Unreal editor with the project.
   - Restart Claude Code in the repo.
   - Send "continue".
2. **Build.bat fails while the editor is open** (the DLLs are locked). Either close the editor first, or use Live Coding through `unreal-mcp`. Use Build.bat for header or reflection changes (`UCLASS`/`UPROPERTY` edits), because Live Coding can't handle those reliably.
3. **Plugin names may differ.** Check that `ModelContextProtocol` and `AllToolsets` exist in the installed engine's plugin list before adding them. If they're missing, tell the user which engine version is installed instead of guessing other names.
4. **The automation-test flag spelling varies by engine version.** Use whatever `IMPLEMENT_SIMPLE_AUTOMATION_TEST` flags compile on the installed version.
5. **The first editor open compiles shaders** for 10–30 minutes. That's normal, not a hang.
6. **PIE tests need the user.** Tasks 6–12 end in play-in-editor checks; describe exactly what the user should see and wait for their report.

## Open questions that don't block M1

- Lumberjack: keep the Scattergun plus melee weapons, or all-melee?
- Whose PC is the squad's weakest (the min-spec test machine for Task 12)?
- Is a run length of 60–90 minutes right?
- The final name.
