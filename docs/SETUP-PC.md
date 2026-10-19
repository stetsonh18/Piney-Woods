# Setting up your PC to build Piney Woods

Do this once, on the Windows PC you'll build the game on (the "dev PC"). It needs to be stronger than a player's PC: roughly an RTX 2070-class GPU, 32 GB RAM, and 150 GB free on an SSD.

Plan on an afternoon for this. Most of the time is downloads.

## 1. Install the tools

| # | Install | Where | Notes |
| --- | --- | --- | --- |
| 1 | **Unreal Engine 5** | Epic Games Launcher → Unreal Engine → Library → **+** | Install the latest 5.x release. In its Options, keep "Editor symbols for debugging" off to save about 60 GB. |
| 2 | **Visual Studio 2022 Community** (free) | visualstudio.microsoft.com | Required to compile C++. In the installer, tick the **"Game development with C++"** workload, and under its options tick **Unreal Engine installer** and the latest **Windows 11 SDK**. |
| 3 | **Git for Windows** | git-scm.com | Accept the defaults. Git LFS comes bundled. |
| 4 | **Claude Code desktop app** | claude.ai/download | Sign in with your Claude account. |

After installing, open **PowerShell** and run `git lfs install`. It should print "Git LFS initialized."

## 2. Get the repo

In PowerShell, run:

```powershell
mkdir $HOME\Projects -Force; cd $HOME\Projects
git clone https://github.com/stetsonh18/Video-Game.git
cd Video-Game
git checkout claude/practical-tesla-m0k3wy
```

The repo is now at `C:\Users\<you>\Projects\Video-Game`.

## 3. Create the Unreal project (plan Task 1, Step 1)

1. Open the Epic Games Launcher and launch Unreal Engine.
2. Choose **Games → Third Person**.
3. Set **Project Defaults** to **C++** and untick **Starter Content**.
4. Set the location to `C:\Users\<you>\Projects\Video-Game` and the name to `PineyWoods`.
5. Click **Create**. Unreal compiles the project and opens it. The first open compiles shaders and can take 10–30 minutes.
6. Close Unreal once it has finished opening.

**If Unreal says the folder already exists:** the repo already contains `PineyWoods\.gitignore`. Move that file to your desktop, create the project, then move it back into `PineyWoods\`.

## 4. Hand the rest to Claude Code

1. Open the Claude Code desktop app.
2. Open the folder `C:\Users\<you>\Projects\Video-Game`.
3. Tell it:

> Execute docs/superpowers/plans/2026-10-19-piney-woods-m0-m1-greybox-slice.md natively. Task 1 Step 1 (creating the project) and Step 2 (.gitattributes and PineyWoods/.gitignore) are already done, so start at Task 1 Step 3.

It will:
- Enable the plugins.
- Set up the graphics tiers.
- Connect itself to the Unreal editor.
- Work through the plan, stopping whenever it needs you to play-test something.

## When something goes wrong

| Problem | Fix |
| --- | --- |
| "Could not find a valid installation of Visual Studio" | Re-run the Visual Studio installer and make sure the "Game development with C++" workload is ticked. |
| `git push` is slow or asks about LFS | Run `git lfs install` again in the repo folder. |
| Claude Code doesn't list the `unreal-mcp` tools | Make sure the Unreal editor is open with the project loaded, then restart Claude Code. |
