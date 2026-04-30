# BoilingPoint Perk — Design

**Date:** 2026-04-29
**Status:** Approved
**Issue:** [#8](https://github.com/wasuioi/Hell-s-Kitchen-Alchemist-Edition/issues/8)

## Goal

Add the **BoilingPoint** epic perk: an aggressive, risk/reward system where the player gains "Heat" stacks when taking damage, then dumps all stacks into a single INFERNO cast for a damage spike. The fantasy: pain stokes the pan, the chef cooks with the damage they take.

## Background

The existing perk pool (`src/data/perks.ts`) has 5 perks, mostly passive multipliers. None demand the player intentionally take damage, and none are spell-restricted. BoilingPoint is the first perk that:

- Builds resource over time (Heat stacks)
- Rewards getting hit instead of avoiding it
- Locks the bonus to a single spell type (INFERNO)

The tier-3 infrastructure (per-tier stat tables, `<TierDots>`, `<TierDiff>`) already shipped in PR #22 — no prerequisite refactor needed. `grease_fire` in `src/data/perks.ts:50-58` is the reference implementation for tier shape + reactive trigger.

## Mechanic

### Heat stacks
- Each time the player takes damage from any source → gain **+1 Heat stack**.
- `lastHitAt` resets to `performance.now()` on every hit.
- Heat caps at the tier's max stacks.

### Decay
- Every **4 seconds** without taking damage → lose **1 Heat stack**, reset `lastHitAt`.
- Fixed across all tiers (simpler than the original `3s/5s/5s` proposal — easier to reason about as a player).

### Consume — INFERNO only
- **Only INFERNO** (`CHILI + CHILI`) consumes Heat. All other spells leave Heat untouched.
- On INFERNO cast: multiply `damage` by `(1 + perStackBonus × heatStacks)`, then set `heatStacks = 0`.
- T3: also call `playerStore.heal(consumedStacks)` before clearing.

### Tier progression

| Tier | Max Heat | Damage / stack | Decay | Bonus |
|------|----------|----------------|-------|-------|
| T1 | 5 | +20% | 4s | — |
| T2 | 7 | +20% | 4s | — |
| T3 | 7 | +25% | 4s | Heal +1 HP per stack consumed |

**Damage cap at full Heat:** T1 +100% / T2 +140% / T3 +175%.

### Stack overflow (perk stacks > 3)
Each perk stack beyond T3 adds **+5% per Heat stack** to the per-stack bonus. So 4 stacks of the perk = +30%/Heat (max +210% damage at 7 Heat).

### Anti-synergy / drawback
- INFERNO requires drawing **CHILI + CHILI** in the same cook — not always possible. Heat decays during dry stretches.
- Playing perfectly defensively → Heat never builds → perk does nothing.
- Original FORTRESS/MUD anti-synergy from issue #8 is removed (Heat no longer consumes on those spells), replaced by the recipe-availability constraint above.

## Visual feedback

### On player (continuous, while Heat > 0)

**Stack number above head**
- Position: above the existing HP bar (`<Html>` overlay in `Player.tsx`).
- Shown only when `heatStacks > 0`.
- Color interpolated yellow → red along `heatStacks / maxStacks`.
- CSS shake animation, intensity scales with the same ratio:
  - `< 0.4`: still
  - `0.4–0.7`: light wobble
  - `0.7–1.0`: increasingly violent shake

**Red tint blinking on the wizard model** (starts at stack 5, regardless of tier max)
- Apply emissive red multiply to the GLTF model materials, toggled on/off (blink).
- Blink rate by stack:
  - 5 stacks: ~1 Hz (slow, like a traffic light)
  - 6 stacks: ~2 Hz
  - 7 stacks: ~4 Hz (time bomb)

**Cut from the original proposal:**
- Smoke aura at stacks 3–4 — dropped to keep the visual layers focused. The number indicator carries the "building tension" job from 1–4.

### On consume (one-shot, when INFERNO fires with Heat > 0)

Two sprite-sheet VFX, both custom-generated (not reusing the 5 hand-coded explosion variants):

1. **`boiling_point_consume`** — heat shockwave bursting from the player's position. Crimson + white-hot core, rings of orange embers, fades to dark wisps. ~1s.
2. **`boiling_point_spell`** — heat aura wrapping the INFERNO at its target position. Swirling vortex of red/gold flame, sparks, steam. ~1s.

Both use the existing `SpriteVfxEffect` (6×4 / 24-frame sheet, additive blend on pure-black background). Spawned via `spawnSpriteVfx()`.

The red model tint clears immediately on consume (re-engages on the next hit).

## Asset workflow

All assets land via the existing GitHub Action pipelines on issue #8:

| Asset | Path | Workflow command |
|-------|------|------------------|
| Icon (the cast-iron pan with broken hearts) | `public/icons/boiling_point.png` | `/save-icon boiling_point` + attach PNG |
| Consume VFX | `public/vfx/boiling_point_consume.png` | `/save-vfx boiling_point_consume` + attach MP4 |
| Spell aura VFX | `public/vfx/boiling_point_spell.png` | `/save-vfx boiling_point_spell` + attach MP4 |

MP4 prompts for AI video gen are recorded in the conversation thread for issue #8.

## Implementation

### `src/data/perks.ts`
Add to `PERK_POOL`:
```ts
{
  id: 'boiling_point', name: 'Boiling Point', icon: '/icons/boiling_point.png',
  description: 'Taking damage builds Heat. Your next INFERNO cast consumes all Heat for bonus damage.',
  rarity: 'epic',
  vfxSprite: 'boiling_point_consume',
  tiers: [
    { stats: { Spell: 'INFERNO', 'Max Heat': 5, 'Per Stack': '+20%', Decay: '4.0s' } },
    { stats: { Spell: 'INFERNO', 'Max Heat': 7, 'Per Stack': '+20%', Decay: '4.0s' } },
    { stats: { Spell: 'INFERNO', 'Max Heat': 7, 'Per Stack': '+25%', Decay: '4.0s' }, added: 'Heal +1 HP per Heat stack consumed' },
  ],
}
```

`Spell: INFERNO` is shown on every tier so the spell-restriction stays visible after the player upgrades past T1 (where the description text no longer appears in `<TierDiff>`).

### `src/stores/playerStore.ts`
Extend `PlayerState`:
- Fields: `heatStacks: number`, `lastHitAt: number`
- Actions: `addHeat(maxStacks)`, `consumeHeat(): number` (returns the count consumed, for caller to heal/multiply), `decayHeat(decayMs)`
- In `takeDamage`: read `boiling_point` stack from `useDeckStore`. If > 0, derive `maxStacks` from tier (5 / 7 / 7) and call `addHeat(maxStacks)`.
- In `reset()`: zero out `heatStacks` and `lastHitAt`.

### `src/utils/castSpell.ts`
Inside `buildSpell`, after the `Extra Spicy` block, add a BoilingPoint block guarded by `spellType === 'INFERNO'`:
- Read perk stacks (`perkStacks`). If 0, skip.
- Read `heatStacks` from `playerStore`. If 0, skip.
- Derive `tier = min(perkStacks, 3)` and:
  - `basePerStack = [0.20, 0.20, 0.25][tier - 1]`
  - `overflow = max(0, perkStacks - 3) * 0.05`
  - `perStack = basePerStack + overflow`
- `damage = damage × (1 + perStack × heatStacks)`
- If T3, call `playerStore.heal(heatStacks)` before consuming.
- Call `consumeHeat()`.
- Spawn the two sprite VFX: `boiling_point_consume` at player position, `boiling_point_spell` at target position.

### `src/components/Player.tsx`
- In the existing `useFrame`, add the decay tick: read perk stacks → compute decay window → call `decayHeat(4000)`.
- Subscribe to `heatStacks` via `usePlayerStore((s) => s.heatStacks)`.
- Above the HP bar `<Html>`, render a second `<Html>` with the stack number when `heatStacks > 0`. Color interpolation + shake CSS keyed off `heatStacks / maxStacks`.
- Tint blink: when `heatStacks >= 5`, run a `useFrame` timer that toggles a boolean at the stack-derived rate; when on, traverse the wizard `scene` and multiply the materials' emissive by red. When off (or `heatStacks < 5`), restore. Cache original emissive once in a `useRef` to avoid drift.

### Reward card layout change — affects all perks

This applies to every perk card, not just BoilingPoint. Bundled with this spec because BoilingPoint's spell-restriction makes the card's information density a more pressing concern (one extra stat row), and the redesign frees vertical space for that.

**Current layout (each card):**
1. `EPIC` (or `RARE` / `COMMON` / `LEGENDARY`) — small uppercase label tinted by rarity
2. PerkIcon (72px)
3. Perk name — white bold 17px
4. TierDiff body
5. TierDots

**New layout:**

The rarity label is removed. The perk name takes its slot at the top of the card (still inside the border), colored with `RARITY_COLOR[perk.rarity]` so rarity is still readable at a glance.

```
┌──────────────────────────────┐
│       Boiling Point          │   ← name at top, colored by rarity (purple for epic)
│                              │
│           🍳                 │   ← icon
│                              │
│   [stat rows]                │
│                              │
│   + added line               │
│                              │
│          ● ● ●               │
└──────────────────────────────┘
```

Order inside the button:
1. **Perk name** — bold (~22px), `RARITY_COLOR[perk.rarity]`. Takes the slot the rarity label used to occupy.
2. PerkIcon (72px)
3. TierDiff body
4. TierDots

The rarity is still readable from the border + glow + name color (gray / blue / purple / gold), so the explicit text label is redundant.

**Files affected:**
- `src/ui/RewardScreen.tsx` — replace lines 88-95 (the rarity span + name span pair) with a single colored name span at the top.
- `src/ui/DevPanel.tsx` — same change at lines 95-102.

The two files share the layout intentionally (DevPanel mirrors RewardScreen so dev iteration matches the real reward flow — see the comment block at the top of `DevPanel.tsx`). Keep them in sync.

This layout pattern (name-as-rarity-colored, no separate rarity label) will also be propagated to the perk-ideation routine prompt at `.claude/routine-prompts/perk-ideation.md` later, so future generated perk proposals describe their reward card with this convention.

### Tests (`src/__tests__/`)
- `addHeat` caps at the passed `maxStacks`.
- `decayHeat` removes 1 stack only when `now - lastHitAt > decayMs`, and resets `lastHitAt` after ticking.
- `castSpell('INFERNO')` with Heat > 0 multiplies damage and zeroes Heat. `castSpell('TIDAL_WAVE')` with Heat > 0 leaves Heat untouched.
- T3 + `castSpell('INFERNO')` with Heat > 0 heals by the consumed count.
- Per-tier multipliers: T1 with 5 Heat = ×2.0 damage. T3 with 7 Heat = ×2.75. Overflow (4 perk stacks, 7 Heat) = ×3.10.
- `playerStore.reset()` clears Heat.

## Out of scope

- Aura particles around the player at stacks 3–4 (smoke) and 5–7 (steam). Cut to keep the visual layers focused.
- HUD-side Heat display (icon + stack count in a corner). The above-player number is the only Heat readout for now.
- Persistent post-run unlocks / metaprogression around BoilingPoint.
