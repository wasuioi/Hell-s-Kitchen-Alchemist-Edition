# Run Progression & Spell Evolution Design

**Date:** 2026-05-03
**Status:** Draft — pending implementation plan
**Owner:** wasu

## Problem

The current run loop is fully predictable: `menu → wave 1 → reward → wave 2 → reward → ... → wave 7 → boss → end`. Every run unfolds the same way. The two specific pain points the player identified:

- **(A) Encounter sameness** — every wave spawns the same mix of `slow` / `fast` / `tanky` / `exploder` enemies. Tactics don't change wave-to-wave.
- **(D) Stagnant spell pool** — the 6 recipes (`INFERNO`, `TIDAL_WAVE`, `SALT_SPEED`, `STEAM`, `METEOR`, `MUD`) are locked from wave 1. They get no stronger and no more diverse over the course of a run.

The player explicitly wants the run to feel like an **adventure with discovery** ("ใฝ่รู้ใฝ่เห็น") — surprise about what comes next — and a **risk/reward dial** ("ยิ่งเสี่ยงตาย ยิ่งเก่ง") where opting into harder fights yields stronger payoffs.

## Goals

1. Each wave should *feel* different — different spawn composition or different objective — not just "more enemies, same fight."
2. The player's spell arsenal should evolve over the course of a run, with player-driven choices that shape the build.
3. The player should have explicit risk/reward agency before each wave: opt into harder content for better rewards.
4. Reuse the existing wave / hazard / reward architecture wherever possible. No structural rewrites.

## Non-goals

- **Meta-progression / persistence across runs.** Everything resets when the run ends. No localStorage, no unlock currency, no pre-run setup screen. (The artifact system discussed separately may revisit this later.)
- **Branching map / node-based path.** The 7-wave + boss linear structure stays.
- **New ingredients.** The 3-ingredient cauldron (`CHILI` / `BOTTLE` / `SALT`) and 6-recipe matrix stay untouched. Spell variety comes from *evolution*, not new combinations.
- **Permanent recipe-book unlocks.** Evolutions are run-only; the next run starts with the 6 base spells again.

---

## Design Overview

Three interlocking systems, all surfaced through a redesigned between-wave **Rest Room** hub:

1. **Risk Tier System** — before each wave (from wave 2 onward), the player picks one of 3 difficulty tiers. Higher tier = harder enemies + better rewards.
2. **Wave Variety** — within a tier, the actual wave variant (Standard / Swarm / Elite / Hunter / Survival) is randomized and revealed only when the wave starts. Tier choice is informed; variant flavor is surprise.
3. **Spell Evolution** — Spicy and Hellfire tiers grant Evolution Tokens. Tokens let the player evolve a base spell into one of 3 branches, replacing it for the rest of the run.

The Rest Room is the hub between waves where all of this is presented.

---

## System 1 — Risk Tier

### Tiers

| Tier | Wave Modifier | Boss Modifier | Reward |
|---|---|---|---|
| 🥄 **Mild** | wave plays as it does today | boss plays as it does today | perk pick (3 cards — existing) |
| 🌶️ **Spicy** | enemies +25% speed, +1 elite spawn, hazard tier +1 | boss HP +50%, swarm minion every 30s | perk pick + **1 common Evolution Token** |
| 🔥 **Hellfire** | enemies +50% speed, +2 elite spawn, hazard tier +2, mid-wave reinforcement +1 | boss HP +100%, hunter chase + swarm reinforcement | perk pick + **1 rare Evolution Token** |

### Rules

- **Wave 1 has no tier choice** — fixed Standard intro so new players learn base mechanics.
- **Tier choice happens in the Rest Room** (between waves), as one of the panels.
- **Boss wave also has tier choice** — the player can opt into a harder boss for the most lucrative final reward.
- **Mild must be a viable full-run path.** A risk-averse player can play Mild every wave and complete the run, just without evolved spells. Mild is not a trap.
- **Hellfire must carry real risk.** It must be possible to die on Hellfire even with strong perks. It is not a no-brainer.

### Open balance question

`+25% / +50%` enemy speed and `+1 / +2` elite counts are starting numbers. Final values come from playtest. The spec freezes the *shape* of the tier system, not the exact magnitudes.

---

## System 2 — Wave Variety

Each wave (after wave 1) rolls a random **variant** within the chosen tier. The variant is hidden until the wave starts; a banner reveals it: `🌶️ SPICY · SWARM WAVE`.

### Variants

| Variant | Behavior |
|---|---|
| `Standard` | current spawn mix (slow/fast/tanky/exploder, normal counts) |
| `Swarm` | spawn count ×2, each enemy HP ÷2 — pushes player toward AoE spells |
| `Elite` | fewer enemies but 2-3 elite tanky/fast variants — pushes single-target |
| `Hunter` | normal mix + 1 fast `hunter` enemy that always paths toward the player; does not respawn on death — pushes kiting |
| `Survival` | no kill objective — survive a 30-second timer while spawns escalate; remaining enemies despawn when timer hits |

### Tier → variant pool

| Tier | Pool |
|---|---|
| 🥄 Mild | `Standard` only |
| 🌶️ Spicy | `Standard`, `Swarm`, `Elite` |
| 🔥 Hellfire | `Swarm`, `Elite`, `Hunter`, `Survival` |

### Why hide the variant

The player explicitly chose tier (informed risk decision). Variant being hidden preserves **discovery** — every wave start has a "what is it this time?" moment. This separates opt-in to risk (transparent) from encounter flavor (surprise).

### Boss wave variants

The boss is the same boss; variant is on the *minion layer* surrounding it (see tier table above). No separate variant roll for boss waves.

---

## System 3 — Spell Evolution

### Tokens

- **Common Token** (from Spicy reward) — unlocks the **common branch** of any base spell.
- **Rare Token** (from Hellfire reward) — unlocks **any branch** (common or rare) of any base spell.

This creates a clean gold hierarchy: the strongest, most playstyle-changing branches require Hellfire-level risk.

### Evolution rules

- Each base spell has **3 branches**: 1 common + 2 rare. 18 branches total across 6 spells.
- Evolving a spell **replaces the base** for the rest of the run. Casting `CHILI+CHILI` after evolving `INFERNO → VOLCANO` produces `VOLCANO`, not `INFERNO`.
- A spell can be evolved **once per run**. There is no re-evolve and no branch swap.
- **Tokens carry over.** If the player skips the evolution screen this Rest Room, the token stays in their pool for next Rest Room. They can wait for the spell they want to evolve to come up.
- Max evolutions per run = 6 (one per base spell). Realistic = 3-5 based on token economy.

### The 18 branches

Common branches tweak base parameters (radius, duration). Rare branches introduce new behavior (DoT pools, pulls, knockback, chains).

#### INFERNO (base: 40 dmg, radius 5, duration 0.5s)

| Branch | Tier | Effect |
|---|---|---|
| 🥉 BLAZE | common | radius 7 (was 5), damage unchanged — clear swarms |
| 🥇 VOLCANO | rare | leaves a fire pool for 3s dealing 10 dmg/s — damage zone |
| 🥇 BACKDRAFT | rare | pulls enemies inward for 0.3s, then explodes for 40 dmg — clump kill |

#### TIDAL_WAVE (base: 15 dmg, radius 7, duration 0.8s)

| Branch | Tier | Effect |
|---|---|---|
| 🥉 TSUNAMI | common | knocks all hit enemies back 4 units |
| 🥇 WHIRLPOOL | rare | pulls enemies to center, then deals 30 dmg burst — anti-spread |
| 🥇 STORMFRONT | rare | chains lightning between hit enemies for 15 dmg each (synergy with `soaked` status) |

#### SALT_SPEED (base: speed +20% for 3s, no damage)

| Branch | Tier | Effect |
|---|---|---|
| 🥉 BRINE_RUSH | common | buff lasts 4.5s instead of 3s |
| 🥇 SODIUM_SHIELD | rare | adds 1s of player invulnerability on cast |
| 🥇 SALTSTORM | rare | leaves a salt trail behind the player, 5 dmg/s on enemies that touch it |

#### STEAM (base: stun, no damage, radius 5, duration 1s)

| Branch | Tier | Effect |
|---|---|---|
| 🥉 BOIL | common | stun duration 2s instead of 1s |
| 🥇 SCALDING | rare | adds 8 dmg/s DoT while stunned |
| 🥇 PRESSURE | rare | radius 7 + knocks enemies back 3 units |

#### METEOR (base: 80 dmg, radius 2, duration 0.3s)

| Branch | Tier | Effect |
|---|---|---|
| 🥉 COMET | common | adds 30 dmg line damage along the travel path |
| 🥇 METEOR_SHOWER | rare | spawns 3 smaller meteors (35 dmg each, radius 2) instead of 1 |
| 🥇 CRATER | rare | the meteor leaves a fire pool for 4s dealing 12 dmg/s |

#### MUD (base: slow, no damage, radius 4, duration 5s)

| Branch | Tier | Effect |
|---|---|---|
| 🥉 SWAMP | common | radius 6 instead of 4 |
| 🥇 QUICKSAND | rare | enemies in mud are slowly pulled toward center |
| 🥇 TARPIT | rare | adds 6 dmg/s DoT to enemies in mud |

---

## System 4 — Rest Room (between-wave hub)

### Concept

After each wave (and after wave 1), the player enters a **Rest Room** — a relaxed UI hub with multiple panels they can interact with in any order. They press **"▶ Begin Wave N"** when ready.

This replaces the current "reward → next wave" sequential modal. It is designed to be **expandable** — future features (artifact slot, shop, NPC dialogue) drop in as new panels without rewriting the flow.

### MVP Rest Room panels

| Panel | Required to advance? | Behavior |
|---|---|---|
| `PerkPanel` | optional | 3 perk cards — pick one, or skip |
| `TierPanel` | **required** | 3 tier cards — pick one (Mild/Spicy/Hellfire), highlights when chosen |
| `RecipeBookPanel` | optional | view current recipes (with evolved names + 🌟 if evolved) |
| `BeginWaveButton` | — | disabled until tier is chosen |

### Phase 2 panels (when token system ships)

- `EvolutionPanel` — visible only if the player holds ≥1 Evolution Token. Shows token count + opens evolution picker.

### Phase 3+ panels (deferred)

- `ArtifactPanel` — the system from the parallel artifact discussion
- `StatsPanel`, `SettingsPanel` — quality-of-life
- Anything else is just another panel — the Rest Room is intentionally a hub

### Layout sketch (not final)

```
┌──────────────────────────────────────────────────┐
│              REST ROOM — Between Waves           │
├──────────────┬───────────────────┬───────────────┤
│              │                   │               │
│  PerkPanel   │   TierPanel       │  RecipeBook   │
│  (3 cards)   │   (3 cards)       │  (6 spells)   │
│              │                   │               │
├──────────────┴───────────────────┴───────────────┤
│              ▶ Begin Wave 3 (Spicy)              │
└──────────────────────────────────────────────────┘
```

---

## Architecture

### New types (`src/types.ts`)

```ts
export type WaveTier = 'mild' | 'spicy' | 'hellfire'
export type WaveVariant = 'standard' | 'swarm' | 'elite' | 'hunter' | 'survival'
export type EvolutionTokenTier = 'common' | 'rare'

export interface EvolutionBranch {
  id: string                     // 'volcano', 'meteor_shower', etc.
  name: string                   // display name
  tier: 'common' | 'rare'
  baseSpell: SpellType
  description: string
}

export interface EvolutionToken {
  tier: EvolutionTokenTier
}
```

### Data files

| File | Purpose |
|---|---|
| `src/data/recipes.ts` | extend with `EVOLUTION_BRANCHES: Record<SpellType, EvolutionBranch[]>` (18 entries) |
| `src/data/waves.ts` (NEW) | wave variant configs (`spawnCountMultiplier`, `enemyHpMultiplier`, `extraSpawnTypes`, `survivalDurationMs`) and tier modifier table |

### Stores

| File | Change |
|---|---|
| `src/stores/gameStore.ts` | rename `phase: 'reward'` → `phase: 'rest'`. Add `currentTier: WaveTier \| null`, `currentVariant: WaveVariant \| null`, `pendingTokens: EvolutionToken[]`. |
| `src/stores/playerStore.ts` | add `evolvedSpells: Partial<Record<SpellType, string>>` (mapping base → branch id) |

### Logic

| File | Change |
|---|---|
| `src/utils/castSpell.ts` | check `playerStore.evolvedSpells[spellType]`; if set, dispatch the branch's behavior overrides |
| `src/utils/spawnEnemies.ts` (or current spawn site) | apply `currentTier` modifiers (speed, elite count, hazard tier, reinforcement) and `currentVariant` rules (spawn count, HP multiplier, hunter spawn, survival timer) |

### UI components

| File | Change |
|---|---|
| `src/ui/RestRoom.tsx` (NEW) | hub layout, hosts panels, owns `Begin Wave` button |
| `src/ui/PerkPanel.tsx` (NEW or extracted from existing `RewardScreen`) | 3 perk cards |
| `src/ui/TierPanel.tsx` (NEW) | 3 tier cards, locks selection in `gameStore.currentTier` |
| `src/ui/RecipeBookPanel.tsx` | reuse / wrap existing in-game recipe book; show 🌟 on evolved spells |
| `src/ui/EvolutionPanel.tsx` (NEW, phase 2) | token count + opens picker |
| `src/ui/EvolutionPickerModal.tsx` (NEW, phase 2) | spell grid → branch picker |
| `src/ui/RewardScreen.tsx` | deprecated — content moves into `RestRoom` panels |

### Game phase flow

```
menu
  → combat (wave 1, fixed Standard, no tier)
  → rest (RestRoom: PerkPanel + TierPanel + RecipeBookPanel)
  → combat (wave 2, with chosen tier + random variant)
  → rest
  → ... (repeat for waves 3-7) ...
  → rest (last one — tier choice for boss)
  → boss (with chosen tier modifier on boss + minions)
  → victory / death
```

---

## Phasing (for implementation plan)

### Phase 1 — MVP Rest Room + Risk Tier

- New `phase: 'rest'` + `<RestRoom />` component
- `PerkPanel`, `TierPanel`, `RecipeBookPanel` (Recipe Book wraps existing)
- `BeginWaveButton`
- `WaveTier` types + tier modifier application on regular waves (speed, elite count, hazard tier)
- **No wave variants yet** — every wave is `Standard`. Tier only affects difficulty multipliers.
- **No evolution tokens yet** — token + evolution rewards come in phase 2.
- **No boss tier choice yet** — the Rest Room before the boss shows only `PerkPanel` + `RecipeBookPanel` + `BeginWaveButton`. Boss tier choice + boss-specific tier modifiers ship in phase 2.

**Phase 1 reward differentiation (to make tier choice meaningful before tokens exist):**
- 🥄 Mild: pick 1 perk from **3** options
- 🌶️ Spicy: pick 1 perk from **4** options (better odds of useful perk)
- 🔥 Hellfire: pick **2** perks from **4** options (double-dip)

This gives players a real reason to opt into risk during phase 1. When phase 2 ships, the perk-count differential reverts to a flat "1 of 3 each" + tokens take over as the primary differentiator.

The point of phase 1: ship the *choice loop* and prove the Rest Room shape works.

### Phase 2 — Spell Evolution + Wave Variants

- `EvolutionToken` + `EvolutionBranch` types and the 18 branches in `recipes.ts`
- `EvolutionPanel` + `EvolutionPickerModal`
- `playerStore.evolvedSpells` + `castSpell.ts` branch dispatch
- Recipe Book shows 🌟 on evolved spells
- Wave variants: `Swarm`, `Elite`, `Hunter` (defer `Survival` if scope tight)
- Boss tier modifier (HP scaling + minion layer)

### Phase 3 — Polish & balance

- `Survival` variant if not already shipped
- Variant reveal banner (`🌶️ SPICY · SWARM WAVE`)
- Number tuning across all tiers and branches
- VFX polish for evolved spells

---

## Open questions

- **Token economy.** If the player picks Hellfire every wave from wave 2, they earn 6 rare tokens before the boss + 1 for the boss = 7 total. That's enough to evolve every spell. Is that desired ceiling? (Probably yes — but flag for phase 2 balance.)
- **Dead common tokens.** Common tokens unlock common branches only. If the player has already evolved all 6 common branches but still holds a common token, the token becomes unusable. Likely rare in practice (would need 6 Spicy waves with no Hellfire), but consider: should an unusable common token auto-upgrade to rare, or just sit dead? (Defer to phase 2 balance.)
- **Recipe Book panel size.** The existing in-HUD recipe book is small. In the Rest Room, do we show a larger version with more detail (icons, descriptions), or just embed the same compact view? (Defer to phase 1 implementation.)
- **`Survival` variant theme.** "Enemies despawn when 30s timer hits" feels arcade-y for a kitchen game. Possibly reframe as "the cauldron is heating — survive until it boils over." (Cosmetic decision, doesn't affect spec.)

## Success criteria

- A run feels meaningfully different from the previous run because tier choices and variant rolls diverged.
- The player can articulate, after a run, *what build they were going for* (e.g., "I evolved INFERNO and METEOR into AoE branches, played Hellfire from wave 4").
- The Rest Room can host the future `ArtifactPanel` without flow changes.
- Mild-only runs are completable; Hellfire runs carry real death risk.
