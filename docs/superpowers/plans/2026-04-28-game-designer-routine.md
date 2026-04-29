# Game Designer Routine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up 4 daily scheduled tasks (09:00 critique + 12:00/14:00/16:00 proposals at quick/medium/big risk levels) that act as an AI game designer for Hell's Kitchen Alchemist Edition. Each run produces a labelled GitHub issue against `wasuioi/Hell-s-Kitchen-Alchemist-Edition`.

**Architecture:** Two layers, decoupled. Layer 1: two config files in repo (`docs/game-design/themes.md`, `docs/game-design/reference-games.md`) as the single source of truth for theme rotation and reference-game library. Layer 2: four scheduled tasks created via `mcp__scheduled-tasks` that each read the configs at run time. Output goes to GitHub Issues with structured labels.

**Tech Stack:** GitHub CLI (`gh`), `mcp__scheduled-tasks` MCP tool, Markdown for config files.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/game-design/themes.md` | Create | Weekly theme rotation table, per-day focus areas + suggested files |
| `docs/game-design/reference-games.md` | Create | Library of reference games with strengths and theme mappings |
| `~/.claude/scheduled-tasks/game-design-critique/SKILL.md` | Create (via mcp tool) | 09:00 daily critique task prompt |
| `~/.claude/scheduled-tasks/game-design-quick-win/SKILL.md` | Create (via mcp tool) | 12:00 quick-win proposal task prompt |
| `~/.claude/scheduled-tasks/game-design-medium/SKILL.md` | Create (via mcp tool) | 14:00 medium-feature proposal task prompt |
| `~/.claude/scheduled-tasks/game-design-big-swing/SKILL.md` | Create (via mcp tool) | 16:00 big-swing proposal task prompt |

GitHub side (no files, but state changes):
- 6 labels on `wasuioi/Hell-s-Kitchen-Alchemist-Edition`: `game-design`, `daily-critique`, `proposal-quick`, `proposal-medium`, `proposal-big`, `sub-task`.

---

## Preconditions

- `gh auth status` returns authenticated against `wasuioi/Hell-s-Kitchen-Alchemist-Edition`.
- Working directory: the repo root or this worktree. Config-file commits target the worktree branch as usual; scheduled-task creation is global to the user's machine and doesn't require a particular branch.

---

### Task 1: Write the theme rotation config

**Files:**
- Create: `docs/game-design/themes.md`

- [ ] **Step 1: Create `docs/game-design/` directory and the file**

Run:
```bash
mkdir -p docs/game-design
```

Then write `docs/game-design/themes.md` with this exact content:

```markdown
# Daily Theme Rotation

Each day, the AI game-designer routine reads this table and uses the row whose `Day` column matches today's day-of-week. On Sat/Sun (free critique), the routine picks any theme it judges most relevant given recent code activity.

| Day | Theme | Focus areas | Suggested code to read |
|-----|-------|-------------|------------------------|
| Mon | Combat feel | impact, hit-stop, knockback, audio/visual feedback | src/components/Enemy.tsx, src/components/Player.tsx, src/components/Spell.tsx, src/components/DamageNumbers.tsx |
| Tue | Spell variety | 6 spells from 3 ingredients, recipe combos, synergy | src/data/recipes.ts, src/components/Spell.tsx, src/types.ts |
| Wed | Enemy design | 5 types (slow/fast/tanky/boss/exploder), threat curve | src/components/EnemyManager.tsx, src/components/Boss.tsx, src/stores/enemyStore.ts |
| Thu | Pacing & waves | wave length, escalation, boss intro, downtime | src/stores/gameStore.ts, src/components/Arena.tsx |
| Fri | Meta progression | perks, run-to-run, deck building | src/data/perks.ts, src/stores/deckStore.ts, src/stores/playerStore.ts |
| Sat | Free critique | pick whatever feels most needed | — |
| Sun | Free critique | — | — |

## Editing this file

Add new themes or shift days as needed. Keep theme names exactly consistent with the "Best for" entries in `reference-games.md`, or matching will silently fail.
```

- [ ] **Step 2: Verify the file**

Run:
```bash
ls -la docs/game-design/themes.md
head -3 docs/game-design/themes.md
```

Expected: file exists, first line is `# Daily Theme Rotation`.

---

### Task 2: Write the reference-games library

**Files:**
- Create: `docs/game-design/reference-games.md`

- [ ] **Step 1: Write the file**

Write `docs/game-design/reference-games.md` with this exact content:

```markdown
# Reference Games

The AI game-designer routine reads this list and picks one game whose `Best for` includes today's theme. If multiple match, prefer one not already used in an earlier same-day issue.

## Binding of Isaac
- Strengths: room-based dungeon, item synergy, secret discovery, run variance
- Best for: Spell variety, Meta progression, Free critique

## Vampire Survivors
- Strengths: wave timer escalation, auto-attack power fantasy, evolution combos, audio juice
- Best for: Combat feel, Pacing & waves, Enemy design

## Megabonk
- Strengths: 3D auto-attack survival, build variety, goofy charm, scaling chaos in 3D space
- Best for: Combat feel, Pacing & waves, Enemy design (3D-native — closest match to our Three.js setup)

## Hades
- Strengths: narrative meta-progression, weapon aspects, boon system, "one more run" hooks
- Best for: Meta progression, Combat feel

## Slay the Spire
- Strengths: deckbuilding, branching map, relic synergy, build identity
- Best for: Spell variety, Meta progression

## Risk of Rain 2
- Strengths: escalating difficulty, item stacking, scaling power fantasy
- Best for: Pacing & waves, Combat feel

## Cult of the Lamb
- Strengths: roguelike + base management, ritual loop, narrative variety
- Best for: Meta progression, Free critique

## Spelunky
- Strengths: emergent encounters, environmental hazards, deterministic chaos
- Best for: Enemy design, Pacing & waves

## Editing this file

Add new games as a new `## Game Name` section. The `Best for:` line MUST list theme names exactly as written in `themes.md`, comma-separated.
```

- [ ] **Step 2: Verify the file**

Run:
```bash
head -3 docs/game-design/reference-games.md
grep -c '^## ' docs/game-design/reference-games.md
```

Expected: first line `# Reference Games`; second command prints `9` (8 game sections + the editing section).

- [ ] **Step 3: Commit both config files**

Run:
```bash
git add docs/game-design/themes.md docs/game-design/reference-games.md
git commit -m "$(cat <<'EOF'
feat(game-design): add theme rotation and reference-games configs

These two files are the source of truth for the AI game-designer routine
defined in docs/superpowers/specs/2026-04-28-game-designer-routine-design.md.
Editing either updates routine output without touching the scheduled tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one new commit on the branch with both files added.

---

### Task 3: Create the 6 GitHub labels

**Files:** None on disk. State changes on `wasuioi/Hell-s-Kitchen-Alchemist-Edition`.

- [ ] **Step 1: Create the umbrella label**

Run:
```bash
gh label create "game-design" --color "0e8a16" --description "AI game designer routine output"
```

Expected: `✓ Created label "game-design"`. If it errors with "already exists" treat as success.

- [ ] **Step 2: Create the type labels**

Run each, treating "already exists" as success:
```bash
gh label create "daily-critique" --color "1d76db" --description "09:00 critique from game-designer routine"
gh label create "proposal-quick" --color "fbca04" --description "12:00 quick-win proposal (same-day fix)"
gh label create "proposal-medium" --color "d93f0b" --description "14:00 medium feature proposal (1-2 days)"
gh label create "proposal-big" --color "5319e7" --description "16:00 big-swing proposal (system-level)"
gh label create "sub-task" --color "c5def5" --description "Sub-issue split out from a parent proposal during implementation"
```

- [ ] **Step 3: Verify all 6 labels exist**

Run:
```bash
gh label list --limit 100 | grep -E "^(game-design|daily-critique|proposal-quick|proposal-medium|proposal-big|sub-task)\b" | wc -l
```

Expected: `6`.

---

### Task 4: Create scheduled task — 09:00 critique

**Files:**
- Create (via mcp tool): `~/.claude/scheduled-tasks/game-design-critique/SKILL.md`

- [ ] **Step 1: Call the create_scheduled_task MCP tool**

Use `mcp__scheduled-tasks__create_scheduled_task` with these arguments:

- `taskId`: `game-design-critique`
- `description`: `Daily 09:00 game design critique — reads theme + reference game configs, posts a critique issue.`
- `cronExpression`: `0 9 * * *`
- `notifyOnCompletion`: `true`
- `prompt`: (paste the entire block below verbatim)

```
You are the AI game designer for Hell's Kitchen Alchemist Edition. Run the daily 09:00 critique.

Repo: wasuioi/Hell-s-Kitchen-Alchemist-Edition
Working directory: /Users/pacas/Hell-s-Kitchen-Alchemist-Edition

## Step 0 — Sync local main from origin (must run before any file read)

The cron may fire before today's overnight changes have been pulled locally. Always fetch and fast-forward `main` first; if anything blocks that, fail loudly so the user notices instead of running on stale state.

Run, in order:
1. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition fetch origin main`
2. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition rev-parse --abbrev-ref HEAD` — output MUST equal `main`. If not, fail loudly with: "Expected /Users/pacas/Hell-s-Kitchen-Alchemist-Edition to be on `main`, got `<branch>`. Aborting cron run." Do NOT continue.
3. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition pull --ff-only origin main` — if this fails (non-fast-forward, merge conflict, dirty-tree conflict, etc.), surface the exact stderr and STOP. Do NOT proceed with stale state.

Only proceed past Step 0 once main is confirmed fast-forwarded (or already up to date).

## Step 1 — Setup
- cd /Users/pacas/Hell-s-Kitchen-Alchemist-Edition
- Get today's date as YYYY-MM-DD (local time) and the day-of-week (Mon/Tue/.../Sun).
- Verify `gh auth status` is healthy. If not, fail loudly with the auth error — do NOT continue.

## Step 2 — Read configs
- Read docs/game-design/themes.md. Find the row matching today's day-of-week. Capture: theme name, focus areas, suggested files to read.
- On Sat/Sun (Free critique), pick a theme you judge most relevant. Use `git log --oneline --since="7 days ago"` as a hint about what's been changing.
- Read docs/game-design/reference-games.md. Pick ONE game whose "Best for" line includes today's theme. If multiple match, pick the one whose strengths feel most relevant to the recent code state.
- If either config file is missing, fail loudly with a message instructing the user to restore them. Do NOT swallow the error.

## Step 3 — Read the suggested code files
- Read each file listed in the "Suggested code to read" column for today's theme. Skim for what's currently in place — note specific behaviours, magic numbers, missing features.

## Step 4 — Compose the issue body
Use this template exactly. Length target: 150-300 words. Cite specific files with `path:line` syntax.

```markdown
## Theme
<theme name>

## Reference
<game name> — <one-line strength of that game>

## Observation
<What's currently in the code, briefly. Cite files/lines.>

## What's not working
- <Issue 1, with file:line reference>
- <Issue 2>

## Hypothesis
<Why it isn't fun yet. Compare to how the reference game solves this.>
```

## Step 5 — Create the issue
- Title format: `[Game Design <YYYY-MM-DD>] <Theme> — Critique: <one-line hook>`
- Write the body to a temp file (use `mktemp`).
- Run: `gh issue create --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --title "<title>" --label "game-design,daily-critique" --body-file <tmp>`
- Print the resulting issue URL on success.

## Constraints
- Body must be 150-300 words.
- Cite real file paths and line numbers from the code you actually read — do not invent.
- If any step fails, surface the error and stop. Do NOT swallow exceptions or continue past failures.
- Do NOT create a PR or make any code changes. The output is one issue.
```

- [ ] **Step 2: Verify the task was created**

Use `mcp__scheduled-tasks__list_scheduled_tasks`. Expected: an entry with `taskId: game-design-critique`, `cronExpression: 0 9 * * *`, `enabled: true`.

---

### Task 5: Create scheduled task — 12:00 quick-win proposal

**Files:**
- Create (via mcp tool): `~/.claude/scheduled-tasks/game-design-quick-win/SKILL.md`

- [ ] **Step 1: Call the create_scheduled_task MCP tool**

Use `mcp__scheduled-tasks__create_scheduled_task` with:

- `taskId`: `game-design-quick-win`
- `description`: `Daily 12:00 quick-win proposal — same-day fix or number tweak, builds on morning critique.`
- `cronExpression`: `0 12 * * *`
- `notifyOnCompletion`: `true`
- `prompt`: (paste the entire block below verbatim)

```
You are the AI game designer for Hell's Kitchen Alchemist Edition. Run the daily 12:00 quick-win proposal.

Repo: wasuioi/Hell-s-Kitchen-Alchemist-Edition
Working directory: /Users/pacas/Hell-s-Kitchen-Alchemist-Edition

A "quick win" = a number/parameter change or one-line code edit that could plausibly ship in a single day.

## Step 0 — Sync local main from origin (must run before any file read)

The cron may fire before today's overnight changes have been pulled locally. Always fetch and fast-forward `main` first; if anything blocks that, fail loudly.

Run, in order:
1. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition fetch origin main`
2. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition rev-parse --abbrev-ref HEAD` — output MUST equal `main`. If not, fail loudly with: "Expected /Users/pacas/Hell-s-Kitchen-Alchemist-Edition to be on `main`, got `<branch>`. Aborting cron run." Do NOT continue.
3. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition pull --ff-only origin main` — if this fails, surface the exact stderr and STOP.

Only proceed once main is confirmed fast-forwarded (or already up to date).

## Step 1 — Setup
- cd /Users/pacas/Hell-s-Kitchen-Alchemist-Edition
- Get today's date as YYYY-MM-DD and day-of-week.
- Verify `gh auth status` is healthy. If not, fail loudly.

## Step 2 — Read configs
- Read docs/game-design/themes.md → find today's row → capture theme + focus areas + suggested files.
- On Sat/Sun, pick a theme you judge most relevant.
- Read docs/game-design/reference-games.md → pick one game whose "Best for" includes today's theme.
- Fail loudly if either file is missing.

## Step 3 — Find the morning critique
Run:
```
gh issue list --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --label daily-critique --state open --search "[Game Design <today>] in:title" --json number,body --limit 1
```
- If the result is non-empty: capture the issue number and body. The proposal must build on the critique's observations.
- If empty: proceed as a standalone proposal. The "Builds on critique" line in the body becomes "none — standalone proposal".

## Step 4 — Read the suggested code files
- Read the suggested files for today's theme. Look for the cheapest knob that might move the needle on what the critique flagged (or, if standalone, what feels worst).

## Step 5 — Compose the issue body
The body MUST start with this blockquote verbatim (do not paraphrase):

```markdown
> **Implementation note for `@claude implement`:**
> 1. Before writing any code, read the linked critique issue (see "Context" below) in full via `gh issue view <number> --json title,body`. The proposal builds on observations made there; implementing without that context will miss the point.
> 2. If the work is too large for a single PR, split it into sub-issues. Each sub-issue title MUST start with `[Sub-task of #<this-issue-number>]` so the lineage is unambiguous. Apply labels `game-design` and `sub-task`. Link the parent in the sub-issue body. Then implement sub-issues one at a time.

## Context
- Theme: <theme name>
- Builds on critique: #<morning-issue-number>   (or "none — standalone proposal")
- Reference: <game name>

## Idea
<1-2 sentences. Quick-win = parameter/number change implementable in one day.>

## Why it might be fun
<Reasoning, citing the reference game pattern.>

## Scope
- Files to touch: <list>
- Estimated effort: quick

## Risks / open questions
- <What might break or feel worse>
```

## Step 6 — Create the issue
- Title format: `[Game Design <YYYY-MM-DD>] <Theme> — Quick Win: <one-line hook>`
- Write body to mktemp file.
- Run: `gh issue create --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --title "<title>" --label "game-design,proposal-quick" --body-file <tmp>`
- Print the resulting issue URL.

## Constraints
- Estimated effort MUST be "quick" (same-day). If you can only think of larger ideas, scope down to one parameter change.
- Body 150-300 words.
- Cite real file paths from the code you read.
- Do NOT swallow errors.
- Do NOT create a PR or change code.
```

- [ ] **Step 2: Verify**

Use `mcp__scheduled-tasks__list_scheduled_tasks`. Expected: entry with `taskId: game-design-quick-win`, `cronExpression: 0 12 * * *`, enabled.

---

### Task 6: Create scheduled task — 14:00 medium proposal

**Files:**
- Create (via mcp tool): `~/.claude/scheduled-tasks/game-design-medium/SKILL.md`

- [ ] **Step 1: Call the create_scheduled_task MCP tool**

Use `mcp__scheduled-tasks__create_scheduled_task` with:

- `taskId`: `game-design-medium`
- `description`: `Daily 14:00 medium-feature proposal — 1-2 day implementation, builds on morning critique.`
- `cronExpression`: `0 14 * * *`
- `notifyOnCompletion`: `true`
- `prompt`: (paste the entire block below verbatim)

```
You are the AI game designer for Hell's Kitchen Alchemist Edition. Run the daily 14:00 medium-feature proposal.

Repo: wasuioi/Hell-s-Kitchen-Alchemist-Edition
Working directory: /Users/pacas/Hell-s-Kitchen-Alchemist-Edition

A "medium" proposal = a feature implementable in 1-2 focused days. May add new mechanic, new behaviour, new UI element, or a meaningful rework of an existing system. Bigger than a number tweak; smaller than a system overhaul.

## Step 0 — Sync local main from origin (must run before any file read)

The cron may fire before today's overnight changes have been pulled locally. Always fetch and fast-forward `main` first; if anything blocks that, fail loudly.

Run, in order:
1. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition fetch origin main`
2. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition rev-parse --abbrev-ref HEAD` — output MUST equal `main`. If not, fail loudly with: "Expected /Users/pacas/Hell-s-Kitchen-Alchemist-Edition to be on `main`, got `<branch>`. Aborting cron run." Do NOT continue.
3. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition pull --ff-only origin main` — if this fails, surface the exact stderr and STOP.

Only proceed once main is confirmed fast-forwarded (or already up to date).

## Step 1 — Setup
- cd /Users/pacas/Hell-s-Kitchen-Alchemist-Edition
- Get today's date and day-of-week.
- Verify `gh auth status`. Fail loudly otherwise.

## Step 2 — Read configs
- Read docs/game-design/themes.md → today's row.
- Read docs/game-design/reference-games.md → pick a game matching the theme. Prefer one NOT used by today's earlier issues (check via `gh issue list --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --label game-design --state open --search "[Game Design <today>] in:title" --json title,body --limit 5`).
- Fail loudly if either config file is missing.

## Step 3 — Find the morning critique
Run:
```
gh issue list --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --label daily-critique --state open --search "[Game Design <today>] in:title" --json number,body --limit 1
```
- Non-empty: capture issue number + body.
- Empty: proceed standalone.

## Step 4 — Read the suggested code files for today's theme.

## Step 5 — Compose the issue body
The body MUST start with this blockquote verbatim:

```markdown
> **Implementation note for `@claude implement`:**
> 1. Before writing any code, read the linked critique issue (see "Context" below) in full via `gh issue view <number> --json title,body`. The proposal builds on observations made there; implementing without that context will miss the point.
> 2. If the work is too large for a single PR, split it into sub-issues. Each sub-issue title MUST start with `[Sub-task of #<this-issue-number>]` so the lineage is unambiguous. Apply labels `game-design` and `sub-task`. Link the parent in the sub-issue body. Then implement sub-issues one at a time.

## Context
- Theme: <theme name>
- Builds on critique: #<morning-issue-number>   (or "none — standalone proposal")
- Reference: <game name>

## Idea
<1-2 sentences. Medium = 1-2 day feature, new mechanic or meaningful rework.>

## Why it might be fun
<Reasoning, citing the reference game pattern.>

## Scope
- Files to touch: <list>
- Estimated effort: medium

## Risks / open questions
- <What might break or feel worse>
```

## Step 6 — Create the issue
- Title format: `[Game Design <YYYY-MM-DD>] <Theme> — Medium: <one-line hook>`
- Write body to mktemp file.
- Run: `gh issue create --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --title "<title>" --label "game-design,proposal-medium" --body-file <tmp>`
- Print the issue URL.

## Constraints
- Effort MUST be "medium" (1-2 days). If the idea is larger, scope to a self-contained slice.
- Body 150-300 words.
- Cite real file paths.
- Do NOT swallow errors.
- Do NOT create a PR or change code.
```

- [ ] **Step 2: Verify**

Use `mcp__scheduled-tasks__list_scheduled_tasks`. Expected: entry `game-design-medium`, cron `0 14 * * *`, enabled.

---

### Task 7: Create scheduled task — 16:00 big-swing proposal

**Files:**
- Create (via mcp tool): `~/.claude/scheduled-tasks/game-design-big-swing/SKILL.md`

- [ ] **Step 1: Call the create_scheduled_task MCP tool**

Use `mcp__scheduled-tasks__create_scheduled_task` with:

- `taskId`: `game-design-big-swing`
- `description`: `Daily 16:00 big-swing proposal — system-level direction change, builds on morning critique.`
- `cronExpression`: `0 16 * * *`
- `notifyOnCompletion`: `true`
- `prompt`: (paste the entire block below verbatim)

```
You are the AI game designer for Hell's Kitchen Alchemist Edition. Run the daily 16:00 big-swing proposal.

Repo: wasuioi/Hell-s-Kitchen-Alchemist-Edition
Working directory: /Users/pacas/Hell-s-Kitchen-Alchemist-Edition

A "big swing" = a system-level change that could shift the game's identity. New core loop, new pillar, structural rework. Could take a week or more. Even if risky, propose it — the user decides whether to act.

## Step 0 — Sync local main from origin (must run before any file read)

The cron may fire before today's overnight changes have been pulled locally. Always fetch and fast-forward `main` first; if anything blocks that, fail loudly.

Run, in order:
1. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition fetch origin main`
2. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition rev-parse --abbrev-ref HEAD` — output MUST equal `main`. If not, fail loudly with: "Expected /Users/pacas/Hell-s-Kitchen-Alchemist-Edition to be on `main`, got `<branch>`. Aborting cron run." Do NOT continue.
3. `git -C /Users/pacas/Hell-s-Kitchen-Alchemist-Edition pull --ff-only origin main` — if this fails, surface the exact stderr and STOP.

Only proceed once main is confirmed fast-forwarded (or already up to date).

## Step 1 — Setup
- cd /Users/pacas/Hell-s-Kitchen-Alchemist-Edition
- Get today's date and day-of-week.
- Verify `gh auth status`. Fail loudly otherwise.

## Step 2 — Read configs
- Read docs/game-design/themes.md → today's row (or pick freely on Sat/Sun).
- Read docs/game-design/reference-games.md → pick a game matching the theme. Prefer one NOT used by today's earlier issues (check via `gh issue list --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --label game-design --state open --search "[Game Design <today>] in:title" --json title,body --limit 5`).
- Fail loudly if a config file is missing.

## Step 3 — Find the morning critique
Run:
```
gh issue list --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --label daily-critique --state open --search "[Game Design <today>] in:title" --json number,body --limit 1
```

## Step 4 — Read the suggested code files for today's theme. For a big swing, also briefly read the broader game state (skim README, src/types.ts, src/stores/gameStore.ts) to understand current identity before proposing to change it.

## Step 5 — Compose the issue body
The body MUST start with this blockquote verbatim:

```markdown
> **Implementation note for `@claude implement`:**
> 1. Before writing any code, read the linked critique issue (see "Context" below) in full via `gh issue view <number> --json title,body`. The proposal builds on observations made there; implementing without that context will miss the point.
> 2. If the work is too large for a single PR, split it into sub-issues. Each sub-issue title MUST start with `[Sub-task of #<this-issue-number>]` so the lineage is unambiguous. Apply labels `game-design` and `sub-task`. Link the parent in the sub-issue body. Then implement sub-issues one at a time.

## Context
- Theme: <theme name>
- Builds on critique: #<morning-issue-number>   (or "none — standalone proposal")
- Reference: <game name>

## Idea
<1-2 sentences. Big swing = new system, new direction, week+ effort. Be bold.>

## Why it might be fun
<Reasoning, citing the reference game pattern.>

## Scope
- Files to touch: <list, may be partial — big swings often need design work first>
- Estimated effort: big

## Risks / open questions
- <What might break or feel worse — for a big swing, also: what does the game lose if this lands?>
```

## Step 6 — Create the issue
- Title format: `[Game Design <YYYY-MM-DD>] <Theme> — Big Swing: <one-line hook>`
- Write body to mktemp file.
- Run: `gh issue create --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --title "<title>" --label "game-design,proposal-big" --body-file <tmp>`
- Print the issue URL.

## Constraints
- Effort MUST be "big". Don't water down to medium.
- Body 150-300 words. Big swings can lean to the upper end.
- Cite real file paths where relevant.
- Do NOT swallow errors.
- Do NOT create a PR or change code. The output is one issue describing a direction.
```

- [ ] **Step 2: Verify**

Use `mcp__scheduled-tasks__list_scheduled_tasks`. Expected: entry `game-design-big-swing`, cron `0 16 * * *`, enabled. After this task, the list should show all 4 routine entries.

---

### Task 8: Smoke test all 4 scheduled tasks

**Files:** None on disk; state changes on GitHub Issues.

Goal: verify each task produces a correctly-labelled issue with the expected body sections. We'll trigger them manually using the MCP tool (not waiting for cron).

- [ ] **Step 1: Trigger the morning critique**

Two options, in order of preference:

**Option A — wait for cron.** If the next 09:00 (local) is within ~1 hour, just wait. The task will fire automatically and `notifyOnCompletion: true` will surface the result.

**Option B — manual run via Agent.** Use the Agent tool (subagent_type: `general-purpose`) and pass it the exact prompt block from Task 4 verbatim. The subagent will execute the same steps and create the issue. This bypasses the scheduler so it works any time of day.

Either way, wait for completion before continuing.

- [ ] **Step 2: Verify the critique issue**

Run:
```bash
gh issue list --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --label daily-critique --state open --limit 1 --json number,title,labels,body
```

Expected:
- `title` matches `[Game Design YYYY-MM-DD] <Theme> — Critique: ...`
- `labels` contains BOTH `game-design` AND `daily-critique`.
- `body` contains the four headings: `## Theme`, `## Reference`, `## Observation`, `## What's not working`, `## Hypothesis`.

If any expectation fails, read the task session log (mcp__scheduled-tasks should expose history) and fix the prompt before continuing.

- [ ] **Step 3: Trigger and verify each proposal task in order**

For each of `game-design-quick-win`, `game-design-medium`, `game-design-big-swing` IN THE GIVEN ORDER (so each one can find the morning critique created in Step 1):

1. Trigger the task — same two options as Step 1 (wait for cron, or run via Agent with the exact prompt block from Task 5/6/7).
2. Wait for completion.
3. Run:
```bash
gh issue list --repo wasuioi/Hell-s-Kitchen-Alchemist-Edition --label proposal-quick --state open --limit 1 --json number,title,body
# (substitute proposal-medium / proposal-big in turn)
```
4. Expected for each:
   - Title matches `[Game Design YYYY-MM-DD] <Theme> — Quick Win|Medium|Big Swing: ...`.
   - Body STARTS with the `> **Implementation note for \`@claude implement\`:**` blockquote (both numbered points present).
   - Body contains the `## Context`, `## Idea`, `## Why it might be fun`, `## Scope`, `## Risks / open questions` headings.
   - "Builds on critique: #N" references the morning critique issue created in Step 2 (since it ran first).

- [ ] **Step 4: Spot-check sub-issue contract wording**

Open one of the proposal issues and confirm the blockquote includes the literal phrase `[Sub-task of #<this-issue-number>]` — that's the contract that gives sub-issues their parent linkage. If missing or paraphrased, the prompt's "verbatim" instruction wasn't strong enough; tighten it and rerun.

- [ ] **Step 5: Mark smoke test complete**

If all checks pass, you're done. The routine will run automatically tomorrow at 09:00, 12:00, 14:00, 16:00 local time.

If any check fails, capture the failure (issue title, missing headings, wrong labels) and update the relevant prompt in `~/.claude/scheduled-tasks/<taskId>/SKILL.md` (or via `mcp__scheduled-tasks__update_scheduled_task`), then re-run that task's smoke test.
