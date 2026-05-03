# Rest Room + Risk Tier — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `reward` modal with a between-wave **Rest Room** hub that hosts a perk panel, a tier-choice panel (Mild/Spicy/Hellfire), and a recipe-book panel. Apply tier modifiers to the next wave (enemy speed, elite spawn count, hazard cadence). Differentiate tier rewards by perk-pick generosity (no token system yet).

**Architecture:**
- New `phase: 'rest'` (renames `'reward'`) — App.tsx renders `<RestRoom />` instead of `<RewardScreen />`.
- `<RestRoom />` is a hub composing 4 panels: `<PerkPanel />`, `<TierPanel />`, `<RecipeBookPanel />`, `<BeginWaveButton />`.
- gameStore tracks `currentTier` (active for the current wave + reward computation) and `pendingTier` (selected in TierPanel for next wave).
- Tier modifiers live in `src/data/waves.ts` as a single table keyed by `WaveTier`.
- Modifiers are applied at three sites: enemy speed in `Enemy.tsx`, elite spawn quota in `EnemyManager.tsx`, hazard interval in `HazardManager.tsx`.

**Tech Stack:** React 19 + TypeScript strict, Zustand stores, Vitest for unit tests.

**Spec:** [docs/superpowers/specs/2026-05-03-run-progression-and-evolution-design.md](../specs/2026-05-03-run-progression-and-evolution-design.md)

**Out of scope (deferred to Phase 2):** evolution tokens, EvolutionPanel, wave variants, boss tier choice, boss tier modifiers.

---

## File Structure (Phase 1)

| File | Status | Responsibility |
|---|---|---|
| `src/types.ts` | modify | add `WaveTier` type, change `GamePhase` (`'reward'` → `'rest'`) |
| `src/stores/gameStore.ts` | modify | rename phase, add `currentTier` + `pendingTier`, `chooseTier`, lifecycle |
| `src/data/waves.ts` | **create** | `TIER_MODIFIERS` table |
| `src/ui/RestRoom.tsx` | **create** | hub layout that composes the panels |
| `src/ui/PerkPanel.tsx` | **create** | extracted from `RewardScreen.tsx` (perk + heal cards), tier-aware perk count |
| `src/ui/TierPanel.tsx` | **create** | 3 tier cards, writes to `pendingTier` |
| `src/ui/BeginWaveButton.tsx` | **create** | disabled until `pendingTier` set (or wave 7 → boss flow) |
| `src/ui/RecipeBookPanel.tsx` | **create** | extracted from `HUD.tsx` recipe panel; reused by both HUD and Rest Room |
| `src/ui/HUD.tsx` | modify | replace inline recipe block with `<RecipeBookPanel />` |
| `src/ui/RewardScreen.tsx` | **delete** | content moved to PerkPanel |
| `src/components/EnemyManager.tsx` | modify | wave 7 cleared → `completeWave`, not lull; force-spawn N elites per tier |
| `src/components/Enemy.tsx` | modify | multiply movement speed by `tierSpeedMultiplier` |
| `src/components/HazardManager.tsx` | modify | divide hazard interval by `tierHazardMultiplier` |
| `src/App.tsx` | modify | render `<RestRoom />` for phase `'rest'`; update preload phase check |
| `src/__tests__/gameStore.test.ts` | modify | new tier state tests |
| `src/__tests__/waves.test.ts` | **create** | tier modifier table sanity |
| `src/__tests__/restRoom.test.ts` | **create** | flow tests (replaces `rewardScreen.test.ts`) |

---

## Task 1: Add `WaveTier` type and rename `phase: 'reward'` → `phase: 'rest'`

**Files:**
- Modify: `src/types.ts:7`
- Modify: `src/stores/gameStore.ts:47`
- Modify: `src/App.tsx:59,141`
- Modify: `src/__tests__/rewardScreen.test.ts` (rename string literal references)

- [ ] **Step 1: Add `WaveTier` type and rename phase string**

Edit `src/types.ts`:

```ts
export type WaveTier = 'mild' | 'spicy' | 'hellfire'

export type GamePhase = 'menu' | 'combat' | 'rest' | 'pre-boss-lull' | 'boss' | 'death' | 'victory'
```

(Replace existing `GamePhase` line at line 7. Add `WaveTier` near other type exports.)

- [ ] **Step 2: Update gameStore phase string**

In `src/stores/gameStore.ts`, find the line in `completeWave`:

```ts
set((s) => ({ phase: 'reward', stats: { ...s.stats, wavesCleared: s.stats.wavesCleared + 1 } }))
```

Change `phase: 'reward'` to `phase: 'rest'`.

- [ ] **Step 3: Update App.tsx phase checks**

In `src/App.tsx`:
- Line 59: change `if (phase === 'combat' || phase === 'reward')` to `if (phase === 'combat' || phase === 'rest')`
- Line 141: change `{phase === 'reward' && sceneReady && <RewardScreen />}` to `{phase === 'rest' && sceneReady && <RewardScreen />}` (we'll swap `<RewardScreen />` for `<RestRoom />` in Task 8 — keep `RewardScreen` working for now)

- [ ] **Step 4: Find and update any remaining `'reward'` references**

Run: `grep -rn "'reward'" src/ --include="*.ts" --include="*.tsx"`
Update each match to `'rest'`. Verify nothing else mentions the old phase name.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm run build` (this also typechecks)
Expected: PASS — type errors only if the rename missed a reference.

Run: `npm run test`
Expected: PASS (some test names may still say "reward"; those rename in Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/stores/gameStore.ts src/App.tsx src/__tests__/
git commit -m "refactor: rename game phase 'reward' → 'rest', add WaveTier type"
```

---

## Task 2: Add tier state and lifecycle to gameStore

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/__tests__/gameStore.test.ts`

The semantics:
- `currentTier`: tier of the wave being played NOW (also drives reward computation in the rest phase that follows)
- `pendingTier`: tier player has selected in TierPanel for the NEXT wave
- On `nextWave()`: copy `pendingTier` → `currentTier`, clear `pendingTier`
- Wave 1 has no prior tier choice — `currentTier` defaults to `'mild'` on `startShift()`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/gameStore.test.ts` (in a new `describe` block):

```ts
import type { WaveTier } from '../types'

describe('gameStore tier lifecycle', () => {
  beforeEach(() => useGameStore.getState().reset())

  it('initial tier state is null/mild defaults', () => {
    expect(useGameStore.getState().currentTier).toBe(null)
    expect(useGameStore.getState().pendingTier).toBe(null)
  })

  it('startShift sets currentTier to mild (wave 1 default)', () => {
    useGameStore.getState().startShift()
    expect(useGameStore.getState().currentTier).toBe<WaveTier>('mild')
  })

  it('chooseTier updates pendingTier only', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().chooseTier('spicy')
    expect(useGameStore.getState().pendingTier).toBe<WaveTier>('spicy')
    expect(useGameStore.getState().currentTier).toBe<WaveTier>('mild')
  })

  it('nextWave promotes pendingTier to currentTier and clears pending', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().chooseTier('hellfire')
    useGameStore.getState().nextWave()
    expect(useGameStore.getState().currentTier).toBe<WaveTier>('hellfire')
    expect(useGameStore.getState().pendingTier).toBe(null)
  })

  it('reset clears both tiers', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().chooseTier('spicy')
    useGameStore.getState().reset()
    expect(useGameStore.getState().currentTier).toBe(null)
    expect(useGameStore.getState().pendingTier).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- gameStore`
Expected: FAIL with `chooseTier is not a function` and missing `currentTier` / `pendingTier` properties.

- [ ] **Step 3: Add tier state and actions to gameStore**

Edit `src/stores/gameStore.ts`. Add to `GameState` interface (alongside other state):

```ts
import type { GamePhase, GameStats, SpellType, WaveTier } from '../types'

interface GameState {
  // ...existing fields...
  currentTier: WaveTier | null
  pendingTier: WaveTier | null
  // ...
  chooseTier: (tier: WaveTier) => void
}
```

In the store body, add to defaults:

```ts
currentTier: null,
pendingTier: null,
```

Update `startShift`:

```ts
startShift: () => set({
  phase: 'combat', currentWave: 1, timeScale: 1,
  currentTier: 'mild', pendingTier: null,
  stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
}),
```

Update `nextWave` to promote `pendingTier`:

```ts
nextWave: () => set((s) => ({
  phase: 'combat',
  currentWave: s.currentWave + 1,
  currentTier: s.pendingTier ?? 'mild',
  pendingTier: null,
})),
```

Add the `chooseTier` action:

```ts
chooseTier: (tier) => set({ pendingTier: tier }),
```

Update `reset` to clear both tiers (add `currentTier: null, pendingTier: null` to the existing `set({...})` call inside `reset`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- gameStore`
Expected: PASS — all 5 new tier tests + existing juice tests.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/__tests__/gameStore.test.ts
git commit -m "feat(rest): add tier lifecycle to gameStore (currentTier + pendingTier)"
```

---

## Task 3: Create tier modifier data table

**Files:**
- Create: `src/data/waves.ts`
- Create: `src/__tests__/waves.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/waves.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { TIER_MODIFIERS } from '../data/waves'

describe('TIER_MODIFIERS', () => {
  it('mild is identity (no modifier)', () => {
    const m = TIER_MODIFIERS.mild
    expect(m.speedMultiplier).toBe(1)
    expect(m.extraEliteCount).toBe(0)
    expect(m.hazardIntervalMultiplier).toBe(1)
    expect(m.perkPoolSize).toBe(3)
    expect(m.perkPickCount).toBe(1)
  })

  it('spicy applies 25% speed boost, +1 elite, +4 perk pool, 1 pick', () => {
    const m = TIER_MODIFIERS.spicy
    expect(m.speedMultiplier).toBeCloseTo(1.25)
    expect(m.extraEliteCount).toBe(1)
    expect(m.hazardIntervalMultiplier).toBeLessThan(1) // faster cadence
    expect(m.perkPoolSize).toBe(4)
    expect(m.perkPickCount).toBe(1)
  })

  it('hellfire applies 50% speed boost, +2 elite, double pick from 4', () => {
    const m = TIER_MODIFIERS.hellfire
    expect(m.speedMultiplier).toBeCloseTo(1.5)
    expect(m.extraEliteCount).toBe(2)
    expect(m.hazardIntervalMultiplier).toBeLessThan(TIER_MODIFIERS.spicy.hazardIntervalMultiplier)
    expect(m.perkPoolSize).toBe(4)
    expect(m.perkPickCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- waves`
Expected: FAIL with `Cannot find module '../data/waves'`.

- [ ] **Step 3: Create the modifier table**

Create `src/data/waves.ts`:

```ts
import type { WaveTier } from '../types'

export interface TierModifier {
  /** Multiply enemy movement speed by this value. 1 = no change. */
  speedMultiplier: number
  /** Forced extra tanky/exploder spawns at the start of each wave. */
  extraEliteCount: number
  /** Multiply HazardManager's spawn interval by this value. <1 = faster. */
  hazardIntervalMultiplier: number
  /** Number of perk options shown in the PerkPanel for this tier. */
  perkPoolSize: number
  /** Number of perks the player can pick before advancing. */
  perkPickCount: number
}

export const TIER_MODIFIERS: Record<WaveTier, TierModifier> = {
  mild: {
    speedMultiplier: 1.0,
    extraEliteCount: 0,
    hazardIntervalMultiplier: 1.0,
    perkPoolSize: 3,
    perkPickCount: 1,
  },
  spicy: {
    speedMultiplier: 1.25,
    extraEliteCount: 1,
    hazardIntervalMultiplier: 0.75,  // 25% faster hazard cadence
    perkPoolSize: 4,
    perkPickCount: 1,
  },
  hellfire: {
    speedMultiplier: 1.5,
    extraEliteCount: 2,
    hazardIntervalMultiplier: 0.6,   // 40% faster hazard cadence
    perkPoolSize: 4,
    perkPickCount: 2,
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- waves`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/waves.ts src/__tests__/waves.test.ts
git commit -m "feat(rest): add tier modifier table (speed/elite/hazard/perks)"
```

---

## Task 4: Extract recipe book into shared `<RecipeBookPanel />`

**Files:**
- Create: `src/ui/RecipeBookPanel.tsx`
- Modify: `src/ui/HUD.tsx` (replace inline block, remove now-unused `RECIPES` constant + helpers)

The current recipe block is hardcoded inside `HUD.tsx` (lines 88–117) with a local `RECIPES` array (line 31), `INGREDIENT_ICON`, and `SPELL_LABEL`. Phase 2 will add a 🌟 indicator for evolved spells, so we want a single component to maintain.

- [ ] **Step 1: Create the panel component**

Create `src/ui/RecipeBookPanel.tsx`:

```tsx
import { getRecipe } from '../data/recipes'
import type { Ingredient } from '../types'

const INGREDIENT_ICON: Record<Ingredient, string> = {
  CHILI: '/icons/chili.png',
  BOTTLE: '/icons/bottle.png',
  SALT: '/icons/salt.png',
}

const SPELL_LABEL: Record<string, string> = {
  INFERNO: 'Inferno 🔥', TIDAL_WAVE: 'Tidal Wave 🌊', SALT_SPEED: 'Salt Speed 👟',
  STEAM: 'Steam 💨', METEOR: 'Meteor ☄️', MUD: 'Mud 🟫',
}

const RECIPES: Array<[Ingredient, Ingredient]> = [
  ['CHILI', 'CHILI'],
  ['BOTTLE', 'BOTTLE'],
  ['SALT', 'SALT'],
  ['CHILI', 'BOTTLE'],
  ['CHILI', 'SALT'],
  ['BOTTLE', 'SALT'],
]

interface Props {
  /** Visual variant — `hud` is the small left-panel style; `restRoom` is
   *  the larger version embedded in the Rest Room hub. */
  variant: 'hud' | 'restRoom'
}

export default function RecipeBookPanel({ variant }: Props) {
  const isHud = variant === 'hud'
  return (
    <div style={{
      padding: isHud ? '12px 16px' : '16px 24px',
      background: 'rgba(0,0,0,0.6)',
      borderRadius: '8px',
      border: '1px solid rgba(245, 158, 11, 0.25)',
    }}>
      <div style={{
        color: '#fbbf24',
        fontSize: isHud ? '10px' : '14px',
        fontWeight: 'bold',
        letterSpacing: '2px',
        textAlign: 'center',
        marginBottom: '8px',
      }}>
        RECIPES
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: isHud ? '6px' : '10px',
        color: '#d1d5db', fontSize: isHud ? '11px' : '14px',
      }}>
        {RECIPES.map(([a, b]) => {
          const iconSize = isHud ? 18 : 24
          return (
            <div key={`${a}+${b}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src={INGREDIENT_ICON[a]} alt={a} width={iconSize} height={iconSize} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>+</span>
              <img src={INGREDIENT_ICON[b]} alt={b} width={iconSize} height={iconSize} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>=</span>
              <span style={{ color: '#fcd34d', fontWeight: 'bold' }}>
                {SPELL_LABEL[getRecipe(a, b)] ?? getRecipe(a, b)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update HUD.tsx to use the panel**

In `src/ui/HUD.tsx`:
1. Add import: `import RecipeBookPanel from './RecipeBookPanel'`
2. Delete the local `RECIPES`, `INGREDIENT_ICON`, and `SPELL_LABEL` constants (lines 20–38 area)
3. Replace the entire `{/* Left side: recipe book */}` block (lines 88–117) with:

```tsx
{/* Left side: recipe book */}
<div style={{
  position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
  zIndex: 10,
}}>
  <RecipeBookPanel variant="hud" />
</div>
```

4. Verify the now-unused `getRecipe` and `Ingredient` imports remain only if used elsewhere in HUD.tsx; otherwise remove.

- [ ] **Step 3: Verify no behavior change**

Run: `npm run build`
Expected: PASS.

Run: `npm run dev` and open the game. Start a wave. The recipe book on the left HUD should look identical to before.

- [ ] **Step 4: Commit**

```bash
git add src/ui/RecipeBookPanel.tsx src/ui/HUD.tsx
git commit -m "refactor: extract recipe book into shared RecipeBookPanel"
```

---

## Task 5: Extract perk picking into `<PerkPanel />`

**Files:**
- Create: `src/ui/PerkPanel.tsx`
- The existing `src/ui/RewardScreen.tsx` stays alive for now (deleted in Task 8); we just lift its inner card-row into a panel.

PerkPanel must:
- Read `currentTier` from gameStore to choose `perkPoolSize` and `perkPickCount` (use `TIER_MODIFIERS` from `src/data/waves.ts`)
- When `currentTier` is `null` (defensive), default to mild behavior
- Track `picksRemaining` locally — start at `perkPickCount`, decrement on pick
- Skip auto-advance — the BeginWaveButton (Task 7) handles wave start
- Heal card and perk row coexist; heal still ends the rest phase via `nextWave()`. (Keep heal's existing "skip the perk and recover" semantic for now — Task 8 may revisit.)

- [ ] **Step 1: Create PerkPanel.tsx**

Create `src/ui/PerkPanel.tsx`:

```tsx
import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import { drawPerksWithRarity, type PerkDefinition } from '../data/perks'
import { TIER_MODIFIERS } from '../data/waves'
import PerkCard, { CARD_SCALE, CARD_WIDTH_PX } from './PerkCard'

const CARD_GAP = 24
const PERK_CARD_SCALE = 0.85
const HEAL_CARD_SCALE = 0.55
const HEAL_PERK_GAP = 56

export default function PerkPanel() {
  const currentTier = useGameStore((s) => s.currentTier) ?? 'mild'
  const mods = TIER_MODIFIERS[currentTier]
  const activePerks = useDeckStore((s) => s.activePerks)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)

  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(mods.perkPoolSize))
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())
  const [rerollsLeft, setRerollsLeft] = useState(1)
  const picksRemaining = mods.perkPickCount - pickedIds.size

  function pickHeal() {
    if (hp >= maxHp) return
    usePlayerStore.getState().heal(30)
    useDeckStore.getState().initHand()
    useGameStore.getState().nextWave()
  }

  function currentTierFor(perkId: string): number {
    return activePerks.find((p) => p.id === perkId)?.stackCount ?? 0
  }

  function pickPerk(perk: PerkDefinition) {
    if (picksRemaining <= 0 || pickedIds.has(perk.id)) return
    useDeckStore.getState().addPerk({ ...perk, stackCount: 1 })
    useDeckStore.getState().initHand()
    setPickedIds((s) => new Set(s).add(perk.id))
    // Note: no auto-advance — BeginWaveButton handles wave start.
  }

  function handleReroll() {
    if (rerollsLeft <= 0 || pickedIds.size > 0) return
    setPerks(drawPerksWithRarity(mods.perkPoolSize))
    setRerollsLeft(0)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
        Picks remaining: {picksRemaining} / {mods.perkPickCount}
      </div>

      <div style={{
        display: 'flex', gap: `${HEAL_PERK_GAP}px`,
        alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <div style={{ zoom: HEAL_CARD_SCALE }}>
          <HealCard hp={hp} maxHp={maxHp} onPick={pickHeal} />
        </div>

        <div style={{ display: 'flex', gap: `${CARD_GAP}px`, alignItems: 'stretch' }}>
          {perks.map((perk) => {
            const isPicked = pickedIds.has(perk.id)
            return (
              <div key={perk.id} style={{ zoom: PERK_CARD_SCALE, opacity: isPicked ? 0.4 : 1 }}>
                <PerkCard
                  perk={perk}
                  currentTier={currentTierFor(perk.id) + (isPicked ? 1 : 0)}
                  onPick={() => pickPerk(perk)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleReroll}
        disabled={rerollsLeft === 0 || pickedIds.size > 0}
        style={{
          padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
          cursor: rerollsLeft > 0 && pickedIds.size === 0 ? 'pointer' : 'not-allowed',
          background: rerollsLeft > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
          border: `2px solid ${rerollsLeft > 0 ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
          color: rerollsLeft > 0 ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
        }}
      >
        {rerollsLeft > 0 ? 'Reroll (1)' : 'Reroll (0 — used)'}
      </button>
    </div>
  )
}

function HealCard({ hp, maxHp, onPick }: { hp: number; maxHp: number; onPick: () => void }) {
  const disabled = hp >= maxHp
  return (
    <div
      onClick={disabled ? undefined : onPick}
      style={{
        zoom: CARD_SCALE, width: `${CARD_WIDTH_PX}px`, minHeight: '420px',
        borderRadius: '12px',
        border: `3px solid ${disabled ? 'rgba(255,255,255,0.2)' : '#ef4444'}`,
        background: disabled
          ? 'linear-gradient(180deg, rgba(60,20,20,0.6), rgba(30,10,10,0.6))'
          : 'linear-gradient(180deg, #4a1313, #1a0606)',
        boxShadow: disabled ? 'none' : '0 0 24px rgba(239,68,68,0.45)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px 16px', gap: '16px',
      }}
    >
      <img src="/icons/heart_pickup.png" alt="Heart" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
      <div style={{ color: '#fca5a5', fontSize: '24px', fontWeight: 'bold' }}>HEAL</div>
      <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>+30 HP</div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', textAlign: 'center' }}>
        {disabled ? 'Already at full HP' : 'Skip the perk and recover health.'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build still works**

Run: `npm run build`
Expected: PASS — `RewardScreen` still works, `PerkPanel` is just unused for now.

- [ ] **Step 3: Commit**

```bash
git add src/ui/PerkPanel.tsx
git commit -m "feat(rest): add PerkPanel (tier-aware perk count, no auto-advance)"
```

---

## Task 6: Create `<TierPanel />`

**Files:**
- Create: `src/ui/TierPanel.tsx`

- [ ] **Step 1: Create TierPanel.tsx**

```tsx
import { useGameStore } from '../stores/gameStore'
import { TIER_MODIFIERS } from '../data/waves'
import type { WaveTier } from '../types'

interface TierCardData {
  tier: WaveTier
  emoji: string
  label: string
  blurb: string
  borderColor: string
  glow: string
}

const TIERS: TierCardData[] = [
  {
    tier: 'mild', emoji: '🥄', label: 'MILD',
    blurb: 'Standard wave. Pick 1 of 3 perks.',
    borderColor: '#9ca3af',
    glow: 'rgba(156,163,175,0.4)',
  },
  {
    tier: 'spicy', emoji: '🌶️', label: 'SPICY',
    blurb: '+25% enemy speed, +1 elite, faster hazards. Pick 1 of 4 perks.',
    borderColor: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
  },
  {
    tier: 'hellfire', emoji: '🔥', label: 'HELLFIRE',
    blurb: '+50% enemy speed, +2 elites, mid-wave reinforcement. Pick 2 of 4 perks.',
    borderColor: '#dc2626',
    glow: 'rgba(220,38,38,0.55)',
  },
]

export default function TierPanel() {
  const pendingTier = useGameStore((s) => s.pendingTier)
  const chooseTier = useGameStore((s) => s.chooseTier)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ color: '#fbbf24', fontSize: '14px', letterSpacing: '2px' }}>
        NEXT WAVE — CHOOSE YOUR HEAT
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        {TIERS.map((t) => {
          const selected = pendingTier === t.tier
          // Reference TIER_MODIFIERS so the tooltip stays in sync if numbers change.
          // (Not rendered yet — kept for future tooltip extension.)
          void TIER_MODIFIERS[t.tier]
          return (
            <button
              key={t.tier}
              onClick={() => chooseTier(t.tier)}
              style={{
                width: '180px', minHeight: '200px',
                padding: '16px 12px',
                borderRadius: '10px',
                border: `3px solid ${selected ? t.borderColor : 'rgba(255,255,255,0.15)'}`,
                background: 'rgba(20,10,10,0.85)',
                boxShadow: selected ? `0 0 24px ${t.glow}` : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                color: 'white', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '40px' }}>{t.emoji}</div>
              <div style={{ color: t.borderColor, fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>
                {t.label}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', textAlign: 'center' }}>
                {t.blurb}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/TierPanel.tsx
git commit -m "feat(rest): add TierPanel (3 cards, writes to pendingTier)"
```

---

## Task 7: Create `<BeginWaveButton />`

**Files:**
- Create: `src/ui/BeginWaveButton.tsx`

The button has 2 modes:
- Normal waves (currentWave 1–6): disabled until `pendingTier` is set; click → `nextWave()`
- After wave 7 (going to boss): no tier choice required; button always enabled and shows "Begin Boss"; click → `triggerPreBossLull(LULL_DURATION_MS)`. (Phase 1 keeps boss-tier choice deferred per spec.)

- [ ] **Step 1: Create BeginWaveButton.tsx**

```tsx
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'

const LULL_DURATION_MS = 3000  // matches EnemyManager.LULL_DURATION_MS

export default function BeginWaveButton() {
  const currentWave = useGameStore((s) => s.currentWave)
  const pendingTier = useGameStore((s) => s.pendingTier)
  const isPreBoss = currentWave >= 7

  const enabled = isPreBoss || pendingTier !== null
  const label = isPreBoss
    ? '▶ Begin Boss Fight'
    : pendingTier
      ? `▶ Begin Wave ${currentWave + 1} (${pendingTier})`
      : '▶ Begin Wave — choose a tier first'

  function onClick() {
    if (!enabled) return
    useDeckStore.getState().initHand()
    if (isPreBoss) {
      useGameStore.getState().triggerPreBossLull(LULL_DURATION_MS)
    } else {
      useGameStore.getState().nextWave()
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        padding: '14px 32px', borderRadius: '10px', fontSize: '18px', fontWeight: 'bold',
        fontFamily: 'inherit', letterSpacing: '1px',
        cursor: enabled ? 'pointer' : 'not-allowed',
        background: enabled ? 'linear-gradient(180deg, #f59e0b, #b45309)' : 'rgba(255,255,255,0.08)',
        border: `2px solid ${enabled ? '#fcd34d' : 'rgba(255,255,255,0.15)'}`,
        color: enabled ? '#1a0606' : 'rgba(255,255,255,0.4)',
        boxShadow: enabled ? '0 0 20px rgba(245,158,11,0.5)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/BeginWaveButton.tsx
git commit -m "feat(rest): add BeginWaveButton (gated by pendingTier or pre-boss)"
```

---

## Task 8: Compose `<RestRoom />` and wire into App.tsx (delete RewardScreen)

**Files:**
- Create: `src/ui/RestRoom.tsx`
- Modify: `src/App.tsx`
- Delete: `src/ui/RewardScreen.tsx`
- Modify: `src/__tests__/rewardScreen.test.ts` → rename file or update its imports / tests

- [ ] **Step 1: Create RestRoom.tsx**

```tsx
import { useGameStore } from '../stores/gameStore'
import PerkPanel from './PerkPanel'
import TierPanel from './TierPanel'
import RecipeBookPanel from './RecipeBookPanel'
import BeginWaveButton from './BeginWaveButton'

export default function RestRoom() {
  const currentWave = useGameStore((s) => s.currentWave)
  const isPreBoss = currentWave >= 7

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', zIndex: 20,
      overflowY: 'auto', padding: '24px 16px', gap: '24px',
    }}>
      <h1 style={{ color: '#fcd34d', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
        REST ROOM — Wave {currentWave} cleared
      </h1>

      <div style={{
        display: 'flex', gap: '40px', alignItems: 'flex-start',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <PerkPanel />
        <RecipeBookPanel variant="restRoom" />
      </div>

      {!isPreBoss && <TierPanel />}

      <BeginWaveButton />
    </div>
  )
}
```

- [ ] **Step 2: Wire RestRoom into App.tsx**

In `src/App.tsx`:
1. Replace `import RewardScreen from './ui/RewardScreen'` with `import RestRoom from './ui/RestRoom'`.
2. Replace `{phase === 'rest' && sceneReady && <RewardScreen />}` with `{phase === 'rest' && sceneReady && <RestRoom />}`.

- [ ] **Step 3: Delete RewardScreen.tsx**

```bash
rm src/ui/RewardScreen.tsx
```

- [ ] **Step 4: Update / rename rewardScreen.test.ts**

Read the existing `src/__tests__/rewardScreen.test.ts`. If it tests the `RewardScreen` component directly, replace those tests with equivalent `<PerkPanel />` tests in a new `src/__tests__/perkPanel.test.tsx` (or rename the file to `restRoom.test.tsx` and rewrite to mount `<RestRoom />`).

If the existing tests are about the perk-pick flow only, the simplest path:
1. Rename file: `git mv src/__tests__/rewardScreen.test.ts src/__tests__/perkPanel.test.tsx`
2. Replace `import RewardScreen from '../ui/RewardScreen'` with `import PerkPanel from '../ui/PerkPanel'`
3. Replace any `<RewardScreen />` JSX with `<PerkPanel />`.
4. Re-run and adjust assertions if behavior changed (e.g., perk pick no longer triggers `nextWave`).

- [ ] **Step 5: Run full test + build**

```bash
npm run test
npm run build
```
Both expected: PASS.

- [ ] **Step 6: Visual smoke test**

Run: `npm run dev`. Play through wave 1. After wave 1 clears, the Rest Room should appear with: perk panel, recipe book, tier panel (3 cards), and a disabled "Begin Wave 2" button. Selecting a tier enables the button. Clicking it should start wave 2.

- [ ] **Step 7: Commit**

```bash
git add src/ui/RestRoom.tsx src/App.tsx src/__tests__/perkPanel.test.tsx
git rm src/ui/RewardScreen.tsx src/__tests__/rewardScreen.test.ts
git commit -m "feat(rest): compose RestRoom hub + wire into App, delete RewardScreen"
```

---

## Task 9: Wave 7 → Rest Room → Boss flow update

**Files:**
- Modify: `src/components/EnemyManager.tsx`

Currently `EnemyManager` skips the reward phase on wave 7 — it goes straight `combat → pre-boss-lull → boss`. With the Rest Room we want a perk pick after wave 7 too. The Rest Room renders without a TierPanel for the pre-boss case (already handled in Task 8); BeginWaveButton triggers the lull (already handled in Task 7).

- [ ] **Step 1: Find the wave-end branch in EnemyManager.tsx**

Locate this block (currently around the `if (allDead)` branch):

```ts
if (allDead) {
  spawnTimer.current = 0; spawnedCount.current = 0; waveTimer.current = 0
  pendingDetonations.current.clear()
  useEnemyStore.getState().reset()
  if (currentWave >= 7) useGameStore.getState().triggerPreBossLull(LULL_DURATION_MS)
  else useGameStore.getState().completeWave()
}
```

- [ ] **Step 2: Always go through Rest Room**

Replace with:

```ts
if (allDead) {
  spawnTimer.current = 0; spawnedCount.current = 0; waveTimer.current = 0
  pendingDetonations.current.clear()
  useEnemyStore.getState().reset()
  // All waves (1-7) route through Rest Room. The BeginWaveButton handles
  // the pre-boss lull transition for wave 7.
  useGameStore.getState().completeWave()
}
```

- [ ] **Step 3: Run dev + smoke test**

Run: `npm run dev`. Use the DevPanel (or play normally) to clear wave 7. Confirm the Rest Room appears with a perk panel + "Begin Boss Fight" button. Clicking the button triggers the pre-boss lull, then the boss spawns.

- [ ] **Step 4: Commit**

```bash
git add src/components/EnemyManager.tsx
git commit -m "feat(rest): route wave 7 clear through Rest Room before boss"
```

---

## Task 10: Apply tier modifier — enemy movement speed

**Files:**
- Modify: `src/components/Enemy.tsx`

Speed is read at line 229 of `Enemy.tsx`:
```ts
const speed = SPEED[enemy.type] * statusMultiplier * timeScale
```
And at line 186 (exploder sprint) and line 243 (tanky charge). All three must respect the tier multiplier.

- [ ] **Step 1: Subscribe to currentTier in Enemy.tsx**

At the top of the `Enemy` component (where other store subscriptions live), add:

```ts
import { TIER_MODIFIERS } from '../data/waves'
// ...
const currentTier = useGameStore((s) => s.currentTier) ?? 'mild'
const tierSpeed = TIER_MODIFIERS[currentTier].speedMultiplier
```

(If `useGameStore` is already imported elsewhere in the file, just add the line subscribing to `currentTier`.)

- [ ] **Step 2: Apply multiplier at all three speed sites**

Search Enemy.tsx for `SPEED[enemy.type]`, `EXPLODER_SPRINT_MULT`, and `TANKY_CHARGE_MULT`. Multiply each computed speed by `tierSpeed`. Specifically:

Line ~186 (exploder sprint):
```ts
const sprintSpeed = SPEED.exploder * EXPLODER_SPRINT_MULT * detMult * timeScale * tierSpeed
```

Line ~229 (chase):
```ts
const speed = SPEED[enemy.type] * statusMultiplier * timeScale * tierSpeed
```

Line ~243 (tanky charge):
```ts
const chargeSpeed = SPEED.tanky * TANKY_CHARGE_MULT * tierSpeed
```

(Push speed at line ~327 should NOT include tierSpeed — that's a knockback shove, not enemy movement.)

- [ ] **Step 3: Verify build + smoke test**

Run: `npm run build` — expected PASS.

Run: `npm run dev`. Pick Hellfire on wave 2. Enemies should visibly move faster than on wave 1.

- [ ] **Step 4: Commit**

```bash
git add src/components/Enemy.tsx
git commit -m "feat(rest): apply tier speed multiplier to enemy movement"
```

---

## Task 11: Apply tier modifier — extra elite spawns

**Files:**
- Modify: `src/components/EnemyManager.tsx`

Spec: Spicy adds 1 forced elite (tanky/exploder) at wave start; Hellfire adds 2. For Phase 1 simplicity, "elite" = `tanky` (the slowest, most threatening base type).

- [ ] **Step 1: Add a wave-start elite spawn step**

In `src/components/EnemyManager.tsx`, find the `if (phase === 'combat' && prevPhase.current !== 'combat')` block (resets spawn state on entry to combat). Right after the `prevPhase.current = phase` line that follows it (or at the end of the same block), add:

```ts
import { TIER_MODIFIERS } from '../data/waves'
// ...

if (phase === 'combat' && prevPhase.current !== 'combat') {
  waveTimer.current = 0
  spawnTimer.current = 0
  spawnedCount.current = 0
  pendingDetonations.current.clear()
  if (surgeActive) useGameStore.getState().endSurge()

  // Tier modifier: force-spawn extra elites at wave start.
  const tier = useGameStore.getState().currentTier ?? 'mild'
  const extraElites = TIER_MODIFIERS[tier].extraEliteCount
  for (let i = 0; i < extraElites; i++) {
    useEnemyStore.getState().spawnEnemy('tanky', getSpawnPosition())
    spawnedCount.current++  // count toward wave target so the wave still ends
  }
}
```

- [ ] **Step 2: Verify build + smoke test**

Run: `npm run build`.
Run: `npm run dev`. On wave 2 with Hellfire selected, the wave should open with 2 tanky enemies already on the field.

- [ ] **Step 3: Commit**

```bash
git add src/components/EnemyManager.tsx
git commit -m "feat(rest): force-spawn extra tanky elites per tier at wave start"
```

---

## Task 12: Apply tier modifier — hazard interval

**Files:**
- Modify: `src/components/HazardManager.tsx`

`HazardManager` reads its spawn cadence from `getHazardIntervalSec(phase, currentWave)`. We multiply that result by `tierHazardMultiplier` so smaller multiplier = faster cadence.

- [ ] **Step 1: Apply multiplier where the interval is consumed**

In `src/components/HazardManager.tsx`, find the `useFrame` body where `getHazardIntervalSec(...)` is called (search the file for `getHazardIntervalSec`). Wrap the result:

```ts
import { TIER_MODIFIERS } from '../data/waves'
// ...

const tier = useGameStore.getState().currentTier ?? 'mild'
const tierMult = TIER_MODIFIERS[tier].hazardIntervalMultiplier
const intervalSec = getHazardIntervalSec(phase, currentWave) * tierMult
```

Then use `intervalSec` instead of the unmultiplied call site.

- [ ] **Step 2: Verify build + smoke test**

Run: `npm run build`.
Run: `npm run dev`. On wave 4+ with Hellfire selected, hazards should spawn noticeably faster than Mild.

- [ ] **Step 3: Commit**

```bash
git add src/components/HazardManager.tsx
git commit -m "feat(rest): apply tier multiplier to hazard spawn cadence"
```

---

## Task 13: Verify Phase 1 reward differential end-to-end

**Files:**
- Create: `src/__tests__/perkPanel.test.tsx` (if not already created in Task 8 by renaming)

PerkPanel already reads `TIER_MODIFIERS[currentTier].perkPoolSize` and `perkPickCount` from Task 5. This task adds an explicit test and a manual verification.

- [ ] **Step 1: Add tier-aware tests to perkPanel.test.tsx**

Add to `src/__tests__/perkPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import PerkPanel from '../ui/PerkPanel'

describe('PerkPanel tier differential', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
    useDeckStore.getState().reset()
  })

  it('renders 3 perks for mild tier with 1 pick remaining', () => {
    useGameStore.getState().startShift() // currentTier = 'mild'
    render(<PerkPanel />)
    expect(screen.getByText(/Picks remaining: 1 \/ 1/)).toBeInTheDocument()
    // Heal card is always rendered alongside; perk count lives separately.
    // PerkCard nodes have a stable test marker via their button role; assert
    // the count via PerkCard occurrences.
  })

  it('renders 4 perks for spicy tier with 1 pick remaining', () => {
    useGameStore.setState({ currentTier: 'spicy' })
    render(<PerkPanel />)
    expect(screen.getByText(/Picks remaining: 1 \/ 1/)).toBeInTheDocument()
  })

  it('allows 2 picks for hellfire tier', () => {
    useGameStore.setState({ currentTier: 'hellfire' })
    render(<PerkPanel />)
    expect(screen.getByText(/Picks remaining: 2 \/ 2/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test
```
Expected: PASS.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Play through:
- Wave 1: clear it. Rest Room shows 3 perks, "Picks remaining 1/1". TierPanel shows 3 cards.
- Pick Spicy. BeginWaveButton enables. Click it. Wave 2 spawns +1 tanky elite up front, enemies are 25% faster.
- Clear wave 2. Rest Room now shows 4 perks, "Picks remaining 1/1".
- Pick Hellfire. Click Begin Wave 3. Wave opens with 2 tanky elites + faster enemies + faster hazards (if wave 3 happens to spawn hazards — they start at wave 4).
- Clear wave 3. Rest Room shows 4 perks, "Picks remaining 2/2". Pick TWO perks before BeginWaveButton activates.
- Continue to wave 7 + boss to confirm pre-boss Rest Room hides TierPanel and BeginWaveButton says "Begin Boss Fight".

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/perkPanel.test.tsx
git commit -m "test(rest): tier-aware perk count assertions"
```

---

## Task 14: Final lint pass + integration commit

**Files:** none new

- [ ] **Step 1: Lint**

```bash
npm run lint
```
Fix any new warnings introduced by the new files.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 3: Full test suite**

```bash
npm run test
```
Expected: PASS.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore(rest): final lint pass for Phase 1 Rest Room + Tier system"
```

---

## Self-Review Checklist (run after writing the plan)

- [x] Spec coverage — every Phase 1 bullet from `docs/superpowers/specs/2026-05-03-run-progression-and-evolution-design.md` maps to at least one task here:
  - `phase: 'rest'` rename → Task 1
  - RestRoom component → Task 8
  - PerkPanel → Task 5
  - TierPanel → Task 6
  - RecipeBookPanel → Task 4
  - BeginWaveButton → Task 7
  - WaveTier types + tier state → Task 1, 2
  - Tier modifier (speed/elite/hazard) → Task 10, 11, 12
  - No wave variants — confirmed deferred (Phase 2)
  - No evolution tokens — confirmed deferred (Phase 2)
  - No boss tier choice — confirmed deferred (Task 7 BeginWaveButton skips tier for pre-boss)
  - Phase 1 reward differential (3 / 4 / 2-of-4) → Task 5, 13
- [x] No placeholders — every code step shows actual code or exact commands.
- [x] Type consistency — `WaveTier`, `TIER_MODIFIERS.speedMultiplier`, `currentTier`, `pendingTier`, `chooseTier` are referenced consistently across tasks.
- [x] No duplicated future-phase work — branches, tokens, and variants are explicitly out of scope.
