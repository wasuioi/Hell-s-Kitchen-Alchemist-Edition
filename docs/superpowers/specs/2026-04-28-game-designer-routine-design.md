# Game Designer Routine — Design Spec

Date: 2026-04-28

## Goal

A daily routine of 4 scheduled tasks that act as an AI game designer for Hell's Kitchen Alchemist Edition. Each run reads the project, picks a focused angle (rotating theme + reference game), and produces a GitHub issue containing critique or proposal text.

The intent is twofold:
1. **Critique** — surface what isn't fun yet, by comparing the current implementation against patterns from established games.
2. **Proposals** — generate concrete change ideas at three risk levels (quick win, medium feature, big swing), so the developer always has a backlog of design directions to pick from.

## Non-goals

- Not auto-implementing changes. The routine writes issues; the developer decides what to act on.
- Not exhaustive game-balance simulation. Output is qualitative critique, not numeric tuning derived from playtests.
- Not multi-day memory. Each day's critique/proposals chain only within the same day.

## Architecture

Two layers, decoupled:

**Layer 1 — Config files in repo (source of truth):**
- `docs/game-design/themes.md` — weekly theme rotation table (Mon-Sun) with focus areas and suggested files to read.
- `docs/game-design/reference-games.md` — library of reference games with strengths and which themes each best informs.

**Layer 2 — Scheduled tasks (managed by `mcp__scheduled-tasks`):**

| Task ID | Time (local) | Issue type | Lens |
|---------|-------------|-----------|------|
| `game-design-critique` | 09:00 daily | `daily-critique` | "What's not fun yet? What's missing? How does the reference game handle this differently?" |
| `game-design-quick-win` | 12:00 daily | `proposal-quick` | "What number/parameter could change today and produce a noticeable improvement?" |
| `game-design-medium` | 14:00 daily | `proposal-medium` | "What 1-2 day feature would shift the experience?" |
| `game-design-big-swing` | 16:00 daily | `proposal-big` | "What new system or direction would change the game's identity?" |

Tasks are stored as `~/.claude/scheduled-tasks/{taskId}/SKILL.md` files. Each runs in its own session.

### Per-run flow

1. `cd /Users/pacas/Hell-s-Kitchen-Alchemist-Edition` (main repo, not the worktree).
2. Determine current date and day-of-week.
3. Read `docs/game-design/themes.md` → extract today's theme + focus areas + suggested files. On Sat/Sun (free critique), the task picks any theme it judges most relevant given the recent code changes.
4. Read `docs/game-design/reference-games.md` → pick one game whose "Best for" includes today's theme. If multiple match, pick one not used yet today (look at any earlier same-day issues via `gh issue list`); otherwise pick whichever the task judges most relevant.
5. Read the suggested code files for context.
6. **Proposal tasks only (12/14/16):** find the morning critique issue using `gh issue list --label daily-critique --state open --search "[Game Design <today>] in:title" --json number,body --limit 1`, then use the returned `body` as input. If the list is empty, proceed without it.
7. Compose the issue body using the template for the task type.
8. `gh issue create --title "..." --label "game-design,<type-label>" --body-file <tmp>`.

### Cwd & repo target

- Tasks operate against the main repo at `/Users/pacas/Hell-s-Kitchen-Alchemist-Edition`, not against any worktree.
- `gh` operates against `wasuioi/Hell-s-Kitchen-Alchemist-Edition` (resolved automatically from the repo's git remote).

## Issue format

### Title

```
[Game Design YYYY-MM-DD] <Theme> — <Type>: <one-line hook>
```

Examples:
- `[Game Design 2026-04-28] Combat feel — Critique: knockback feels weightless against tanky enemies`
- `[Game Design 2026-04-28] Combat feel — Quick Win: scale knockback by enemy weight`

### Body — critique (09:00)

```markdown
## Theme
<theme name>

## Reference
<game name> — <one-line strength>

## Observation
<What's currently in the code, briefly. Cite files/lines.>

## What's not working
- <Issue 1, with file:line reference>
- <Issue 2>

## Hypothesis
<Why it isn't fun yet. Compare to how the reference game solves this.>
```

### Body — proposal (12:00 / 14:00 / 16:00)

```markdown
## Theme & link
<theme name> · uses critique from #<morning-issue-number>
(omit the "uses critique from" clause if no morning critique exists)

## Idea
<1-2 sentences>

## Why it might be fun
<Reasoning, citing the reference game pattern.>

## Scope
- Files to touch: <list>
- Estimated effort: <quick / medium / big>

## Risks / open questions
- <What might break or feel worse>
```

Target length: 150-300 words per issue. Scannable, not essay-length.

### Labels

Created once during setup:

| Label | Color | Purpose |
|-------|-------|---------|
| `game-design` | `#0e8a16` (green) | Umbrella label on every routine-generated issue |
| `daily-critique` | `#1d76db` (blue) | 09:00 critique issues |
| `proposal-quick` | `#fbca04` (yellow) | 12:00 quick-win proposals |
| `proposal-medium` | `#d93f0b` (orange) | 14:00 medium-feature proposals |
| `proposal-big` | `#5319e7` (purple) | 16:00 big-swing proposals |

Every routine issue carries `game-design` plus exactly one type label.

## Config files

### `docs/game-design/themes.md`

```markdown
# Daily Theme Rotation

| Day | Theme | Focus areas | Suggested code to read |
|-----|-------|-------------|------------------------|
| Mon | Combat feel | impact, hit-stop, knockback, audio/visual feedback | src/components/Enemy.tsx, src/components/Player.tsx, src/components/Spell.tsx, src/components/DamageNumbers.tsx |
| Tue | Spell variety | 6 spells from 3 ingredients, recipe combos, synergy | src/data/recipes.ts, src/components/Spell.tsx, src/types.ts |
| Wed | Enemy design | 5 types (slow/fast/tanky/boss/exploder), threat curve | src/components/EnemyManager.tsx, src/components/Boss.tsx, src/stores/enemyStore.ts |
| Thu | Pacing & waves | wave length, escalation, boss intro, downtime | src/stores/gameStore.ts, src/components/Arena.tsx |
| Fri | Meta progression | perks, run-to-run, deck building | src/data/perks.ts, src/stores/deckStore.ts, src/stores/playerStore.ts |
| Sat | Free critique | pick whatever feels most needed | — |
| Sun | Free critique | — | — |
```

### `docs/game-design/reference-games.md`

```markdown
# Reference Games

Each entry: what it does well + which themes it best informs.

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
```

## Edge cases

- **Morning critique missing when proposal task fires** (e.g. 09:00 task failed): proposal task proceeds without the critique reference, omitting the "uses critique from" line.
- **Config file missing**: task fails loudly with a message instructing the developer to restore the file. Does not silently skip.
- **`gh` not authed**: task fails loudly. Does not silently skip.
- **Free-critique day (Sat/Sun)**: task picks any theme + reference combination it judges most useful, ideally one that hasn't been covered earlier in the week (best-effort, not enforced — no past-issue lookup beyond the same day).
- **Repo on a non-main branch**: tasks read from the working tree as-is. They do not check out branches or stash work.

## Setup steps (one-time)

1. Create the 5 GitHub labels via `gh label create`.
2. Write the two config files at `docs/game-design/themes.md` and `docs/game-design/reference-games.md`.
3. Create the 4 scheduled tasks via `mcp__scheduled-tasks__create_scheduled_task` with the cron expressions and prompts described above.
4. Smoke test: trigger each of the 4 tasks once on demand (ad-hoc invoke), verify each creates an issue with the correct labels, title format, and body sections.

## Testing

- **Smoke test (manual):** trigger each task once after setup and verify issue creation. Acceptance: 4 issues exist with correct title format, both labels, and a body containing the expected sections.
- **No automated tests.** This is an operational routine, not application code. The cost of a stub-test harness around `gh` outweighs the benefit; a single manual smoke test per task is sufficient.

## Out of scope (YAGNI)

- Auto-closing old issues — the developer closes irrelevant ones manually.
- Deduplication against past issues — repetition is acceptable; closing is the dedup mechanism.
- Telegram or other notification integration — Claude Code's built-in `notifyOnCompletion` is enough for now.
- Automatic PR or branch creation from a proposal — conversion to a spec/PR remains a manual step.
- Cross-day context (reading the previous day's critique) — same-day chaining only in v1.
- Per-issue priority scoring or roadmap auto-organisation.

## Risks

- **Issue volume:** 4 issues × 7 days = 28 issues per week. Without discipline to close stale ones, the issue list will become hard to scan. Mitigation: routine relies on the developer triaging weekly.
- **Silent failure in background:** if `gh` auth lapses, tasks will fail and only `notifyOnCompletion` surfaces it. The developer must notice the missing daily issue. Acceptable risk in v1.
- **Repetitive output:** with a fixed weekly rotation, the same theme returns every Monday. Variety relies on (a) the reference-game library expanding over time, and (b) the codebase actually changing between runs. If the codebase is static for a week, expect repetition.
