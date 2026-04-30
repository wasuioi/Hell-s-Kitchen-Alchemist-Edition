# BoilingPoint Perk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the BoilingPoint epic perk — players gain Heat stacks when taking damage, consume them on INFERNO casts for bonus damage. Plus a small reward-card layout change (name colored by rarity) that affects all perks.

**Architecture:** State lives in `playerStore` (Heat stacks + last-hit timestamp). Damage taken → adds Heat (gated by perk presence). INFERNO cast → consumes all Heat in `castSpell.ts` → multiplies damage → optional heal at T3 → spawns two sprite VFX. `Player.tsx` runs the 4s decay tick and renders the visual feedback (stack number above HP bar + red tint blink on the wizard model at stacks ≥5). A separate UI sweep replaces the rarity badge with the perk name in `RewardScreen.tsx` + `DevPanel.tsx`.

**Tech Stack:** React 19, TypeScript (strict), Zustand, @react-three/fiber + drei, three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-29-boiling-point-perk-design.md`

**Asset prerequisites (handled out-of-band by the user via GitHub Action workflows on issue #8):**
- `public/icons/boiling_point.png` — comment `/save-icon boiling_point` + attach the cast-iron pan PNG
- `public/vfx/boiling_point_consume.png` — comment `/save-vfx boiling_point_consume` + attach MP4 (Prompt 1 from issue #8 thread)
- `public/vfx/boiling_point_spell.png` — comment `/save-vfx boiling_point_spell` + attach MP4 (Prompt 2)

The implementation tasks below can ship even if the asset files aren't merged yet — missing assets just render as blank sprites in the meantime.

---

## Task 1: Add `boiling_point` to PERK_POOL

Pure data change — no behavior wired up yet. The perk shows up in the reward / dev pool with the right tier card and icon, but `castSpell` and `playerStore` ignore it for now. Update the existing perks-count test to match.

**Files:**
- Modify: `src/data/perks.ts:44-59` (add the entry to `PERK_POOL`)
- Modify: `src/__tests__/perks.test.ts:5` (bump count from 5 to 6)

- [ ] **Step 1: Update the failing test count**

In `src/__tests__/perks.test.ts:5`, change:

```ts
it('contains 5 perks', () => { expect(PERK_POOL).toHaveLength(5) })
```

to:

```ts
it('contains 6 perks', () => { expect(PERK_POOL).toHaveLength(6) })
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm run test -- src/__tests__/perks.test.ts
```

Expected: FAIL — `expected length 5 to be 6`.

- [ ] **Step 3: Add the perk to `PERK_POOL`**

In `src/data/perks.ts`, append inside the `PERK_POOL` array (after `grease_fire` at line 58, before the closing `]` on line 59):

```ts
  {
    id: 'boiling_point', name: 'Boiling Point', icon: '/icons/boiling_point.png',
    description: 'Taking damage builds Heat. Your next INFERNO cast consumes all Heat for bonus damage.',
    rarity: 'epic', vfxSprite: 'boiling_point_consume',
    tiers: [
      { stats: { Spell: 'INFERNO', 'Max Heat': 5, 'Per Stack': '+20%', Decay: '4.0s' } },
      { stats: { Spell: 'INFERNO', 'Max Heat': 7, 'Per Stack': '+20%', Decay: '4.0s' } },
      { stats: { Spell: 'INFERNO', 'Max Heat': 7, 'Per Stack': '+25%', Decay: '4.0s' }, added: 'Heal +1 HP per Heat stack consumed' },
    ],
  },
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm run test -- src/__tests__/perks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/perks.ts src/__tests__/perks.test.ts
git commit -m "feat(perks): add boiling_point definition to PERK_POOL"
```

---

## Task 2: Add Heat state + actions to `playerStore`

Add the data layer for Heat. No game-loop hookup yet — this task only adds the fields and the three actions (`addHeat`, `consumeHeat`, `decayHeat`), plus extends `reset()` to clear them. Tests cover capping, decay timing, and reset.

**Files:**
- Modify: `src/stores/playerStore.ts` — extend `PlayerState` interface and the store body
- Modify: `src/__tests__/playerStore.test.ts` — add a new `describe` block for Heat

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/playerStore.test.ts` (after the existing `playerStore dash` block at line 58):

```ts
describe('playerStore heat', () => {
  beforeEach(() => { usePlayerStore.getState().reset() })

  it('starts with zero heat', () => {
    expect(usePlayerStore.getState().heatStacks).toBe(0)
    expect(usePlayerStore.getState().lastHitAt).toBe(0)
  })

  it('addHeat increments by 1 and stamps lastHitAt', () => {
    const before = performance.now()
    usePlayerStore.getState().addHeat(5)
    const s = usePlayerStore.getState()
    expect(s.heatStacks).toBe(1)
    expect(s.lastHitAt).toBeGreaterThanOrEqual(before)
  })

  it('addHeat caps at maxStacks', () => {
    for (let i = 0; i < 10; i++) usePlayerStore.getState().addHeat(5)
    expect(usePlayerStore.getState().heatStacks).toBe(5)
  })

  it('consumeHeat returns the consumed count and clears heat', () => {
    usePlayerStore.getState().addHeat(7)
    usePlayerStore.getState().addHeat(7)
    usePlayerStore.getState().addHeat(7)
    const consumed = usePlayerStore.getState().consumeHeat()
    expect(consumed).toBe(3)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('decayHeat does nothing if window has not elapsed', () => {
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().decayHeat(4000)
    expect(usePlayerStore.getState().heatStacks).toBe(1)
  })

  it('decayHeat removes 1 stack when window elapsed and resets the timer', () => {
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    // Force lastHitAt into the past
    usePlayerStore.setState({ lastHitAt: performance.now() - 5000 })
    usePlayerStore.getState().decayHeat(4000)
    const s = usePlayerStore.getState()
    expect(s.heatStacks).toBe(1)
    // lastHitAt should have been bumped to ~now so the next decay needs another window
    expect(s.lastHitAt).toBeGreaterThan(performance.now() - 1000)
  })

  it('decayHeat at 0 stacks is a no-op', () => {
    usePlayerStore.getState().decayHeat(4000)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('reset clears heat state', () => {
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.setState({ lastHitAt: 12345 })
    usePlayerStore.getState().reset()
    const s = usePlayerStore.getState()
    expect(s.heatStacks).toBe(0)
    expect(s.lastHitAt).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm run test -- src/__tests__/playerStore.test.ts
```

Expected: 8 FAILs in the new `playerStore heat` block — `heatStacks` undefined, `addHeat` is not a function, etc.

- [ ] **Step 3: Extend `PlayerState` and the store body**

In `src/stores/playerStore.ts`, modify the `PlayerState` interface (lines 8-21) to add the fields and actions. Replace the interface block with:

```ts
interface PlayerState {
  position: Position; rotation: number; hp: number; maxHp: number; status: StatusEffect
  // Dash state
  isDashing: boolean
  dashDirection: Position | null
  dashCooldownUntil: number
  dashEndTime: number
  // Heat state (BoilingPoint perk)
  heatStacks: number
  lastHitAt: number
  // Actions
  setPosition: (pos: Position) => void; setRotation: (rot: number) => void
  takeDamage: (amount: number) => void; heal: (amount: number) => void
  setStatus: (status: StatusEffect) => void
  startDash: (direction: Position) => void; endDash: () => void
  addHeat: (maxStacks: number) => void
  consumeHeat: () => number
  decayHeat: (decayMs: number) => void
  reset: () => void
}
```

Then update the store body (lines 27-53). Replace the `usePlayerStore` block with:

```ts
export const usePlayerStore = create<PlayerState>((set, get) => ({
  position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
  isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
  heatStacks: 0, lastHitAt: 0,
  setPosition: (pos) => set({ position: pos }),
  setRotation: (rot) => set({ rotation: rot }),
  takeDamage: (amount) => {
    if (amount > 0) triggerOnDamageTaken(amount, get().position)
    set((s) => ({ hp: Math.max(0, s.hp - amount) }))
  },
  heal: (amount) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + amount) })),
  setStatus: (status) => set({ status }),
  startDash: (direction) => {
    const now = performance.now()
    set({
      isDashing: true,
      dashDirection: direction,
      dashCooldownUntil: now + DASH_COOLDOWN_MS,
      dashEndTime: now + DASH_DURATION_MS,
      status: 'normal', // Dash removes soaked
    })
  },
  endDash: () => set({ isDashing: false, dashDirection: null }),
  addHeat: (maxStacks) => set((s) => ({
    heatStacks: Math.min(maxStacks, s.heatStacks + 1),
    lastHitAt: performance.now(),
  })),
  consumeHeat: () => {
    const consumed = get().heatStacks
    set({ heatStacks: 0 })
    return consumed
  },
  decayHeat: (decayMs) => {
    const s = get()
    if (s.heatStacks === 0) return
    if (performance.now() - s.lastHitAt < decayMs) return
    set({ heatStacks: s.heatStacks - 1, lastHitAt: performance.now() })
  },
  reset: () => set({
    position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
    isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
    heatStacks: 0, lastHitAt: 0,
  }),
}))
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm run test -- src/__tests__/playerStore.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/playerStore.ts src/__tests__/playerStore.test.ts
git commit -m "feat(playerStore): add Heat stacks + add/consume/decay actions"
```

---

## Task 3: Hook `addHeat` into `takeDamage`

Wire the `boiling_point` perk: when the player takes damage and has the perk, derive `maxStacks` from the tier and call `addHeat`. Tests cover the perk-presence guard and tier-based caps.

**Files:**
- Modify: `src/stores/playerStore.ts` — extend `takeDamage` to read the perk and call `addHeat`
- Modify: `src/__tests__/playerStore.test.ts` — add a new `describe` block for the integration

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/playerStore.test.ts`:

```ts
import { useDeckStore } from '../stores/deckStore'

describe('playerStore takeDamage + boiling_point integration', () => {
  beforeEach(() => {
    usePlayerStore.getState().reset()
    useDeckStore.getState().reset()
  })

  function addBoilingPoint(stacks: number) {
    for (let i = 0; i < stacks; i++) {
      useDeckStore.getState().addPerk({
        id: 'boiling_point', name: 'Boiling Point', icon: '/icons/boiling_point.png',
        description: '', rarity: 'epic', stackCount: 1,
      })
    }
  }

  it('does not gain heat when boiling_point is not active', () => {
    usePlayerStore.getState().takeDamage(10)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('gains heat per hit when boiling_point is active', () => {
    addBoilingPoint(1)
    usePlayerStore.getState().takeDamage(10)
    usePlayerStore.getState().takeDamage(10)
    expect(usePlayerStore.getState().heatStacks).toBe(2)
  })

  it('caps at 5 stacks at T1', () => {
    addBoilingPoint(1)
    for (let i = 0; i < 10; i++) usePlayerStore.getState().takeDamage(5)
    expect(usePlayerStore.getState().heatStacks).toBe(5)
  })

  it('caps at 7 stacks at T2', () => {
    addBoilingPoint(2)
    for (let i = 0; i < 10; i++) usePlayerStore.getState().takeDamage(5)
    expect(usePlayerStore.getState().heatStacks).toBe(7)
  })

  it('caps at 7 stacks at T3', () => {
    addBoilingPoint(3)
    for (let i = 0; i < 10; i++) usePlayerStore.getState().takeDamage(5)
    expect(usePlayerStore.getState().heatStacks).toBe(7)
  })

  it('does not gain heat from a 0-damage call', () => {
    addBoilingPoint(1)
    usePlayerStore.getState().takeDamage(0)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm run test -- src/__tests__/playerStore.test.ts
```

Expected: FAIL on the "gains heat per hit" / cap tests — heat stays at 0 because `takeDamage` doesn't call `addHeat` yet.

- [ ] **Step 3: Update `takeDamage` to call `addHeat`**

At the top of `src/stores/playerStore.ts`, add the `useDeckStore` import (after the existing `triggerOnDamageTaken` import on line 3):

```ts
import { useDeckStore } from './deckStore'
```

Then add an exported constant near the top of the file (after the `DASH_*` constants on line 6). Exported because `Player.tsx` (Task 7) needs the same numbers to compute the visual cap, so we keep one source of truth:

```ts
// BoilingPoint Heat caps per perk-tier (index = tier - 1)
export const BOILING_POINT_MAX_HEAT = [5, 7, 7]
```

Update `takeDamage` (lines 32-35) to:

```ts
  takeDamage: (amount) => {
    if (amount > 0) {
      triggerOnDamageTaken(amount, get().position)
      const bpStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'boiling_point')?.stackCount ?? 0
      if (bpStacks > 0) {
        const tier = Math.min(bpStacks, 3)
        get().addHeat(BOILING_POINT_MAX_HEAT[tier - 1])
      }
    }
    set((s) => ({ hp: Math.max(0, s.hp - amount) }))
  },
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm run test -- src/__tests__/playerStore.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/playerStore.ts src/__tests__/playerStore.test.ts
git commit -m "feat(playerStore): gain Heat on damage taken when boiling_point is active"
```

---

## Task 4: Apply Heat multiplier + heal on INFERNO cast

In `castSpell.ts`, add the BoilingPoint block after the existing `Extra Spicy` block. Guard by `spellType === 'INFERNO'`. Multiply damage, heal at T3, then consume heat.

**Files:**
- Modify: `src/utils/castSpell.ts:33-37` — extend `buildSpell`
- Create: `src/__tests__/castSpell.test.ts` — new test file

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/castSpell.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlayerStore } from '../stores/playerStore'
import { useDeckStore } from '../stores/deckStore'

// Mock the window globals castSpell calls so the test doesn't crash. Vitest
// runs in jsdom (vitest.config.ts), so `window` already exists — we only
// need to attach the dynamic globals that the 3D scene normally provides.
beforeEach(() => {
  ;(window as any).__castSpell = vi.fn()
  ;(window as any).__setLastSpellColor = vi.fn()
  ;(window as any).__playerAttack = vi.fn()
  ;(window as any).__spawnSpriteVfx = vi.fn()
  usePlayerStore.getState().reset()
  useDeckStore.getState().reset()
})

function addBoilingPoint(stacks: number) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({
      id: 'boiling_point', name: 'Boiling Point', icon: '/icons/boiling_point.png',
      description: '', rarity: 'epic', stackCount: 1,
    })
  }
}

describe('castSpell + boiling_point', () => {
  it('does not affect damage when no heat is banked', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // INFERNO base damage is 40 (see SPELL_CONFIG)
    expect(spell.damage).toBe(40)
  })

  it('multiplies INFERNO damage by +20% per Heat stack at T1', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    for (let i = 0; i < 5; i++) usePlayerStore.getState().addHeat(5) // 5 heat
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // 40 × (1 + 0.20 × 5) = 40 × 2.0 = 80
    expect(spell.damage).toBeCloseTo(80, 5)
  })

  it('multiplies INFERNO damage by +25% per Heat stack at T3', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(3)
    for (let i = 0; i < 7; i++) usePlayerStore.getState().addHeat(7) // 7 heat
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // 40 × (1 + 0.25 × 7) = 40 × 2.75 = 110
    expect(spell.damage).toBeCloseTo(110, 5)
  })

  it('overflow stacks add +5%/Heat per perk stack beyond T3', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(4) // 1 stack of overflow
    for (let i = 0; i < 7; i++) usePlayerStore.getState().addHeat(7)
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // perStack = 0.25 + 0.05 × 1 = 0.30
    // 40 × (1 + 0.30 × 7) = 40 × 3.10 = 124
    expect(spell.damage).toBeCloseTo(124, 5)
  })

  it('clears heat after INFERNO is cast', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    castSpell('INFERNO')
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('does NOT consume heat when casting a non-INFERNO spell', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    castSpell('TIDAL_WAVE')
    expect(usePlayerStore.getState().heatStacks).toBe(2)
  })

  it('T3 heals 1 HP per Heat stack consumed', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(3)
    usePlayerStore.getState().takeDamage(50) // hp 100→50, also adds 1 heat
    for (let i = 0; i < 4; i++) usePlayerStore.getState().addHeat(7)
    // total heat: 5 (1 from takeDamage + 4 from addHeat)
    castSpell('INFERNO')
    expect(usePlayerStore.getState().hp).toBe(55) // 50 + 5 healed
  })

  it('T1 does NOT heal on consume', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().takeDamage(50)
    castSpell('INFERNO')
    expect(usePlayerStore.getState().hp).toBe(50) // 1 heat consumed but no heal at T1
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm run test -- src/__tests__/castSpell.test.ts
```

Expected: all FAIL — base `damage` is 40 unchanged, heat stays banked, no heal.

- [ ] **Step 3: Add the BoilingPoint block in `buildSpell`**

In `src/utils/castSpell.ts`, replace the entire `buildSpell` function (lines 13-38) with:

```ts
function buildSpell(spellType: SpellType): SpellEffect {
  const playerPos = usePlayerStore.getState().position
  const config = SPELL_CONFIG[spellType]
  let targetPos = { ...playerPos }
  if (spellType === 'METEOR') {
    const nearest = findNearestEnemy(playerPos, useEnemyStore.getState().enemies)
    if (nearest) targetPos = { ...nearest.position }
  }

  let damage = config.damage
  let radius = config.radius

  // Extra Spicy perk: boosts CHILI-based spells
  if (CHILI_SPELLS.includes(spellType)) {
    const extraSpicyStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'extra_spicy')?.stackCount || 0
    if (extraSpicyStacks > 0) {
      damage = damage * (1 + 0.2 * extraSpicyStacks)
      radius = Math.max(0.5, radius * (1 - 0.1 * extraSpicyStacks))
    }
  }

  // BoilingPoint perk: INFERNO consumes all banked Heat for bonus damage
  // (and at T3, heals 1 HP per stack consumed before clearing).
  if (spellType === 'INFERNO') {
    const bpStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'boiling_point')?.stackCount || 0
    if (bpStacks > 0) {
      const heat = usePlayerStore.getState().heatStacks
      if (heat > 0) {
        const tier = Math.min(bpStacks, 3)
        const basePerStack = [0.20, 0.20, 0.25][tier - 1]
        const overflow = Math.max(0, bpStacks - 3) * 0.05
        const perStack = basePerStack + overflow
        damage = damage * (1 + perStack * heat)
        if (tier >= 3) usePlayerStore.getState().heal(heat)
        usePlayerStore.getState().consumeHeat()
      }
    }
  }

  return {
    id: `spell_${spellId++}`, type: spellType, position: targetPos,
    radius, damage, duration: config.duration, elapsed: 0,
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm run test -- src/__tests__/castSpell.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/castSpell.ts src/__tests__/castSpell.test.ts
git commit -m "feat(castSpell): consume Heat on INFERNO with tier-scaled multiplier + T3 heal"
```

---

## Task 5: Spawn the consume VFX

When INFERNO consumes Heat, fire two sprite VFX: a burst at the player's position and a heat aura at the spell's target position. Visual side-effect — verified by running the dev server.

**Files:**
- Modify: `src/utils/castSpell.ts` — add `spawnSpriteVfx` calls inside the BoilingPoint consume block

- [ ] **Step 1: Add the import**

At the top of `src/utils/castSpell.ts`, add the spawn helper import (after the `findNearestEnemy` import on line 7):

```ts
import { spawnSpriteVfx } from './spawnVfx'
```

- [ ] **Step 2: Spawn the VFX inside the consume block**

In `src/utils/castSpell.ts`, find the line `if (tier >= 3) usePlayerStore.getState().heal(heat)` inside the BoilingPoint block and replace the whole `if (heat > 0)` block with:

```ts
      if (heat > 0) {
        const tier = Math.min(bpStacks, 3)
        const basePerStack = [0.20, 0.20, 0.25][tier - 1]
        const overflow = Math.max(0, bpStacks - 3) * 0.05
        const perStack = basePerStack + overflow
        damage = damage * (1 + perStack * heat)
        if (tier >= 3) usePlayerStore.getState().heal(heat)
        usePlayerStore.getState().consumeHeat()
        // VFX: burst on the player + heat aura on the spell target
        spawnSpriteVfx('boiling_point_consume', playerPos.x, playerPos.z, 5)
        spawnSpriteVfx('boiling_point_spell', targetPos.x, targetPos.z, radius * 2.5)
      }
```

- [ ] **Step 3: Update the test mock to record the spawn calls**

The existing `castSpell.test.ts` already mocks `__spawnSpriteVfx` (set up in `beforeEach`). Add a new `describe` block at the bottom of `src/__tests__/castSpell.test.ts`:

```ts
describe('castSpell + boiling_point VFX', () => {
  it('spawns both consume + spell VFX when Heat is consumed on INFERNO', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    castSpell('INFERNO')
    const calls = (window as any).__spawnSpriteVfx.mock.calls
    const slugs = calls.map((c: any[]) => c[0].spriteSlug)
    expect(slugs).toContain('boiling_point_consume')
    expect(slugs).toContain('boiling_point_spell')
  })

  it('does not spawn VFX when no Heat is banked', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    castSpell('INFERNO')
    const calls = (window as any).__spawnSpriteVfx.mock.calls
    const slugs = calls.map((c: any[]) => c[0].spriteSlug)
    expect(slugs).not.toContain('boiling_point_consume')
  })

  it('does not spawn VFX when casting non-INFERNO with banked Heat', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    castSpell('TIDAL_WAVE')
    const calls = (window as any).__spawnSpriteVfx.mock.calls
    const slugs = calls.map((c: any[]) => c[0].spriteSlug)
    expect(slugs).not.toContain('boiling_point_consume')
  })
})
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm run test -- src/__tests__/castSpell.test.ts
```

Expected: all PASS (both old and new blocks).

- [ ] **Step 5: Commit**

```bash
git add src/utils/castSpell.ts src/__tests__/castSpell.test.ts
git commit -m "feat(castSpell): spawn consume + spell-aura sprite VFX on Heat consume"
```

---

## Task 6: Run the 4s decay tick from `Player.tsx`

Wire the periodic decay into the existing `useFrame` in `Player.tsx`. No automated test — verify by running the dev server, taking damage with `boiling_point` active (use DevPanel to grant the perk), and watching Heat decrement after 4s of safety.

**Files:**
- Modify: `src/components/Player.tsx:46-113` — add `decayHeat` call in the existing `useFrame`

- [ ] **Step 1: Add the import**

At the top of `src/components/Player.tsx`, add `useDeckStore` (after the existing `useGameStore` import on line 6):

```ts
import { useDeckStore } from '../stores/deckStore'
```

- [ ] **Step 2: Add the decay tick inside the existing `useFrame`**

In `src/components/Player.tsx`, find the existing `useFrame((_, delta) => {` at line 46. Inside it, after the line `const phase = useGameStore.getState().phase` (line 67), add:

```ts
    // BoilingPoint Heat decay — fires every frame, but `decayHeat` is a
    // no-op until the 4s window since the last hit has elapsed.
    const bpStacksTick = useDeckStore.getState().activePerks.find((p) => p.id === 'boiling_point')?.stackCount ?? 0
    if (bpStacksTick > 0) usePlayerStore.getState().decayHeat(4000)
```

- [ ] **Step 3: Verify in the dev server**

```bash
npm run dev
```

Open the game, press the DEV button (bottom-left), grant the BoilingPoint perk, start a wave. Take damage from an enemy → confirm the player has Heat (we'll add the visual indicator in the next task; for now, you can verify in DevTools console: `usePlayerStore.getState().heatStacks`). Wait 4s without taking damage → Heat decrements by 1.

- [ ] **Step 4: Commit**

```bash
git add src/components/Player.tsx
git commit -m "feat(Player): tick Heat decay every frame when boiling_point is active"
```

---

## Task 7: Render the Heat stack number above the HP bar

Add a second `<Html>` overlay above the existing HP bar that shows the current Heat stack count. Color goes yellow → red along `heatStacks / maxStacks`. Shake CSS keyed off the same ratio. Hidden when `heatStacks === 0`.

**Files:**
- Modify: `src/components/Player.tsx` — add the Heat readout `<Html>` block

- [ ] **Step 1: Subscribe to Heat in the component body**

First, extend the `usePlayerStore` import at the top of `src/components/Player.tsx` (line 5) to also bring in the exported cap constant from Task 3:

```ts
import { usePlayerStore, BOILING_POINT_MAX_HEAT } from '../stores/playerStore'
```

Then find the existing subscriptions near the bottom of the component (around line 152-156):

```ts
const phase = useGameStore((s) => s.phase)
const position = usePlayerStore((s) => s.position)
const rotation = usePlayerStore((s) => s.rotation)
const hp = usePlayerStore((s) => s.hp)
const maxHp = usePlayerStore((s) => s.maxHp)
```

Add immediately after:

```ts
const heatStacks = usePlayerStore((s) => s.heatStacks)
const bpStacks = useDeckStore((s) => s.activePerks.find((p) => p.id === 'boiling_point')?.stackCount ?? 0)
const maxHeat = bpStacks > 0 ? BOILING_POINT_MAX_HEAT[Math.min(bpStacks, 3) - 1] : 0
```

- [ ] **Step 2: Render the Heat number `<Html>`**

In `src/components/Player.tsx`, find the existing HP bar `<Html>` block (lines 166-170). Right after that closing `</Html>`, add:

```tsx
        {heatStacks > 0 && (
          <Html position={[0, 2.6, 0]} center>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: heatStackColor(heatStacks, maxHeat),
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 6px currentColor',
                animation: heatShakeAnimation(heatStacks, maxHeat),
              }}
            >
              {heatStacks}
            </div>
          </Html>
        )}
```

- [ ] **Step 3: Add the helper functions and the keyframes**

At the bottom of `src/components/Player.tsx` (after the `useGLTF.preload` call on line 192), add:

```ts
// Heat stack number color: yellow (low) → red (max)
function heatStackColor(stacks: number, max: number): string {
  if (max === 0) return '#fbbf24'
  const t = Math.min(1, stacks / max)
  const r = Math.round(251 + (239 - 251) * t) // 251 → 239
  const g = Math.round(191 + (68 - 191) * t)  // 191 → 68
  const b = Math.round(36 + (68 - 36) * t)    // 36 → 68
  return `rgb(${r}, ${g}, ${b})`
}

// Increasing shake intensity as Heat approaches the cap.
function heatShakeAnimation(stacks: number, max: number): string {
  if (max === 0) return 'none'
  const t = stacks / max
  if (t < 0.4) return 'none'
  if (t < 0.7) return 'heat-shake-light 0.6s infinite'
  return 'heat-shake-heavy 0.15s infinite'
}
```

Then inject the keyframes once into the document `<head>` so the CSS animations exist. Add this near the top of `Player.tsx`, right after the `WIZARD_SCALE` constant (line 21):

```ts
if (typeof document !== 'undefined' && !document.getElementById('heat-shake-keyframes')) {
  const style = document.createElement('style')
  style.id = 'heat-shake-keyframes'
  style.textContent = `
    @keyframes heat-shake-light {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(-1px, 0); }
      75% { transform: translate(1px, 0); }
    }
    @keyframes heat-shake-heavy {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(-2px, -1px); }
      40% { transform: translate(2px, 1px); }
      60% { transform: translate(-2px, 1px); }
      80% { transform: translate(2px, -1px); }
    }
  `
  document.head.appendChild(style)
}
```

- [ ] **Step 4: Verify in the dev server**

```bash
npm run dev
```

Grant `boiling_point` via DevPanel. Take damage in combat. Confirm:
- Number "1" appears above the HP bar in yellow when Heat = 1
- Color shifts toward red as Heat climbs
- Shake starts subtle around 40% of cap, gets violent near 100%
- Number disappears when Heat decays back to 0

- [ ] **Step 5: Commit**

```bash
git add src/components/Player.tsx
git commit -m "feat(Player): render Heat stack number above HP bar with color + shake"
```

---

## Task 8: Red tint blink on the wizard model at Heat ≥5

When Heat reaches 5, the wizard model's materials get an emissive red multiply, toggled on/off at a stack-derived rate (5: ~1Hz, 6: ~2Hz, 7: ~4Hz). Cache the original emissive once in a ref so we can restore cleanly.

**Files:**
- Modify: `src/components/Player.tsx` — add a third `useFrame` for the tint blink

- [ ] **Step 1: Add the originals cache + blink state refs**

In `src/components/Player.tsx`, find the existing `useRef` declarations near the top of the component (around line 32-36):

```ts
const ghostsRef = useRef<{ x: number; z: number; time: number; index: number }[]>([])
const [ghosts, setGhosts] = useState<{ x: number; z: number; time: number; index: number }[]>([])
const ghostIndex = useRef(0)
const lastSpellColor = useRef('#22c55e')
const dashTrailColor = useRef('#22c55e')
```

Add immediately after:

```ts
const originalEmissives = useRef<Map<THREE.Material, THREE.Color>>(new Map())
const tintOn = useRef(false)
const lastBlinkAt = useRef(0)
```

- [ ] **Step 2: Add the blink useFrame**

After the second `useFrame` block (the one ending at line 150, just before the `const phase = useGameStore...` subscription block around line 152), add a third `useFrame`:

```ts
  useFrame(() => {
    const heat = usePlayerStore.getState().heatStacks
    const shouldBlink = heat >= 5
    const blinkHz = heat === 5 ? 1 : heat === 6 ? 2 : heat >= 7 ? 4 : 0
    const halfPeriodMs = blinkHz > 0 ? 500 / blinkHz : 0
    const now = performance.now()

    // Decide whether tint should be on this frame
    let nextTintOn = false
    if (shouldBlink && now - lastBlinkAt.current >= halfPeriodMs) {
      nextTintOn = !tintOn.current
      lastBlinkAt.current = now
    } else if (shouldBlink) {
      nextTintOn = tintOn.current
    } else {
      nextTintOn = false
    }

    if (nextTintOn === tintOn.current && shouldBlink) return
    tintOn.current = nextTintOn

    // Apply / restore emissive across all wizard materials
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined
      if (!mat || !('emissive' in mat)) return
      if (!originalEmissives.current.has(mat)) {
        originalEmissives.current.set(mat, mat.emissive.clone())
      }
      const original = originalEmissives.current.get(mat)!
      if (nextTintOn) {
        mat.emissive.setRGB(1.0, 0.15, 0.15)
      } else {
        mat.emissive.copy(original)
      }
    })
  })
```

- [ ] **Step 3: Verify in the dev server**

```bash
npm run dev
```

Grant `boiling_point` via DevPanel. Take damage to build Heat to 5 → wizard blinks red slowly (1Hz). Push to 6 → blinks faster. Push to 7 → blinks ~4 times per second (time-bomb feel). Cast INFERNO → tint clears immediately as Heat resets to 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/Player.tsx
git commit -m "feat(Player): blink red tint on wizard model at Heat >=5 (rate scales 5/6/7)"
```

---

## Task 9: Reward card layout — name colored by rarity, no rarity badge

Replace the small "EPIC" / "RARE" / "COMMON" / "LEGENDARY" badge above the icon with the perk name itself, colored by `RARITY_COLOR[perk.rarity]`. Remove the now-redundant separate name span. Apply the change to both `RewardScreen.tsx` and `DevPanel.tsx` so dev iteration matches the real reward flow.

**Files:**
- Modify: `src/ui/RewardScreen.tsx:88-95`
- Modify: `src/ui/DevPanel.tsx:95-102`

- [ ] **Step 1: Update `RewardScreen.tsx`**

In `src/ui/RewardScreen.tsx`, find lines 88-95 (the `EPIC`/rarity span followed by the `<PerkIcon>` and the white name span):

```tsx
              <span style={{
                fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase',
                color: rarityColor, fontWeight: 'bold', opacity: 0.9,
              }}>
                {perk.rarity}
              </span>
              <PerkIcon icon={perk.icon} size={72} />
              <span style={{ fontSize: '17px', fontWeight: 'bold' }}>{perk.name}</span>
```

Replace with:

```tsx
              <span style={{
                fontSize: '22px', fontWeight: 'bold', color: rarityColor,
                textShadow: `0 0 12px ${withAlpha(rarityColor, 0.4)}`,
              }}>
                {perk.name}
              </span>
              <PerkIcon icon={perk.icon} size={72} />
```

- [ ] **Step 2: Update `DevPanel.tsx`**

In `src/ui/DevPanel.tsx`, find lines 95-102 (same shape as RewardScreen, just smaller):

```tsx
                  <span style={{
                    fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase',
                    color: rarityColor, fontWeight: 'bold', opacity: 0.9,
                  }}>
                    {perk.rarity}
                  </span>
                  <PerkIcon icon={perk.icon} size={56} />
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{perk.name}</span>
```

Replace with:

```tsx
                  <span style={{
                    fontSize: '17px', fontWeight: 'bold', color: rarityColor,
                    textShadow: `0 0 10px ${withAlpha(rarityColor, 0.4)}`,
                  }}>
                    {perk.name}
                  </span>
                  <PerkIcon icon={perk.icon} size={56} />
```

- [ ] **Step 3: Run the existing reward-screen tests to make sure layout changes didn't break anything**

```bash
npm run test -- src/__tests__/rewardScreen.test.ts
```

Expected: PASS (these tests cover behavior, not exact pixel layout).

- [ ] **Step 4: Verify in the dev server**

```bash
npm run dev
```

Open the DevPanel — the 3 cards should now show the perk name in the rarity color (gray for common, blue for rare, purple for epic, gold for legendary) at the top. The "EPIC"/"RARE" text label is gone. Reroll a few times to see all rarities. Then trigger a real reward by completing a wave — same look there.

- [ ] **Step 5: Commit**

```bash
git add src/ui/RewardScreen.tsx src/ui/DevPanel.tsx
git commit -m "refactor(perk-card): name takes rarity slot, colored by rarity"
```

---

## Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: all PASS (no regressions).

- [ ] **Step 2: Run the linter**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: End-to-end dev playtest**

```bash
npm run dev
```

In a single playthrough, verify:
1. DevPanel shows BoilingPoint as a purple-named epic card (no "EPIC" badge above it).
2. Granting BoilingPoint → take damage → Heat number appears above HP bar in yellow, climbing toward red.
3. At Heat ≥5 the wizard blinks red, blink rate increases at 6 and 7.
4. Cast INFERNO with Heat banked → big damage spike, both VFX play (consume burst on player, heat aura on the spell), Heat clears, blink stops.
5. T3 BoilingPoint (grant 3× via DevPanel) → consuming Heat heals HP equal to stacks consumed.
6. Casting any non-INFERNO spell with Heat banked → Heat stays untouched.
7. After 4s without taking damage → Heat decreases by 1, repeats every 4s until 0.

If any of (1)–(7) fail, fix and re-test before merging.
