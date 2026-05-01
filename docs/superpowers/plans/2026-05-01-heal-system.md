# Heal System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the player two ways to recover HP during a run — a 4th "heal" card on the reward screen and heart pickups dropped from killed enemies — and surface their HP as a number in the top-left HUD.

**Architecture:** A tiny new `pickupStore` holds the active hearts on the floor. `enemyStore.setEnemyDying` is the single chokepoint where the 8% drop roll happens (skipped for boss). A new `HeartPickupManager` mounted inside `<Scene>` runs the per-frame collision check that consumes hearts and heals the player. Reward screen and HUD are pure UI tweaks that read state already tested elsewhere.

**Tech Stack:** React 19 + TypeScript, Three.js via @react-three/fiber, Zustand for state, Vitest for unit tests.

**Spec:** [docs/superpowers/specs/2026-05-01-heal-system-design.md](../specs/2026-05-01-heal-system-design.md)

---

## File Structure

| File | Purpose | New / Modify |
|---|---|---|
| `src/stores/pickupStore.ts` | Active hearts list + spawn/remove/reset + `HEART_DROP_CHANCE` const | **New** |
| `src/components/HeartPickup.tsx` | Single in-world heart 3D visual (bob + rotate) | **New** |
| `src/components/HeartPickupManager.tsx` | Renders all hearts + per-frame player collision | **New** |
| `src/__tests__/healSystem.test.ts` | Unit tests for store wiring | **New** |
| `src/stores/enemyStore.ts` | Drop roll inside `setEnemyDying`, gated to non-boss | Modify |
| `src/stores/gameStore.ts` | Clear hearts in `completeWave` and `reset` | Modify |
| `src/ui/RewardScreen.tsx` | Add 4th heal card (disabled at full HP) | Modify |
| `src/ui/HUD.tsx` | Add HP number line under "Enemies defeated" | Modify |
| `src/components/Scene.tsx` | Mount `<HeartPickupManager />` inside the canvas | Modify |

---

## Task 1: pickupStore — heart list + spawn/remove/reset

**Files:**
- Create: `src/stores/pickupStore.ts`
- Test: `src/__tests__/healSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/healSystem.test.ts` with this content:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePickupStore, HEART_DROP_CHANCE } from '../stores/pickupStore'

describe('pickupStore', () => {
  beforeEach(() => { usePickupStore.getState().reset() })

  it('starts empty', () => {
    expect(usePickupStore.getState().hearts).toEqual([])
  })

  it('spawn adds a heart at the given position', () => {
    usePickupStore.getState().spawn({ x: 5, z: 3 })
    const hearts = usePickupStore.getState().hearts
    expect(hearts).toHaveLength(1)
    expect(hearts[0].position).toEqual({ x: 5, z: 3 })
    expect(hearts[0].id).toBeTruthy()
  })

  it('spawn twice adds two hearts with distinct ids', () => {
    usePickupStore.getState().spawn({ x: 0, z: 0 })
    usePickupStore.getState().spawn({ x: 1, z: 1 })
    const hearts = usePickupStore.getState().hearts
    expect(hearts).toHaveLength(2)
    expect(hearts[0].id).not.toBe(hearts[1].id)
  })

  it('remove deletes the heart with the given id', () => {
    usePickupStore.getState().spawn({ x: 0, z: 0 })
    const id = usePickupStore.getState().hearts[0].id
    usePickupStore.getState().remove(id)
    expect(usePickupStore.getState().hearts).toEqual([])
  })

  it('reset clears all hearts', () => {
    usePickupStore.getState().spawn({ x: 0, z: 0 })
    usePickupStore.getState().spawn({ x: 1, z: 1 })
    usePickupStore.getState().reset()
    expect(usePickupStore.getState().hearts).toEqual([])
  })

  it('exports HEART_DROP_CHANCE = 0.08', () => {
    expect(HEART_DROP_CHANCE).toBe(0.08)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- healSystem`

Expected: All tests FAIL with "Cannot find module '../stores/pickupStore'" or similar import error.

- [ ] **Step 3: Implement pickupStore**

Create `src/stores/pickupStore.ts`:

```ts
import { create } from 'zustand'
import type { Position } from '../types'

export const HEART_DROP_CHANCE = 0.08

export interface HeartPickup {
  id: string
  position: Position
  spawnedAt: number
}

interface PickupState {
  hearts: HeartPickup[]
  spawn: (position: Position) => void
  remove: (id: string) => void
  reset: () => void
}

let nextId = 0

export const usePickupStore = create<PickupState>((set) => ({
  hearts: [],
  spawn: (position) => set((s) => ({
    hearts: [
      ...s.hearts,
      { id: `heart_${nextId++}`, position: { ...position }, spawnedAt: performance.now() },
    ],
  })),
  remove: (id) => set((s) => ({ hearts: s.hearts.filter((h) => h.id !== id) })),
  reset: () => set({ hearts: [] }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- healSystem`

Expected: All 6 `pickupStore` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/pickupStore.ts src/__tests__/healSystem.test.ts
git commit -m "feat(heal): add pickupStore for active heart pickups"
```

---

## Task 2: Heart drop hook in `setEnemyDying`

**Files:**
- Modify: `src/stores/enemyStore.ts:81` (`setEnemyDying`)
- Test: `src/__tests__/healSystem.test.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to `src/__tests__/healSystem.test.ts`:

```ts
import { useEnemyStore } from '../stores/enemyStore'

describe('enemyStore heart drop on death', () => {
  beforeEach(() => {
    useEnemyStore.getState().reset()
    usePickupStore.getState().reset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('spawns a heart at enemy position when roll < 0.08', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05)
    useEnemyStore.getState().spawnEnemy('slow', { x: 5, z: 3 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    const hearts = usePickupStore.getState().hearts
    expect(hearts).toHaveLength(1)
    expect(hearts[0].position).toEqual({ x: 5, z: 3 })
  })

  it('does NOT spawn a heart when roll >= 0.08', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    expect(usePickupStore.getState().hearts).toHaveLength(0)
  })

  it('does NOT spawn a heart when boss dies, even on lucky roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    expect(usePickupStore.getState().hearts).toHaveLength(0)
  })

  it('still marks the enemy as dying regardless of drop outcome', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    expect(useEnemyStore.getState().enemies[0].dying).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- healSystem`

Expected: 3 of the 4 new tests FAIL ("expected 1, received 0" etc). The "still marks dying" test passes (existing behavior).

- [ ] **Step 3: Modify `setEnemyDying`**

Open `src/stores/enemyStore.ts`. At the top of the file, add the imports:

```ts
import { usePickupStore, HEART_DROP_CHANCE } from './pickupStore'
```

Replace the existing one-liner at line 81:

```ts
  setEnemyDying: (id) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, dying: true } : e) })),
```

with:

```ts
  setEnemyDying: (id) => {
    const enemy = get().enemies.find((e) => e.id === id)
    if (enemy && enemy.type !== 'boss' && Math.random() < HEART_DROP_CHANCE) {
      usePickupStore.getState().spawn(enemy.position)
    }
    set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, dying: true } : e) }))
  },
```

Note: `get` is already destructured in the `create` call signature on line 35 — `((set, get) => ({`. No signature change needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- healSystem`

Expected: All 4 `enemyStore heart drop on death` tests PASS. Also confirm existing `enemyStore.test.ts` still passes:

Run: `npm run test`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/enemyStore.ts src/__tests__/healSystem.test.ts
git commit -m "feat(heal): drop heart pickup on non-boss enemy death (8%)"
```

---

## Task 3: Clear hearts on wave end and full reset

**Files:**
- Modify: `src/stores/gameStore.ts:44` (`completeWave`) and `src/stores/gameStore.ts:53` (`reset`)
- Test: `src/__tests__/healSystem.test.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to `src/__tests__/healSystem.test.ts`:

```ts
import { useGameStore } from '../stores/gameStore'

describe('gameStore clears hearts on wave end / reset', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
    usePickupStore.getState().reset()
  })

  it('completeWave clears all active hearts', () => {
    usePickupStore.getState().spawn({ x: 1, z: 1 })
    usePickupStore.getState().spawn({ x: 2, z: 2 })
    expect(usePickupStore.getState().hearts).toHaveLength(2)
    useGameStore.getState().completeWave()
    expect(usePickupStore.getState().hearts).toHaveLength(0)
  })

  it('reset clears all active hearts', () => {
    usePickupStore.getState().spawn({ x: 1, z: 1 })
    useGameStore.getState().reset()
    expect(usePickupStore.getState().hearts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- healSystem`

Expected: Both new tests FAIL ("expected 0, received 2/1").

- [ ] **Step 3: Modify gameStore**

Open `src/stores/gameStore.ts`. At the top of the file, add:

```ts
import { usePickupStore } from './pickupStore'
```

Replace `completeWave` on line 44:

```ts
  completeWave: () => set((s) => ({ phase: 'reward', stats: { ...s.stats, wavesCleared: s.stats.wavesCleared + 1 } })),
```

with:

```ts
  completeWave: () => {
    usePickupStore.getState().reset()
    set((s) => ({ phase: 'reward', stats: { ...s.stats, wavesCleared: s.stats.wavesCleared + 1 } }))
  },
```

Replace the `reset` action on lines 53–58:

```ts
  reset: () => set({
    phase: 'menu', currentWave: 0, timeScale: 1,
    stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
    shakeIntensity: 0, shakeEndTime: 0, freezeUntil: 0, screenFlashUntil: 0,
    surgeActive: false, surgeEndTime: 0, lullEndTime: 0,
  }),
```

with:

```ts
  reset: () => {
    usePickupStore.getState().reset()
    set({
      phase: 'menu', currentWave: 0, timeScale: 1,
      stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
      shakeIntensity: 0, shakeEndTime: 0, freezeUntil: 0, screenFlashUntil: 0,
      surgeActive: false, surgeEndTime: 0, lullEndTime: 0,
    })
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`

Expected: All tests PASS (full suite, not just healSystem).

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/__tests__/healSystem.test.ts
git commit -m "feat(heal): clear hearts on wave end and game reset"
```

---

## Task 4: Heart 3D visual

**Files:**
- Create: `src/components/HeartPickup.tsx`

This task has no automated test — it's a pure 3D rendering component. Visual verification happens in Task 5.

- [ ] **Step 1: Create HeartPickup.tsx**

Create `src/components/HeartPickup.tsx`:

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { Position } from '../types'

interface Props {
  position: Position
}

// Single in-world heart pickup. Bobs up and down + slowly rotates so it
// reads as a "thing to grab" rather than scenery. The actual collision /
// pickup logic lives in HeartPickupManager.
export default function HeartPickup({ position }: Props) {
  const meshRef = useRef<Mesh>(null)

  useFrame((_state, dt) => {
    if (!meshRef.current) return
    const t = performance.now() / 1000
    meshRef.current.position.y = 0.6 + Math.sin(t * 3) * 0.15
    meshRef.current.rotation.y += dt * 1.2
  })

  return (
    <mesh
      ref={meshRef}
      position={[position.x, 0.6, position.z]}
      castShadow
    >
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshStandardMaterial
        color="#ff3355"
        emissive="#ff3355"
        emissiveIntensity={1.5}
      />
    </mesh>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`

Expected: Build succeeds (no TypeScript errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/HeartPickup.tsx
git commit -m "feat(heal): add 3D heart pickup visual (sphere + bob/rotate)"
```

---

## Task 5: HeartPickupManager + mount in Scene

**Files:**
- Create: `src/components/HeartPickupManager.tsx`
- Modify: `src/components/Scene.tsx`

This task is verified manually in the dev server.

- [ ] **Step 1: Create HeartPickupManager.tsx**

Create `src/components/HeartPickupManager.tsx`:

```tsx
import { useFrame } from '@react-three/fiber'
import { usePickupStore } from '../stores/pickupStore'
import { usePlayerStore } from '../stores/playerStore'
import HeartPickup from './HeartPickup'

const PICKUP_RADIUS = 1.0
const HEART_HEAL_AMOUNT = 10

// Renders all active hearts and runs the per-frame collision check that
// consumes a heart when the player walks within PICKUP_RADIUS units.
export default function HeartPickupManager() {
  const hearts = usePickupStore((s) => s.hearts)

  useFrame(() => {
    const player = usePlayerStore.getState().position
    const list = usePickupStore.getState().hearts
    for (const h of list) {
      const dx = h.position.x - player.x
      const dz = h.position.z - player.z
      if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
        usePickupStore.getState().remove(h.id)
        usePlayerStore.getState().heal(HEART_HEAL_AMOUNT)
      }
    }
  })

  return (
    <>
      {hearts.map((h) => <HeartPickup key={h.id} position={h.position} />)}
    </>
  )
}
```

- [ ] **Step 2: Mount HeartPickupManager in Scene**

Open `src/components/Scene.tsx`. Add the import next to the other component imports (line 16 area):

```ts
import HeartPickupManager from './HeartPickupManager'
```

Add `<HeartPickupManager />` to the JSX, right after `<HazardManager />` on line 46. The block should look like:

```tsx
        <EnemyManager />
        <HazardManager />
        <HeartPickupManager />
        <SpellManager />
```

- [ ] **Step 3: Verify build + tests still pass**

Run: `npm run build && npm run test`

Expected: Both succeed.

- [ ] **Step 4: Manual playtest**

Run: `npm run dev`

Open the printed URL. Steps:
1. Click "Start Shift".
2. Kill ~20 enemies in wave 1 — at 8% drop rate you should see roughly 1–2 red glowing hearts on the ground.
3. Take damage from an enemy until HP < 100 (visible in the bar over your head).
4. Walk over a heart. Verify: heart disappears, your HP bar refills by 10.
5. Clear the wave. Verify: any remaining hearts vanish when the reward screen appears.
6. (Optional) Pick a perk → wave 2 starts with no leftover hearts.

If anything is off (heart never spawns, never picks up, persists across waves), debug before moving on.

- [ ] **Step 5: Commit**

```bash
git add src/components/HeartPickupManager.tsx src/components/Scene.tsx
git commit -m "feat(heal): heart pickup collision + heal +10 on contact"
```

---

## Task 6: HP number line in HUD

**Files:**
- Modify: `src/ui/HUD.tsx`

Manual verification — pure UI change reading already-tested store state.

- [ ] **Step 1: Modify HUD.tsx**

Open `src/ui/HUD.tsx`. The current top-left info box (lines 39–50) reads:

```tsx
      <div style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '10px 16px',
        color: 'white', fontWeight: 'bold',
      }}>
        <div style={{ fontSize: '14px', letterSpacing: '1px' }}>
          SHIFT 1 — WAVE {currentWave}/7
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
          Enemies defeated: {stats.enemiesDefeated}
        </div>
      </div>
```

`usePlayerStore` is already imported at the top of `HUD.tsx` (line 4) — no new import needed.

Subscribe to HP. After the existing `dashCooldownUntil` subscription on line 16, add:

```tsx
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)
```

Replace the info-box `<div>` block (lines 39–50) with:

```tsx
      <div style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '10px 16px',
        color: 'white', fontWeight: 'bold',
      }}>
        <div style={{ fontSize: '14px', letterSpacing: '1px' }}>
          SHIFT 1 — WAVE {currentWave}/7
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
          Enemies defeated: {stats.enemiesDefeated}
        </div>
        <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>❤️ HP:</span>
          <span style={{ color: hpColor(hp / maxHp), fontWeight: 'bold' }}>
            {hp} / {maxHp}
          </span>
        </div>
      </div>
```

Add this helper function above the `HUD` component (near the top of the file, after imports):

```ts
function hpColor(ratio: number): string {
  if (ratio > 0.5) return '#22c55e'
  if (ratio > 0.2) return '#fcd34d'
  return '#ef4444'
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`

Expected: Both succeed.

- [ ] **Step 3: Manual playtest**

Run: `npm run dev`

Steps:
1. Start Shift. Top-left info box should now show `❤️ HP: 100 / 100` in green.
2. Take damage to ~60 HP. Number should still be green (`60/100 = 0.6 > 0.5`).
3. Take damage to ~40 HP. Number turns yellow (`0.2 < 0.4 ≤ 0.5`).
4. Take damage to ~15 HP. Number turns red.
5. Walk over a heart pickup. Number ticks up by 10.

- [ ] **Step 4: Commit**

```bash
git add src/ui/HUD.tsx
git commit -m "feat(heal): show HP number in top-left HUD with threshold colour"
```

---

## Task 7: Reward screen heal card

**Files:**
- Modify: `src/ui/RewardScreen.tsx`

Manual verification — UI composition over already-tested store actions.

- [ ] **Step 1: Modify RewardScreen.tsx**

Open `src/ui/RewardScreen.tsx`. Add HP subscription and a heal handler at the top of the component, alongside the existing hooks (after line 17 where `setRerollsLeft` is declared):

```tsx
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)

  function pickHeal() {
    if (hp >= maxHp) return
    usePlayerStore.getState().heal(30)
    useDeckStore.getState().initHand()
    useGameStore.getState().nextWave()
  }
```

Add the `usePlayerStore` import at the top of the file:

```ts
import { usePlayerStore } from '../stores/playerStore'
```

Update the `FOOTER_WIDTH` constant on line 12 to account for one more card slot — the row is now 4 cards wide:

```ts
const FOOTER_WIDTH = CARD_WIDTH_PX * CARD_SCALE * 4 + CARD_GAP * 3
```

Find the `<div>` row that maps the perk cards (lines 61–69):

```tsx
      <div style={{ display: 'flex', gap: `${CARD_GAP}px`, alignItems: 'stretch' }}>
        {perks.map((perk) => (
          <PerkCard
            key={perk.id}
            perk={perk}
            currentTier={currentTierFor(perk.id)}
            onPick={() => pickPerk(perk)}
          />
        ))}
      </div>
```

Replace it with a row that also renders the heal card. Note `flexWrap: 'wrap'` and `justifyContent: 'center'` are added — `CARD_WIDTH=400` × `CARD_SCALE=0.9` × 4 cards plus gaps adds up to ~1500px, which overflows 1280px-wide laptops; wrap makes the heal card drop to a second row instead of clipping:

```tsx
      <div style={{
        display: 'flex',
        gap: `${CARD_GAP}px`,
        alignItems: 'stretch',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {perks.map((perk) => (
          <PerkCard
            key={perk.id}
            perk={perk}
            currentTier={currentTierFor(perk.id)}
            onPick={() => pickPerk(perk)}
          />
        ))}
        <HealCard hp={hp} maxHp={maxHp} onPick={pickHeal} />
      </div>
```

Then add the `HealCard` component at the bottom of the file (below the default export):

```tsx
function HealCard({ hp, maxHp, onPick }: { hp: number; maxHp: number; onPick: () => void }) {
  const disabled = hp >= maxHp
  return (
    <div
      onClick={disabled ? undefined : onPick}
      style={{
        zoom: CARD_SCALE,
        width: `${CARD_WIDTH_PX}px`,
        minHeight: '420px',
        borderRadius: '12px',
        border: `3px solid ${disabled ? 'rgba(255,255,255,0.2)' : '#ef4444'}`,
        background: disabled
          ? 'linear-gradient(180deg, rgba(60,20,20,0.6), rgba(30,10,10,0.6))'
          : 'linear-gradient(180deg, #4a1313, #1a0606)',
        boxShadow: disabled ? 'none' : '0 0 24px rgba(239,68,68,0.45)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        gap: '16px',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 0 32px rgba(239,68,68,0.7)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = disabled ? 'none' : '0 0 24px rgba(239,68,68,0.45)'
      }}
    >
      <div style={{ fontSize: '72px', lineHeight: 1 }}>❤️</div>
      <div style={{ color: '#fca5a5', fontSize: '24px', fontWeight: 'bold' }}>HEAL</div>
      <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>+30 HP</div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', textAlign: 'center' }}>
        {disabled ? 'HP เต็มแล้ว' : 'Skip the perk and recover health.'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm run test`

Expected: All three succeed.

- [ ] **Step 3: Manual playtest**

Run: `npm run dev`

Steps:
1. Start Shift. Take ~30 damage during wave 1 (HP ~70). Clear the wave.
2. Reward screen: 4 cards visible — 3 perks + 1 red heal card. Hover the heal card → glow gets brighter.
3. Click heal. Verify: HP becomes 100 (70 + 30), wave 2 begins, no perk added (`activePerks` length unchanged in HUD top-right).
4. Restart, take 0 damage in wave 1. Clear the wave.
5. Reward screen: heal card is grey/disabled with subtitle "HP เต็มแล้ว". Click it → nothing happens.
6. The Reroll button still rerolls only the 3 perk cards (heal card stays).
7. Skip still skips the entire reward.

- [ ] **Step 4: Commit**

```bash
git add src/ui/RewardScreen.tsx
git commit -m "feat(heal): add 4th heal card (+30 HP) to reward screen"
```

---

## Task 8: Final verification

**Files:** none — verification only.

- [ ] **Step 1: Run the full suite**

Run: `npm run test`

Expected: All tests PASS.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: TypeScript check + Vite build succeed with no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: ESLint produces no errors.

- [ ] **Step 4: End-to-end manual playtest**

Run: `npm run dev`

Full run-through:
1. New game. HUD top-left shows `❤️ HP: 100 / 100` green.
2. Wave 1 — take damage, watch the number drop and change colour through green → yellow → red as HP drops.
3. Kill enemies — ~8% should drop a glowing red heart. Walk over one → +10 HP.
4. Clear wave 1. Reward screen shows 4 cards. Pick the heal card → HP refills by 30, wave 2 starts.
5. (Optional) Take heavy damage; pick a perk instead next time. Heal card disabled when at full HP.
6. Reach wave 7 boss. Boss death does NOT drop a heart (verify by killing boss with low HP).

If everything checks out, the heal system is complete.

---

## Open follow-ups (not in this plan)

- `/icons/heart_pickup.png` will land via the existing `/save-icon` workflow. Once it merges, swap the `❤️` emoji in `RewardScreen.tsx` (`HealCard`) for a `<img src="/icons/heart_pickup.png" />` and optionally render the same image as a flat sprite in `HeartPickup.tsx`.
- Pickup VFX (`heart_pickup_idle.png` sprite sheet) is also out of scope for v1 — the 3D sphere is enough.
- Heart-drop perks ("hearts heal +5 more", "drop rate +50%") would slot into `data/perks.ts` later without touching the heal core.
