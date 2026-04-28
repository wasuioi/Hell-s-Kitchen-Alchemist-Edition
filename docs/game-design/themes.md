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
