# The Alchemist's Kitchen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3D top-down rogue-like deckbuilder where players combine base ingredients (Chili, Bottle, Salt) in a cauldron to cast spells against waves of enemies.

**Architecture:** Zustand-first with React Three Fiber. All game state lives in 4 Zustand stores (game, deck, player, enemy). R3F renders the 3D scene reactively. `useFrame()` only for movement, collisions, and VFX. UI is HTML/CSS overlay.

**Tech Stack:** React, TypeScript, Three.js, React Three Fiber (R3F), Zustand, Vite

**Spec:** `docs/superpowers/specs/2026-04-03-alchemists-kitchen-design.md`

---

## File Map

```
src/
├── main.tsx                 # ReactDOM entry point
├── App.tsx                  # Root — Canvas + HUD overlay, phase routing
├── types.ts                 # All shared types/enums
├── stores/
│   ├── gameStore.ts         # Game phase, wave, stats, timeScale
│   ├── deckStore.ts         # Hand, cauldron, recipes, perks
│   ├── playerStore.ts       # Position, HP, status
│   └── enemyStore.ts        # Enemy list, spawning
├── data/
│   ├── recipes.ts           # Recipe Matrix lookup
│   └── perks.ts             # Perk pool definitions
├── utils/
│   └── collision.ts         # Distance-based hit detection
├── components/
│   ├── Scene.tsx            # R3F Canvas wrapper
│   ├── Arena.tsx            # Kitchen floor + walls
│   ├── Player.tsx           # Player mesh + movement + HP bar
│   ├── Enemy.tsx            # Single enemy mesh + AI movement
│   ├── EnemyManager.tsx     # Spawning logic, renders Enemy list
│   ├── Boss.tsx             # Hungry Golem + attack patterns
│   ├── Spell.tsx            # Spell effect rendering + collision
│   └── Camera.tsx           # Follow camera
├── ui/
│   ├── HUD.tsx              # Wave info, perk list, wraps CardHand + CauldronUI
│   ├── CardHand.tsx         # 3 ingredient cards at bottom
│   ├── CauldronUI.tsx       # 2 slots + cook button + recipe preview
│   ├── RewardScreen.tsx     # Pick-a-perk between waves
│   ├── DeathScreen.tsx      # The Final Bill
│   └── MainMenu.tsx         # Title screen
└── __tests__/
    ├── recipes.test.ts      # Recipe matrix tests
    ├── perks.test.ts        # Perk pool tests
    ├── deckStore.test.ts    # Deck/cauldron/cook logic tests
    ├── gameStore.test.ts    # Game flow/phase tests
    ├── playerStore.test.ts  # Player state tests
    ├── enemyStore.test.ts   # Enemy spawning/damage tests
    └── collision.test.ts    # Collision detection tests
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/types.ts`

- [ ] **Step 1: Initialize the project with Vite**

```bash
npm create vite@latest . -- --template react-ts
```

Say "yes" to overwrite if prompted (repo only has `.gitignore` and `docs/`).

- [ ] **Step 2: Install dependencies**

```bash
npm install three @react-three/fiber @react-three/drei zustand
npm install -D @types/three vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vitest**

Add to `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
})
```

Add to `tsconfig.json` under `compilerOptions`:

```json
"types": ["vitest/globals"]
```

Add test script to `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Create shared types file**

Create `src/types.ts`:

```ts
export type Ingredient = 'CHILI' | 'BOTTLE' | 'SALT'

export type SpellType = 'INFERNO' | 'TIDAL_WAVE' | 'FORTRESS' | 'STEAM' | 'METEOR' | 'MUD'

export type EnemyType = 'slow' | 'fast' | 'tanky' | 'boss'

export type GamePhase = 'menu' | 'combat' | 'reward' | 'boss' | 'death'

export type StatusEffect = 'normal' | 'soaked' | 'stunned'

export interface Position {
  x: number
  z: number
}

export interface Enemy {
  id: string
  position: Position
  hp: number
  maxHp: number
  type: EnemyType
  status: StatusEffect
}

export interface GameStats {
  enemiesDefeated: number
  ingredientsUsed: number
  wavesCleared: number
  spellsCast: Record<SpellType, number>
}

export interface Perk {
  id: string
  name: string
  icon: string
  description: string
  stackCount: number
}

export interface SpellEffect {
  id: string
  type: SpellType
  position: Position
  radius: number
  damage: number
  duration: number
  elapsed: number
}
```

- [ ] **Step 5: Create minimal App.tsx**

Replace `src/App.tsx`:

```tsx
export default function App() {
  return <div>Alchemist's Kitchen</div>
}
```

- [ ] **Step 6: Verify dev server runs**

```bash
npm run dev
```

Expected: Vite dev server starts, shows "Alchemist's Kitchen" in browser.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold project with Vite, R3F, Zustand, and shared types"
```

---

## Task 2: Recipe Matrix & Perk Definitions

**Files:**
- Create: `src/data/recipes.ts`, `src/data/perks.ts`, `src/__tests__/recipes.test.ts`, `src/__tests__/perks.test.ts`

- [ ] **Step 1: Write failing tests for recipes**

Create `src/__tests__/recipes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getRecipe } from '../data/recipes'

describe('getRecipe', () => {
  it('returns INFERNO for CHILI + CHILI', () => {
    expect(getRecipe('CHILI', 'CHILI')).toBe('INFERNO')
  })

  it('returns TIDAL_WAVE for BOTTLE + BOTTLE', () => {
    expect(getRecipe('BOTTLE', 'BOTTLE')).toBe('TIDAL_WAVE')
  })

  it('returns FORTRESS for SALT + SALT', () => {
    expect(getRecipe('SALT', 'SALT')).toBe('FORTRESS')
  })

  it('returns STEAM for CHILI + BOTTLE', () => {
    expect(getRecipe('CHILI', 'BOTTLE')).toBe('STEAM')
  })

  it('returns STEAM for BOTTLE + CHILI (order independent)', () => {
    expect(getRecipe('BOTTLE', 'CHILI')).toBe('STEAM')
  })

  it('returns METEOR for CHILI + SALT', () => {
    expect(getRecipe('CHILI', 'SALT')).toBe('METEOR')
  })

  it('returns METEOR for SALT + CHILI (order independent)', () => {
    expect(getRecipe('SALT', 'CHILI')).toBe('METEOR')
  })

  it('returns MUD for BOTTLE + SALT', () => {
    expect(getRecipe('BOTTLE', 'SALT')).toBe('MUD')
  })

  it('returns MUD for SALT + BOTTLE (order independent)', () => {
    expect(getRecipe('SALT', 'BOTTLE')).toBe('MUD')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/recipes.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement recipes**

Create `src/data/recipes.ts`:

```ts
import { Ingredient, SpellType } from '../types'

const RECIPE_MATRIX: Record<string, SpellType> = {
  'CHILI+CHILI': 'INFERNO',
  'BOTTLE+BOTTLE': 'TIDAL_WAVE',
  'SALT+SALT': 'FORTRESS',
  'BOTTLE+CHILI': 'STEAM',
  'CHILI+SALT': 'METEOR',
  'BOTTLE+SALT': 'MUD',
}

export function getRecipe(a: Ingredient, b: Ingredient): SpellType {
  const key = [a, b].sort().join('+')
  return RECIPE_MATRIX[key]
}

export const SPELL_CONFIG: Record<SpellType, { damage: number; radius: number; duration: number; knockback: number; slow: number }> = {
  INFERNO:    { damage: 40, radius: 5,   duration: 0.5, knockback: 0,   slow: 0 },
  TIDAL_WAVE: { damage: 15, radius: 7,   duration: 0.8, knockback: 8,   slow: 0 },
  FORTRESS:   { damage: 0,  radius: 3,   duration: 4,   knockback: 0,   slow: 0 },
  STEAM:      { damage: 10, radius: 4.5, duration: 3,   knockback: 0,   slow: 0.5 },
  METEOR:     { damage: 80, radius: 2,   duration: 0.3, knockback: 0,   slow: 0 },
  MUD:        { damage: 0,  radius: 4,   duration: 5,   knockback: 0,   slow: 0.5 },
}
```

- [ ] **Step 4: Run recipe tests to verify they pass**

```bash
npx vitest run src/__tests__/recipes.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Write failing tests for perks**

Create `src/__tests__/perks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PERK_POOL, getRandomPerks } from '../data/perks'

describe('PERK_POOL', () => {
  it('contains 5 perks', () => {
    expect(PERK_POOL).toHaveLength(5)
  })

  it('each perk has required fields', () => {
    for (const perk of PERK_POOL) {
      expect(perk).toHaveProperty('id')
      expect(perk).toHaveProperty('name')
      expect(perk).toHaveProperty('icon')
      expect(perk).toHaveProperty('description')
    }
  })
})

describe('getRandomPerks', () => {
  it('returns 3 perks', () => {
    const perks = getRandomPerks(3)
    expect(perks).toHaveLength(3)
  })

  it('returns no duplicates', () => {
    const perks = getRandomPerks(3)
    const ids = perks.map((p) => p.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('returns all 5 if asked for 5', () => {
    const perks = getRandomPerks(5)
    expect(perks).toHaveLength(5)
  })
})
```

- [ ] **Step 6: Run perk tests to verify they fail**

```bash
npx vitest run src/__tests__/perks.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement perks**

Create `src/data/perks.ts`:

```ts
export interface PerkDefinition {
  id: string
  name: string
  icon: string
  description: string
}

export const PERK_POOL: PerkDefinition[] = [
  {
    id: 'extra_spicy',
    name: 'Extra Spicy',
    icon: '🌶️',
    description: 'Chili spells +20% damage, smaller AOE',
  },
  {
    id: 'deep_freeze',
    name: 'Deep Freeze',
    icon: '🧊',
    description: 'Bottle spells stun enemies for 2 seconds',
  },
  {
    id: 'heavy_salt',
    name: 'Heavy Salt',
    icon: '🪨',
    description: 'Salt spells push enemies 2x further',
  },
  {
    id: 'fast_prep',
    name: 'Fast Prep',
    icon: '⚡',
    description: 'Cook cooldown reduced by 0.5s',
  },
  {
    id: 'double_batch',
    name: 'Double Batch',
    icon: '🧪',
    description: '10% chance spell triggers twice',
  },
]

export function getRandomPerks(count: number): PerkDefinition[] {
  const shuffled = [...PERK_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
```

- [ ] **Step 8: Run perk tests to verify they pass**

```bash
npx vitest run src/__tests__/perks.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/data/ src/__tests__/recipes.test.ts src/__tests__/perks.test.ts
git commit -m "feat: add recipe matrix and perk pool with tests"
```

---

## Task 3: Collision Utility

**Files:**
- Create: `src/utils/collision.ts`, `src/__tests__/collision.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/collision.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isInRange, getDistance, findNearestEnemy } from '../utils/collision'

describe('getDistance', () => {
  it('returns 0 for same position', () => {
    expect(getDistance({ x: 0, z: 0 }, { x: 0, z: 0 })).toBe(0)
  })

  it('returns correct distance', () => {
    expect(getDistance({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5)
  })
})

describe('isInRange', () => {
  it('returns true when within radius', () => {
    expect(isInRange({ x: 0, z: 0 }, { x: 1, z: 1 }, 2)).toBe(true)
  })

  it('returns false when outside radius', () => {
    expect(isInRange({ x: 0, z: 0 }, { x: 5, z: 5 }, 2)).toBe(false)
  })

  it('returns true when exactly at radius', () => {
    expect(isInRange({ x: 0, z: 0 }, { x: 3, z: 4 }, 5)).toBe(true)
  })
})

describe('findNearestEnemy', () => {
  const enemies = [
    { id: 'a', position: { x: 10, z: 0 }, hp: 10, maxHp: 10, type: 'slow' as const, status: 'normal' as const },
    { id: 'b', position: { x: 2, z: 0 }, hp: 10, maxHp: 10, type: 'slow' as const, status: 'normal' as const },
    { id: 'c', position: { x: 5, z: 0 }, hp: 10, maxHp: 10, type: 'slow' as const, status: 'normal' as const },
  ]

  it('returns the nearest enemy', () => {
    const nearest = findNearestEnemy({ x: 0, z: 0 }, enemies)
    expect(nearest?.id).toBe('b')
  })

  it('returns null for empty array', () => {
    expect(findNearestEnemy({ x: 0, z: 0 }, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/collision.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement collision utils**

Create `src/utils/collision.ts`:

```ts
import { Position, Enemy } from '../types'

export function getDistance(a: Position, b: Position): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

export function isInRange(a: Position, b: Position, radius: number): boolean {
  return getDistance(a, b) <= radius
}

export function findNearestEnemy(position: Position, enemies: Enemy[]): Enemy | null {
  if (enemies.length === 0) return null

  let nearest = enemies[0]
  let nearestDist = getDistance(position, nearest.position)

  for (let i = 1; i < enemies.length; i++) {
    const dist = getDistance(position, enemies[i].position)
    if (dist < nearestDist) {
      nearest = enemies[i]
      nearestDist = dist
    }
  }

  return nearest
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/collision.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/ src/__tests__/collision.test.ts
git commit -m "feat: add distance-based collision utilities with tests"
```

---

## Task 4: Game Store

**Files:**
- Create: `src/stores/gameStore.ts`, `src/__tests__/gameStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/gameStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../stores/gameStore'

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
  })

  it('starts in menu phase', () => {
    expect(useGameStore.getState().phase).toBe('menu')
  })

  it('startShift transitions to combat phase and resets wave to 1', () => {
    useGameStore.getState().startShift()
    const state = useGameStore.getState()
    expect(state.phase).toBe('combat')
    expect(state.currentWave).toBe(1)
  })

  it('nextWave increments wave and goes to reward phase', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    const state = useGameStore.getState()
    expect(state.phase).toBe('reward')
    expect(state.stats.wavesCleared).toBe(1)
  })

  it('nextWave transitions from reward to combat', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    useGameStore.getState().nextWave()
    const state = useGameStore.getState()
    expect(state.phase).toBe('combat')
    expect(state.currentWave).toBe(2)
  })

  it('triggerDeath sets phase to death and timeScale to 0.2', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().triggerDeath()
    const state = useGameStore.getState()
    expect(state.phase).toBe('death')
    expect(state.timeScale).toBe(0.2)
  })

  it('startBoss sets phase to boss after wave 7', () => {
    useGameStore.getState().startShift()
    useGameStore.setState({ currentWave: 7 })
    useGameStore.getState().startBoss()
    expect(useGameStore.getState().phase).toBe('boss')
  })

  it('tracks enemiesDefeated stat', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().recordEnemyDefeated()
    useGameStore.getState().recordEnemyDefeated()
    expect(useGameStore.getState().stats.enemiesDefeated).toBe(2)
  })

  it('tracks ingredientsUsed stat', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().recordIngredientUsed()
    expect(useGameStore.getState().stats.ingredientsUsed).toBe(1)
  })

  it('reset returns to initial state', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().recordEnemyDefeated()
    useGameStore.getState().reset()
    const state = useGameStore.getState()
    expect(state.phase).toBe('menu')
    expect(state.currentWave).toBe(0)
    expect(state.stats.enemiesDefeated).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/gameStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement gameStore**

Create `src/stores/gameStore.ts`:

```ts
import { create } from 'zustand'
import { GamePhase, GameStats, SpellType } from '../types'

interface GameState {
  phase: GamePhase
  currentWave: number
  timeScale: number
  stats: GameStats

  startShift: () => void
  completeWave: () => void
  nextWave: () => void
  startBoss: () => void
  triggerDeath: () => void
  recordEnemyDefeated: () => void
  recordIngredientUsed: () => void
  recordSpellCast: (spell: SpellType) => void
  reset: () => void
}

const initialStats: GameStats = {
  enemiesDefeated: 0,
  ingredientsUsed: 0,
  wavesCleared: 0,
  spellsCast: {} as Record<SpellType, number>,
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'menu',
  currentWave: 0,
  timeScale: 1,
  stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },

  startShift: () =>
    set({
      phase: 'combat',
      currentWave: 1,
      timeScale: 1,
      stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
    }),

  completeWave: () =>
    set((state) => ({
      phase: 'reward',
      stats: { ...state.stats, wavesCleared: state.stats.wavesCleared + 1 },
    })),

  nextWave: () =>
    set((state) => ({
      phase: 'combat',
      currentWave: state.currentWave + 1,
    })),

  startBoss: () => set({ phase: 'boss' }),

  triggerDeath: () => set({ phase: 'death', timeScale: 0.2 }),

  recordEnemyDefeated: () =>
    set((state) => ({
      stats: { ...state.stats, enemiesDefeated: state.stats.enemiesDefeated + 1 },
    })),

  recordIngredientUsed: () =>
    set((state) => ({
      stats: { ...state.stats, ingredientsUsed: state.stats.ingredientsUsed + 1 },
    })),

  recordSpellCast: (spell) =>
    set((state) => ({
      stats: {
        ...state.stats,
        spellsCast: {
          ...state.stats.spellsCast,
          [spell]: (state.stats.spellsCast[spell] || 0) + 1,
        },
      },
    })),

  reset: () =>
    set({
      phase: 'menu',
      currentWave: 0,
      timeScale: 1,
      stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
    }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/gameStore.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/__tests__/gameStore.test.ts
git commit -m "feat: add game store with phase management and stats tracking"
```

---

## Task 5: Player Store

**Files:**
- Create: `src/stores/playerStore.ts`, `src/__tests__/playerStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/playerStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../stores/playerStore'

describe('usePlayerStore', () => {
  beforeEach(() => {
    usePlayerStore.getState().reset()
  })

  it('starts at center with full HP', () => {
    const state = usePlayerStore.getState()
    expect(state.position).toEqual({ x: 0, z: 0 })
    expect(state.hp).toBe(100)
    expect(state.maxHp).toBe(100)
    expect(state.status).toBe('normal')
  })

  it('takeDamage reduces HP', () => {
    usePlayerStore.getState().takeDamage(30)
    expect(usePlayerStore.getState().hp).toBe(70)
  })

  it('takeDamage does not go below 0', () => {
    usePlayerStore.getState().takeDamage(150)
    expect(usePlayerStore.getState().hp).toBe(0)
  })

  it('heal increases HP', () => {
    usePlayerStore.getState().takeDamage(50)
    usePlayerStore.getState().heal(20)
    expect(usePlayerStore.getState().hp).toBe(70)
  })

  it('heal does not exceed maxHp', () => {
    usePlayerStore.getState().takeDamage(10)
    usePlayerStore.getState().heal(50)
    expect(usePlayerStore.getState().hp).toBe(100)
  })

  it('setPosition updates position', () => {
    usePlayerStore.getState().setPosition({ x: 5, z: 3 })
    expect(usePlayerStore.getState().position).toEqual({ x: 5, z: 3 })
  })

  it('setStatus changes status', () => {
    usePlayerStore.getState().setStatus('soaked')
    expect(usePlayerStore.getState().status).toBe('soaked')
  })

  it('reset restores initial state', () => {
    usePlayerStore.getState().takeDamage(50)
    usePlayerStore.getState().setPosition({ x: 10, z: 10 })
    usePlayerStore.getState().setStatus('stunned')
    usePlayerStore.getState().reset()
    const state = usePlayerStore.getState()
    expect(state.hp).toBe(100)
    expect(state.position).toEqual({ x: 0, z: 0 })
    expect(state.status).toBe('normal')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/playerStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement playerStore**

Create `src/stores/playerStore.ts`:

```ts
import { create } from 'zustand'
import { Position, StatusEffect } from '../types'

interface PlayerState {
  position: Position
  rotation: number
  hp: number
  maxHp: number
  status: StatusEffect

  setPosition: (pos: Position) => void
  setRotation: (rot: number) => void
  takeDamage: (amount: number) => void
  heal: (amount: number) => void
  setStatus: (status: StatusEffect) => void
  reset: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  position: { x: 0, z: 0 },
  rotation: 0,
  hp: 100,
  maxHp: 100,
  status: 'normal',

  setPosition: (pos) => set({ position: pos }),

  setRotation: (rot) => set({ rotation: rot }),

  takeDamage: (amount) =>
    set((state) => ({ hp: Math.max(0, state.hp - amount) })),

  heal: (amount) =>
    set((state) => ({ hp: Math.min(state.maxHp, state.hp + amount) })),

  setStatus: (status) => set({ status }),

  reset: () =>
    set({ position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal' }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/playerStore.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/playerStore.ts src/__tests__/playerStore.test.ts
git commit -m "feat: add player store with HP, position, and status"
```

---

## Task 6: Deck Store (Hand, Cauldron, Cook)

**Files:**
- Create: `src/stores/deckStore.ts`, `src/__tests__/deckStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/deckStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useDeckStore } from '../stores/deckStore'

describe('useDeckStore', () => {
  beforeEach(() => {
    useDeckStore.getState().reset()
  })

  it('initializes with 3 ingredients in hand', () => {
    useDeckStore.getState().initHand()
    expect(useDeckStore.getState().hand).toHaveLength(3)
  })

  it('each hand ingredient is CHILI, BOTTLE, or SALT', () => {
    useDeckStore.getState().initHand()
    for (const card of useDeckStore.getState().hand) {
      expect(['CHILI', 'BOTTLE', 'SALT']).toContain(card)
    }
  })

  it('slotIngredient moves card from hand to cauldron slot A', () => {
    useDeckStore.getState().initHand()
    const firstCard = useDeckStore.getState().hand[0]
    useDeckStore.getState().slotIngredient(0)
    const state = useDeckStore.getState()
    expect(state.cauldron.slotA).toBe(firstCard)
    expect(state.cauldron.slotB).toBeNull()
    expect(state.hand).toHaveLength(3) // new card drawn
  })

  it('slotIngredient fills slot B when A is full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    const secondCard = useDeckStore.getState().hand[0]
    useDeckStore.getState().slotIngredient(0)
    const state = useDeckStore.getState()
    expect(state.cauldron.slotA).not.toBeNull()
    expect(state.cauldron.slotB).toBe(secondCard)
  })

  it('slotIngredient does nothing when both slots are full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(0)
    const handBefore = [...useDeckStore.getState().hand]
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().hand).toEqual(handBefore)
  })

  it('cook returns spell type and clears cauldron', () => {
    useDeckStore.getState().initHand()
    // Manually set cauldron for deterministic test
    useDeckStore.setState({ cauldron: { slotA: 'CHILI', slotB: 'CHILI' } })
    const spell = useDeckStore.getState().cook()
    expect(spell).toBe('INFERNO')
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
  })

  it('cook returns null when cauldron is not full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.setState({ cauldron: { slotA: 'CHILI', slotB: null } })
    const spell = useDeckStore.getState().cook()
    expect(spell).toBeNull()
  })

  it('addPerk adds to activePerks', () => {
    useDeckStore.getState().addPerk({
      id: 'extra_spicy',
      name: 'Extra Spicy',
      icon: '🌶️',
      description: 'Chili spells +20% damage',
      stackCount: 1,
    })
    expect(useDeckStore.getState().activePerks).toHaveLength(1)
  })

  it('addPerk increments stackCount for duplicate perks', () => {
    const perk = {
      id: 'extra_spicy',
      name: 'Extra Spicy',
      icon: '🌶️',
      description: 'Chili spells +20% damage',
      stackCount: 1,
    }
    useDeckStore.getState().addPerk(perk)
    useDeckStore.getState().addPerk(perk)
    const perks = useDeckStore.getState().activePerks
    expect(perks).toHaveLength(1)
    expect(perks[0].stackCount).toBe(2)
  })

  it('reset clears everything', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().addPerk({
      id: 'extra_spicy',
      name: 'Extra Spicy',
      icon: '🌶️',
      description: 'test',
      stackCount: 1,
    })
    useDeckStore.getState().reset()
    const state = useDeckStore.getState()
    expect(state.hand).toHaveLength(0)
    expect(state.cauldron.slotA).toBeNull()
    expect(state.activePerks).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/deckStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement deckStore**

Create `src/stores/deckStore.ts`:

```ts
import { create } from 'zustand'
import { Ingredient, Perk, SpellType } from '../types'
import { getRecipe } from '../data/recipes'

const INGREDIENTS: Ingredient[] = ['CHILI', 'BOTTLE', 'SALT']

function drawRandomIngredient(): Ingredient {
  return INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]
}

interface DeckState {
  hand: Ingredient[]
  cauldron: { slotA: Ingredient | null; slotB: Ingredient | null }
  activePerks: Perk[]
  cookCooldown: number

  initHand: () => void
  slotIngredient: (handIndex: number) => void
  cook: () => SpellType | null
  addPerk: (perk: Perk) => void
  reset: () => void
}

export const useDeckStore = create<DeckState>((set, get) => ({
  hand: [],
  cauldron: { slotA: null, slotB: null },
  activePerks: [],
  cookCooldown: 0,

  initHand: () =>
    set({
      hand: [drawRandomIngredient(), drawRandomIngredient(), drawRandomIngredient()],
      cauldron: { slotA: null, slotB: null },
    }),

  slotIngredient: (handIndex) => {
    const state = get()
    if (state.cauldron.slotA !== null && state.cauldron.slotB !== null) return
    if (handIndex < 0 || handIndex >= state.hand.length) return

    const ingredient = state.hand[handIndex]
    const newHand = [...state.hand]
    newHand[handIndex] = drawRandomIngredient()

    if (state.cauldron.slotA === null) {
      set({ hand: newHand, cauldron: { slotA: ingredient, slotB: null } })
    } else {
      set({ hand: newHand, cauldron: { slotA: state.cauldron.slotA, slotB: ingredient } })
    }
  },

  cook: () => {
    const state = get()
    if (state.cauldron.slotA === null || state.cauldron.slotB === null) return null

    const spell = getRecipe(state.cauldron.slotA, state.cauldron.slotB)
    set({ cauldron: { slotA: null, slotB: null } })
    return spell
  },

  addPerk: (perk) =>
    set((state) => {
      const existing = state.activePerks.find((p) => p.id === perk.id)
      if (existing) {
        return {
          activePerks: state.activePerks.map((p) =>
            p.id === perk.id ? { ...p, stackCount: p.stackCount + 1 } : p
          ),
        }
      }
      return { activePerks: [...state.activePerks, { ...perk, stackCount: 1 }] }
    }),

  reset: () =>
    set({ hand: [], cauldron: { slotA: null, slotB: null }, activePerks: [], cookCooldown: 0 }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/deckStore.test.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/deckStore.ts src/__tests__/deckStore.test.ts
git commit -m "feat: add deck store with hand, cauldron, cook, and stackable perks"
```

---

## Task 7: Enemy Store

**Files:**
- Create: `src/stores/enemyStore.ts`, `src/__tests__/enemyStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/enemyStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useEnemyStore } from '../stores/enemyStore'

describe('useEnemyStore', () => {
  beforeEach(() => {
    useEnemyStore.getState().reset()
  })

  it('starts with no enemies', () => {
    expect(useEnemyStore.getState().enemies).toHaveLength(0)
  })

  it('spawnEnemy adds an enemy', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 10, z: 0 })
    const enemies = useEnemyStore.getState().enemies
    expect(enemies).toHaveLength(1)
    expect(enemies[0].type).toBe('slow')
    expect(enemies[0].position).toEqual({ x: 10, z: 0 })
  })

  it('slow enemies have correct HP', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('fast enemies have correct HP', () => {
    useEnemyStore.getState().spawnEnemy('fast', { x: 0, z: 0 })
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('tanky enemies have 3x HP', () => {
    useEnemyStore.getState().spawnEnemy('tanky', { x: 0, z: 0 })
    expect(useEnemyStore.getState().enemies[0].hp).toBe(90)
  })

  it('boss has 15x HP', () => {
    useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: 0 })
    expect(useEnemyStore.getState().enemies[0].hp).toBe(450)
  })

  it('damageEnemy reduces enemy HP', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().damageEnemy(id, 10)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(20)
  })

  it('damageEnemy does not go below 0', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().damageEnemy(id, 999)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(0)
  })

  it('removeEnemy removes by id', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('fast', { x: 5, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().removeEnemy(id)
    expect(useEnemyStore.getState().enemies).toHaveLength(1)
  })

  it('updateEnemyPosition moves an enemy', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 10, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().updateEnemyPosition(id, { x: 8, z: 1 })
    expect(useEnemyStore.getState().enemies[0].position).toEqual({ x: 8, z: 1 })
  })

  it('reset clears all enemies', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('fast', { x: 5, z: 0 })
    useEnemyStore.getState().reset()
    expect(useEnemyStore.getState().enemies).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/enemyStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement enemyStore**

Create `src/stores/enemyStore.ts`:

```ts
import { create } from 'zustand'
import { Enemy, EnemyType, Position, StatusEffect } from '../types'

const BASE_HP = 30

const HP_MULTIPLIER: Record<EnemyType, number> = {
  slow: 1,
  fast: 1,
  tanky: 3,
  boss: 15,
}

let nextId = 0

interface EnemyState {
  enemies: Enemy[]

  spawnEnemy: (type: EnemyType, position: Position) => void
  damageEnemy: (id: string, amount: number) => void
  removeEnemy: (id: string) => void
  updateEnemyPosition: (id: string, position: Position) => void
  setEnemyStatus: (id: string, status: StatusEffect) => void
  reset: () => void
}

export const useEnemyStore = create<EnemyState>((set) => ({
  enemies: [],

  spawnEnemy: (type, position) => {
    const hp = BASE_HP * HP_MULTIPLIER[type]
    const enemy: Enemy = {
      id: `enemy_${nextId++}`,
      position,
      hp,
      maxHp: hp,
      type,
      status: 'normal',
    }
    set((state) => ({ enemies: [...state.enemies, enemy] }))
  },

  damageEnemy: (id, amount) =>
    set((state) => ({
      enemies: state.enemies.map((e) =>
        e.id === id ? { ...e, hp: Math.max(0, e.hp - amount) } : e
      ),
    })),

  removeEnemy: (id) =>
    set((state) => ({
      enemies: state.enemies.filter((e) => e.id !== id),
    })),

  updateEnemyPosition: (id, position) =>
    set((state) => ({
      enemies: state.enemies.map((e) => (e.id === id ? { ...e, position } : e)),
    })),

  setEnemyStatus: (id, status) =>
    set((state) => ({
      enemies: state.enemies.map((e) => (e.id === id ? { ...e, status } : e)),
    })),

  reset: () => set({ enemies: [] }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/enemyStore.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/enemyStore.ts src/__tests__/enemyStore.test.ts
git commit -m "feat: add enemy store with spawning, damage, and type-based HP"
```

---

## Task 8: 3D Scene — Arena, Camera, Player

**Files:**
- Create: `src/components/Scene.tsx`, `src/components/Arena.tsx`, `src/components/Camera.tsx`, `src/components/Player.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the Arena component**

Create `src/components/Arena.tsx`:

```tsx
import { useRef } from 'react'
import * as THREE from 'three'

const ARENA_SIZE = 20
const WALL_HEIGHT = 2
const WALL_THICKNESS = 0.5

export default function Arena() {
  return (
    <group>
      {/* Kitchen floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#3a3028" />
      </mesh>

      {/* Floor grid pattern */}
      <gridHelper args={[ARENA_SIZE, 10, '#4a4038', '#4a4038']} position={[0, 0.01, 0]} />

      {/* Walls — North */}
      <mesh position={[0, WALL_HEIGHT / 2, -ARENA_SIZE / 2]}>
        <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      {/* Walls — South */}
      <mesh position={[0, WALL_HEIGHT / 2, ARENA_SIZE / 2]}>
        <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      {/* Walls — East */}
      <mesh position={[ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      {/* Walls — West */}
      <mesh position={[-ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
    </group>
  )
}

export { ARENA_SIZE }
```

- [ ] **Step 2: Create the Camera component**

Create `src/components/Camera.tsx`:

```tsx
import { useFrame, useThree } from '@react-three/fiber'
import { usePlayerStore } from '../stores/playerStore'
import * as THREE from 'three'

const CAMERA_HEIGHT = 18
const CAMERA_OFFSET_Z = 10
const CAMERA_LERP_SPEED = 0.08

export default function Camera() {
  const { camera } = useThree()

  useFrame(() => {
    const { position } = usePlayerStore.getState()

    const targetX = position.x
    const targetZ = position.z + CAMERA_OFFSET_Z

    camera.position.x += (targetX - camera.position.x) * CAMERA_LERP_SPEED
    camera.position.z += (targetZ - camera.position.z) * CAMERA_LERP_SPEED
    camera.position.y = CAMERA_HEIGHT

    camera.lookAt(new THREE.Vector3(position.x, 0, position.z))
  })

  return null
}
```

- [ ] **Step 3: Create the Player component**

Create `src/components/Player.tsx`:

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { ARENA_SIZE } from './Arena'

const PLAYER_SPEED = 8
const PLAYER_RADIUS = 0.5
const BOUNDARY = ARENA_SIZE / 2 - PLAYER_RADIUS - 0.5

const keys: Record<string, boolean> = {}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true })
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })
}

export default function Player() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') return

    const timeScale = useGameStore.getState().timeScale
    const { status } = usePlayerStore.getState()
    const speedMult = status === 'soaked' ? 0.5 : status === 'stunned' ? 0 : 1

    let dx = 0
    let dz = 0
    if (keys['w'] || keys['arrowup']) dz -= 1
    if (keys['s'] || keys['arrowdown']) dz += 1
    if (keys['a'] || keys['arrowleft']) dx -= 1
    if (keys['d'] || keys['arrowright']) dx += 1

    if (dx === 0 && dz === 0) return

    // Normalize diagonal movement
    const len = Math.sqrt(dx * dx + dz * dz)
    dx /= len
    dz /= len

    const pos = usePlayerStore.getState().position
    const newX = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.x + dx * PLAYER_SPEED * speedMult * timeScale * delta))
    const newZ = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.z + dz * PLAYER_SPEED * speedMult * timeScale * delta))

    usePlayerStore.getState().setPosition({ x: newX, z: newZ })

    // Face movement direction
    const angle = Math.atan2(dx, -dz)
    usePlayerStore.getState().setRotation(angle)
  })

  const position = usePlayerStore((s) => s.position)
  const rotation = usePlayerStore((s) => s.rotation)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Player capsule body */}
      <mesh ref={meshRef} position={[0, 0.75, 0]} rotation={[0, rotation, 0]} castShadow>
        <capsuleGeometry args={[PLAYER_RADIUS, 0.8, 8, 16]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      {/* HP bar */}
      <Html position={[0, 2, 0]} center>
        <div style={{
          width: '60px',
          height: '6px',
          background: '#333',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(hp / maxHp) * 100}%`,
            height: '100%',
            background: hp / maxHp > 0.3 ? '#22c55e' : '#ef4444',
            borderRadius: '3px',
            transition: 'width 0.2s',
          }} />
        </div>
      </Html>
    </group>
  )
}
```

- [ ] **Step 4: Create the Scene wrapper**

Create `src/components/Scene.tsx`:

```tsx
import { Canvas } from '@react-three/fiber'
import Arena from './Arena'
import Camera from './Camera'
import Player from './Player'

export default function Scene() {
  return (
    <Canvas shadows>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <Camera />
      <Arena />
      <Player />
    </Canvas>
  )
}
```

- [ ] **Step 5: Update App.tsx to render the scene**

Replace `src/App.tsx`:

```tsx
import Scene from './components/Scene'
import { useGameStore } from './stores/gameStore'

export default function App() {
  const phase = useGameStore((s) => s.phase)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Scene />

      {/* Phase-based UI overlays will go here later */}
      {phase === 'menu' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          zIndex: 10,
        }}>
          <button
            onClick={() => useGameStore.getState().startShift()}
            style={{
              padding: '16px 32px',
              fontSize: '24px',
              background: '#f59e0b',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            START SHIFT
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Update CSS reset in index.css**

Replace `src/index.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  overflow: hidden;
  background: #000;
}
```

- [ ] **Step 7: Verify the scene renders**

```bash
npm run dev
```

Expected: Browser shows a 3D kitchen floor with walls, a green capsule player, and a "START SHIFT" button overlay. Click the button → button disappears, WASD moves the player. Camera follows.

- [ ] **Step 8: Commit**

```bash
git add src/components/ src/App.tsx src/index.css
git commit -m "feat: add 3D scene with arena, player movement, and camera follow"
```

---

## Task 9: Enemy Rendering & AI Movement

**Files:**
- Create: `src/components/Enemy.tsx`, `src/components/EnemyManager.tsx`
- Modify: `src/components/Scene.tsx`

- [ ] **Step 1: Create the Enemy component**

Create `src/components/Enemy.tsx`:

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { Enemy as EnemyType } from '../types'

const SPEED: Record<string, number> = {
  slow: 2,
  fast: 4,
  tanky: 1.5,
  boss: 1,
}

const SIZE: Record<string, number> = {
  slow: 0.4,
  fast: 0.35,
  tanky: 0.6,
  boss: 1.2,
}

const COLOR: Record<string, string> = {
  slow: '#ef4444',
  fast: '#f97316',
  tanky: '#7c3aed',
  boss: '#dc2626',
}

const CONTACT_DAMAGE = 10
const CONTACT_COOLDOWN = 1

interface Props {
  enemy: EnemyType
}

export default function Enemy({ enemy }: Props) {
  const lastContactTime = useRef(0)

  useFrame((_, delta) => {
    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') return

    const timeScale = useGameStore.getState().timeScale
    const playerPos = usePlayerStore.getState().position

    const speed = SPEED[enemy.type] * (enemy.status === 'soaked' ? 0.5 : 1) * timeScale
    const dx = playerPos.x - enemy.position.x
    const dz = playerPos.z - enemy.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist > 0.5) {
      const nx = dx / dist
      const nz = dz / dist
      useEnemyStore.getState().updateEnemyPosition(enemy.id, {
        x: enemy.position.x + nx * speed * delta,
        z: enemy.position.z + nz * speed * delta,
      })
    }

    // Contact damage
    if (dist < 1) {
      const now = performance.now() / 1000
      if (now - lastContactTime.current > CONTACT_COOLDOWN) {
        lastContactTime.current = now
        usePlayerStore.getState().takeDamage(CONTACT_DAMAGE)

        if (usePlayerStore.getState().hp <= 0) {
          useGameStore.getState().triggerDeath()
        }
      }
    }
  })

  const size = SIZE[enemy.type]

  return (
    <mesh position={[enemy.position.x, size, enemy.position.z]} castShadow>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={COLOR[enemy.type]} />
    </mesh>
  )
}
```

- [ ] **Step 2: Create EnemyManager for spawning**

Create `src/components/EnemyManager.tsx`:

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { ARENA_SIZE } from './Arena'
import Enemy from './Enemy'
import { EnemyType } from '../types'

const SPAWN_INTERVAL_BASE = 3 // seconds between spawns
const ENEMIES_PER_WAVE = 20

function getSpawnPosition(): { x: number; z: number } {
  const edge = Math.floor(Math.random() * 4)
  const half = ARENA_SIZE / 2 - 1
  const rand = (Math.random() - 0.5) * ARENA_SIZE * 0.8

  switch (edge) {
    case 0: return { x: rand, z: -half } // North
    case 1: return { x: rand, z: half }  // South
    case 2: return { x: half, z: rand }  // East
    default: return { x: -half, z: rand } // West
  }
}

function getEnemyType(wave: number): EnemyType {
  if (wave <= 3) return 'slow'
  if (wave <= 6) {
    return Math.random() < 0.6 ? 'fast' : 'slow'
  }
  // Wave 7+
  const roll = Math.random()
  if (roll < 0.3) return 'tanky'
  if (roll < 0.7) return 'fast'
  return 'slow'
}

export default function EnemyManager() {
  const spawnTimer = useRef(0)
  const spawnedCount = useRef(0)
  const waveTimer = useRef(0)

  useFrame((_, delta) => {
    const { phase, currentWave, timeScale } = useGameStore.getState()
    if (phase !== 'combat') return

    const dt = delta * timeScale
    waveTimer.current += dt
    spawnTimer.current += dt

    const spawnInterval = Math.max(1, SPAWN_INTERVAL_BASE - currentWave * 0.2)

    if (spawnTimer.current >= spawnInterval && spawnedCount.current < ENEMIES_PER_WAVE) {
      spawnTimer.current = 0
      spawnedCount.current++
      const pos = getSpawnPosition()
      const type = getEnemyType(currentWave)
      useEnemyStore.getState().spawnEnemy(type, pos)
    }

    // Wave end: 60s elapsed or all enemies spawned and defeated
    const enemies = useEnemyStore.getState().enemies
    const allSpawned = spawnedCount.current >= ENEMIES_PER_WAVE
    const allDead = allSpawned && enemies.length === 0
    const timeUp = waveTimer.current >= 60

    if (allDead || timeUp) {
      spawnTimer.current = 0
      spawnedCount.current = 0
      waveTimer.current = 0
      useEnemyStore.getState().reset()

      const wave = useGameStore.getState().currentWave
      if (wave >= 7) {
        useGameStore.getState().startBoss()
      } else {
        useGameStore.getState().completeWave()
      }
    }
  })

  const enemies = useEnemyStore((s) => s.enemies)

  return (
    <>
      {enemies.map((enemy) => (
        <Enemy key={enemy.id} enemy={enemy} />
      ))}
    </>
  )
}
```

- [ ] **Step 3: Add EnemyManager to Scene**

Replace `src/components/Scene.tsx`:

```tsx
import { Canvas } from '@react-three/fiber'
import Arena from './Arena'
import Camera from './Camera'
import Player from './Player'
import EnemyManager from './EnemyManager'

export default function Scene() {
  return (
    <Canvas shadows>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <Camera />
      <Arena />
      <Player />
      <EnemyManager />
    </Canvas>
  )
}
```

- [ ] **Step 4: Verify enemies spawn and move**

```bash
npm run dev
```

Expected: Click "START SHIFT" → red/orange spheres spawn at edges and move toward the green player. Player takes damage on contact. HP bar decreases.

- [ ] **Step 5: Commit**

```bash
git add src/components/Enemy.tsx src/components/EnemyManager.tsx src/components/Scene.tsx
git commit -m "feat: add enemy spawning, AI movement, and contact damage"
```

---

## Task 10: Card Hand & Cauldron UI

**Files:**
- Create: `src/ui/HUD.tsx`, `src/ui/CardHand.tsx`, `src/ui/CauldronUI.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create CardHand component**

Create `src/ui/CardHand.tsx`:

```tsx
import { useDeckStore } from '../stores/deckStore'
import { Ingredient } from '../types'

const INGREDIENT_STYLE: Record<Ingredient, { bg: string; border: string; icon: string }> = {
  CHILI: { bg: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: '#fca5a5', icon: '🌶️' },
  BOTTLE: { bg: 'linear-gradient(135deg, #1e40af, #3b82f6)', border: '#93c5fd', icon: '🧴' },
  SALT: { bg: 'linear-gradient(135deg, #57534e, #78716c)', border: '#a8a29e', icon: '🧂' },
}

export default function CardHand() {
  const hand = useDeckStore((s) => s.hand)
  const slotIngredient = useDeckStore((s) => s.slotIngredient)

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
      {hand.map((ingredient, i) => {
        const style = INGREDIENT_STYLE[ingredient]
        return (
          <button
            key={i}
            onClick={() => slotIngredient(i)}
            style={{
              width: '65px',
              height: '85px',
              borderRadius: '8px',
              background: style.bg,
              border: `2px solid ${style.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              boxShadow: `0 2px 8px rgba(0,0,0,0.3)`,
              transition: 'transform 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <span style={{ fontSize: '20px' }}>{style.icon}</span>
            <span style={{ fontWeight: 'bold', fontSize: '10px', marginTop: '4px' }}>{ingredient}</span>
            <span style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>[{i + 1}]</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create CauldronUI component**

Create `src/ui/CauldronUI.tsx`:

```tsx
import { useDeckStore } from '../stores/deckStore'
import { useGameStore } from '../stores/gameStore'
import { getRecipe } from '../data/recipes'

const INGREDIENT_ICON: Record<string, string> = {
  CHILI: '🌶️',
  BOTTLE: '🧴',
  SALT: '🧂',
}

const SPELL_NAMES: Record<string, string> = {
  INFERNO: 'Inferno 🔥',
  TIDAL_WAVE: 'Tidal Wave 🌊',
  FORTRESS: 'Fortress 🏰',
  STEAM: 'Steam 💨',
  METEOR: 'Meteor ☄️',
  MUD: 'Mud 🟤',
}

export default function CauldronUI() {
  const cauldron = useDeckStore((s) => s.cauldron)
  const cook = useDeckStore((s) => s.cook)
  const recordIngredientUsed = useGameStore((s) => s.recordIngredientUsed)
  const recordSpellCast = useGameStore((s) => s.recordSpellCast)
  const bothFull = cauldron.slotA !== null && cauldron.slotB !== null

  const recipePreview = bothFull ? getRecipe(cauldron.slotA!, cauldron.slotB!) : null

  const handleCook = () => {
    const spell = cook()
    if (spell) {
      recordIngredientUsed()
      recordIngredientUsed()
      recordSpellCast(spell)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '9px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Cauldron
      </span>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Slot A */}
        <div style={{
          width: '45px', height: '45px', borderRadius: '50%',
          border: `2px dashed ${cauldron.slotA ? '#f59e0b' : 'rgba(245,158,11,0.4)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cauldron.slotA ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.05)',
        }}>
          {cauldron.slotA ? (
            <span style={{ fontSize: '16px' }}>{INGREDIENT_ICON[cauldron.slotA]}</span>
          ) : (
            <span style={{ fontSize: '10px', opacity: 0.4, color: '#f59e0b' }}>A</span>
          )}
        </div>

        <span style={{ fontSize: '14px', color: '#f59e0b' }}>+</span>

        {/* Slot B */}
        <div style={{
          width: '45px', height: '45px', borderRadius: '50%',
          border: `2px dashed ${cauldron.slotB ? '#f59e0b' : 'rgba(245,158,11,0.4)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cauldron.slotB ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.05)',
        }}>
          {cauldron.slotB ? (
            <span style={{ fontSize: '16px' }}>{INGREDIENT_ICON[cauldron.slotB]}</span>
          ) : (
            <span style={{ fontSize: '10px', opacity: 0.4, color: '#f59e0b' }}>B</span>
          )}
        </div>
      </div>

      {/* Recipe preview */}
      {recipePreview && (
        <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 'bold' }}>
          = {SPELL_NAMES[recipePreview]}
        </span>
      )}

      {/* Cook button */}
      <button
        onClick={handleCook}
        disabled={!bothFull}
        style={{
          padding: '6px 20px',
          background: bothFull ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${bothFull ? '#f59e0b' : 'rgba(245,158,11,0.2)'}`,
          borderRadius: '4px',
          fontSize: '11px',
          color: '#f59e0b',
          cursor: bothFull ? 'pointer' : 'default',
          opacity: bothFull ? 1 : 0.4,
          fontWeight: 'bold',
        }}
      >
        COOK [Space]
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create HUD component**

Create `src/ui/HUD.tsx`:

```tsx
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import CardHand from './CardHand'
import CauldronUI from './CauldronUI'

export default function HUD() {
  const currentWave = useGameStore((s) => s.currentWave)
  const stats = useGameStore((s) => s.stats)
  const activePerks = useDeckStore((s) => s.activePerks)

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {/* Top-left: Wave info */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px',
        background: 'rgba(0,0,0,0.6)', padding: '8px 14px', borderRadius: '8px',
        border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', fontSize: '13px',
      }}>
        <div style={{ fontWeight: 'bold' }}>SHIFT 1 — WAVE {currentWave}/7</div>
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
          Enemies defeated: {stats.enemiesDefeated}
        </div>
      </div>

      {/* Top-right: Active perks */}
      {activePerks.length > 0 && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: '8px',
          border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7', fontSize: '11px',
        }}>
          <div style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>Perks</div>
          {activePerks.map((p) => (
            <div key={p.id}>
              {p.icon} {p.name} {p.stackCount > 1 ? `×${p.stackCount}` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Bottom: Cards + Cauldron */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '24px',
        paddingBottom: '16px', pointerEvents: 'auto',
      }}>
        <CardHand />
        <CauldronUI />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add keyboard shortcuts for slotting and cooking**

Add to `src/App.tsx` — replace the file:

```tsx
import { useEffect } from 'react'
import Scene from './components/Scene'
import HUD from './ui/HUD'
import { useGameStore } from './stores/gameStore'
import { useDeckStore } from './stores/deckStore'

export default function App() {
  const phase = useGameStore((s) => s.phase)

  useEffect(() => {
    if (phase === 'combat' || phase === 'boss') {
      useDeckStore.getState().initHand()
    }
  }, [phase])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const phase = useGameStore.getState().phase
      if (phase !== 'combat' && phase !== 'boss') return

      if (e.key === '1') useDeckStore.getState().slotIngredient(0)
      if (e.key === '2') useDeckStore.getState().slotIngredient(1)
      if (e.key === '3') useDeckStore.getState().slotIngredient(2)
      if (e.key === ' ') {
        e.preventDefault()
        const spell = useDeckStore.getState().cook()
        if (spell) {
          useGameStore.getState().recordIngredientUsed()
          useGameStore.getState().recordIngredientUsed()
          useGameStore.getState().recordSpellCast(spell)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Scene />

      {(phase === 'combat' || phase === 'boss') && <HUD />}

      {phase === 'menu' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', zIndex: 10,
        }}>
          <h1 style={{ color: '#f59e0b', fontSize: '36px', marginBottom: '8px', fontFamily: 'serif' }}>
            The Alchemist's Kitchen
          </h1>
          <p style={{ color: '#a8a29e', marginBottom: '24px', fontSize: '14px' }}>
            Combine ingredients. Cast spells. Survive the shift.
          </p>
          <button
            onClick={() => useGameStore.getState().startShift()}
            style={{
              padding: '16px 32px', fontSize: '20px', background: '#f59e0b',
              border: 'none', borderRadius: '8px', color: 'white',
              cursor: 'pointer', fontWeight: 'bold',
            }}
          >
            START SHIFT
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify cards and cauldron work**

```bash
npm run dev
```

Expected: Click "START SHIFT" → HUD appears at bottom with 3 ingredient cards and cauldron. Press 1/2/3 or click cards to slot into cauldron. When both slots full, recipe preview shows. Press Space or click Cook to cast (spell effect not visible yet — just clears cauldron). New cards drawn immediately.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ src/App.tsx
git commit -m "feat: add card hand, cauldron UI, HUD, and keyboard controls"
```

---

## Task 11: Spell Effects & Collision

**Files:**
- Create: `src/components/Spell.tsx`
- Modify: `src/components/Scene.tsx`, `src/App.tsx`

- [ ] **Step 1: Create the Spell component**

Create `src/components/Spell.tsx`:

```tsx
import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SpellEffect as SpellEffectType, SpellType } from '../types'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { usePlayerStore } from '../stores/playerStore'
import { isInRange, findNearestEnemy } from '../utils/collision'
import { SPELL_CONFIG } from '../data/recipes'

const SPELL_COLOR: Record<SpellType, string> = {
  INFERNO: '#ef4444',
  TIDAL_WAVE: '#3b82f6',
  FORTRESS: '#9ca3af',
  STEAM: '#a855f7',
  METEOR: '#f97316',
  MUD: '#b48c50',
}

interface SpellProps {
  spell: SpellEffectType
  onComplete: (id: string) => void
}

function SpellVisual({ spell, onComplete }: SpellProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const hitEnemies = useRef<Set<string>>(new Set())

  useFrame((_, delta) => {
    const timeScale = useGameStore.getState().timeScale
    spell.elapsed += delta * timeScale

    if (spell.elapsed >= spell.duration) {
      onComplete(spell.id)
      return
    }

    const progress = spell.elapsed / spell.duration
    const config = SPELL_CONFIG[spell.type]

    // Collision check — hit each enemy at most once per spell
    const enemies = useEnemyStore.getState().enemies
    for (const enemy of enemies) {
      if (hitEnemies.current.has(enemy.id)) continue

      if (isInRange(spell.position, enemy.position, spell.radius * progress)) {
        hitEnemies.current.add(enemy.id)
        useEnemyStore.getState().damageEnemy(enemy.id, spell.damage)

        // Apply knockback for Tidal Wave
        if (spell.type === 'TIDAL_WAVE' && config.knockback > 0) {
          const dx = enemy.position.x - spell.position.x
          const dz = enemy.position.z - spell.position.z
          const dist = Math.sqrt(dx * dx + dz * dz) || 1
          useEnemyStore.getState().updateEnemyPosition(enemy.id, {
            x: enemy.position.x + (dx / dist) * config.knockback,
            z: enemy.position.z + (dz / dist) * config.knockback,
          })
        }

        // Apply slow for Steam/Mud
        if (config.slow > 0) {
          useEnemyStore.getState().setEnemyStatus(enemy.id, 'soaked')
        }

        // Check if enemy died
        const updated = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
        if (updated && updated.hp <= 0) {
          useEnemyStore.getState().removeEnemy(enemy.id)
          useGameStore.getState().recordEnemyDefeated()
        }
      }
    }

    // Scale visual
    if (meshRef.current) {
      if (spell.type === 'METEOR') {
        // Meteor drops from above
        meshRef.current.position.y = 10 * (1 - progress)
        meshRef.current.scale.setScalar(1)
      } else {
        // AOE expands
        const scale = spell.radius * progress * 2
        meshRef.current.scale.set(scale, 0.3, scale)
        meshRef.current.position.y = 0.15
      }

      // Fade out
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 1 - progress * 0.6
    }
  })

  const color = SPELL_COLOR[spell.type]

  if (spell.type === 'METEOR') {
    return (
      <mesh ref={meshRef} position={[spell.position.x, 10, spell.position.z]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color={color} transparent emissive={color} emissiveIntensity={2} />
      </mesh>
    )
  }

  return (
    <mesh ref={meshRef} position={[spell.position.x, 0.15, spell.position.z]}>
      <cylinderGeometry args={[0.5, 0.5, 0.3, 32]} />
      <meshStandardMaterial color={color} transparent opacity={0.7} emissive={color} emissiveIntensity={1} />
    </mesh>
  )
}

export default function SpellManager() {
  const [spells, setSpells] = useState<SpellEffectType[]>([])

  useEffect(() => {
    const handleSpellCast = (spell: SpellEffectType) => {
      setSpells((prev) => [...prev, spell])
    }
    ;(window as any).__castSpell = handleSpellCast
    return () => { delete (window as any).__castSpell }
  }, [])

  const handleComplete = (id: string) => {
    setSpells((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <>
      {spells.map((spell) => (
        <SpellVisual key={spell.id} spell={spell} onComplete={handleComplete} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Wire up spell casting in App.tsx**

Update the keydown handler and click handler in `src/App.tsx`. Replace the `if (e.key === ' ')` block and the cook handler in CauldronUI:

In `src/App.tsx`, update the space key handler:

```tsx
      if (e.key === ' ') {
        e.preventDefault()
        const spell = useDeckStore.getState().cook()
        if (spell) {
          useGameStore.getState().recordIngredientUsed()
          useGameStore.getState().recordIngredientUsed()
          useGameStore.getState().recordSpellCast(spell)
          castSpell(spell)
        }
      }
```

Add the `castSpell` function before the `App` component:

```tsx
import { SPELL_CONFIG } from './data/recipes'
import { SpellType, SpellEffect } from './types'
import { findNearestEnemy } from './utils/collision'
import { useEnemyStore } from './stores/enemyStore'
import { usePlayerStore } from './stores/playerStore'

let spellId = 0

function castSpell(spellType: SpellType) {
  const playerPos = usePlayerStore.getState().position
  const config = SPELL_CONFIG[spellType]

  let targetPos = { ...playerPos }

  // Meteor targets nearest enemy
  if (spellType === 'METEOR') {
    const nearest = findNearestEnemy(playerPos, useEnemyStore.getState().enemies)
    if (nearest) {
      targetPos = { ...nearest.position }
    }
  }

  const spell: SpellEffect = {
    id: `spell_${spellId++}`,
    type: spellType,
    position: targetPos,
    radius: config.radius,
    damage: config.damage,
    duration: config.duration,
    elapsed: 0,
  }

  ;(window as any).__castSpell?.(spell)
}
```

- [ ] **Step 3: Add SpellManager to Scene**

Update `src/components/Scene.tsx`:

```tsx
import { Canvas } from '@react-three/fiber'
import Arena from './Arena'
import Camera from './Camera'
import Player from './Player'
import EnemyManager from './EnemyManager'
import SpellManager from './Spell'

export default function Scene() {
  return (
    <Canvas shadows>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <Camera />
      <Arena />
      <Player />
      <EnemyManager />
      <SpellManager />
    </Canvas>
  )
}
```

- [ ] **Step 4: Update CauldronUI to also call castSpell on click-cook**

Update `src/ui/CauldronUI.tsx` — replace the `handleCook` function:

```tsx
const handleCook = () => {
  const spell = cook()
  if (spell) {
    recordIngredientUsed()
    recordIngredientUsed()
    recordSpellCast(spell)
    ;(window as any).__castSpell?.({
      id: `spell_${Date.now()}`,
      type: spell,
      position: { ...require('../stores/playerStore').usePlayerStore.getState().position },
      radius: require('../data/recipes').SPELL_CONFIG[spell].radius,
      damage: require('../data/recipes').SPELL_CONFIG[spell].damage,
      duration: require('../data/recipes').SPELL_CONFIG[spell].duration,
      elapsed: 0,
    })
  }
}
```

Actually, a cleaner approach — extract the castSpell function to a shared util. Create `src/utils/castSpell.ts`:

```ts
import { SpellType, SpellEffect } from '../types'
import { SPELL_CONFIG } from '../data/recipes'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { findNearestEnemy } from './collision'

let spellId = 0

export function castSpell(spellType: SpellType) {
  const playerPos = usePlayerStore.getState().position
  const config = SPELL_CONFIG[spellType]

  let targetPos = { ...playerPos }

  if (spellType === 'METEOR') {
    const nearest = findNearestEnemy(playerPos, useEnemyStore.getState().enemies)
    if (nearest) {
      targetPos = { ...nearest.position }
    }
  }

  const spell: SpellEffect = {
    id: `spell_${spellId++}`,
    type: spellType,
    position: targetPos,
    radius: config.radius,
    damage: config.damage,
    duration: config.duration,
    elapsed: 0,
  }

  ;(window as any).__castSpell?.(spell)
}
```

Then import from both `App.tsx` and `CauldronUI.tsx`:

In `src/App.tsx`, replace the inline castSpell:
```tsx
import { castSpell } from './utils/castSpell'
```

In `src/ui/CauldronUI.tsx`, update handleCook:
```tsx
import { castSpell } from '../utils/castSpell'

// In the component:
const handleCook = () => {
  const spell = cook()
  if (spell) {
    recordIngredientUsed()
    recordIngredientUsed()
    recordSpellCast(spell)
    castSpell(spell)
  }
}
```

- [ ] **Step 5: Verify spells work end-to-end**

```bash
npm run dev
```

Expected: Slot 2 ingredients → press Space → spell visual appears at player position (or at nearest enemy for Meteor). Expanding colored disc damages enemies in range. Enemies die and disappear when HP reaches 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/Spell.tsx src/utils/castSpell.ts src/components/Scene.tsx src/App.tsx src/ui/CauldronUI.tsx
git commit -m "feat: add spell effects with visual feedback and collision damage"
```

---

## Task 12: Reward Screen (Perk Selection)

**Files:**
- Create: `src/ui/RewardScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create RewardScreen component**

Create `src/ui/RewardScreen.tsx`:

```tsx
import { useState, useMemo } from 'react'
import { getRandomPerks, PerkDefinition } from '../data/perks'
import { useDeckStore } from '../stores/deckStore'
import { useGameStore } from '../stores/gameStore'
import { Perk } from '../types'

export default function RewardScreen() {
  const [choices] = useState<PerkDefinition[]>(() => getRandomPerks(3))
  const wavesCleared = useGameStore((s) => s.stats.wavesCleared)

  const handlePick = (perkDef: PerkDefinition) => {
    const perk: Perk = {
      id: perkDef.id,
      name: perkDef.name,
      icon: perkDef.icon,
      description: perkDef.description,
      stackCount: 1,
    }
    useDeckStore.getState().addPerk(perk)
    useGameStore.getState().nextWave()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', zIndex: 10,
    }}>
      <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
        WAVE {wavesCleared} CLEARED!
      </div>
      <div style={{ color: '#a8a29e', fontSize: '13px', marginBottom: '24px' }}>
        Choose a Kitchen Perk
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        {choices.map((perk) => (
          <button
            key={perk.id}
            onClick={() => handlePick(perk)}
            style={{
              width: '160px', padding: '20px 14px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.15)',
              textAlign: 'center', cursor: 'pointer', color: 'white',
              transition: 'border-color 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b'
              e.currentTarget.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ fontSize: '32px' }}>{perk.icon}</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '8px 0', color: '#f59e0b' }}>
              {perk.name}
            </div>
            <div style={{ fontSize: '11px', color: '#a8a29e', lineHeight: 1.4 }}>
              {perk.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add RewardScreen to App.tsx**

Add import and render in `src/App.tsx`:

```tsx
import RewardScreen from './ui/RewardScreen'

// In the JSX, add after the HUD:
{phase === 'reward' && <RewardScreen />}
```

- [ ] **Step 3: Verify reward screen works**

```bash
npm run dev
```

Expected: After surviving a wave (60s or 20 enemies defeated), reward screen appears with 3 perk cards. Click one → perk added to activePerks (visible in top-right), next wave starts. Picking same perk again increments the stack count.

- [ ] **Step 4: Commit**

```bash
git add src/ui/RewardScreen.tsx src/App.tsx
git commit -m "feat: add reward screen with stackable perk selection"
```

---

## Task 13: Death Screen (The Final Bill)

**Files:**
- Create: `src/ui/DeathScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create DeathScreen component**

Create `src/ui/DeathScreen.tsx`:

```tsx
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { SpellType } from '../types'

const SPELL_NAMES: Record<SpellType, string> = {
  INFERNO: 'Inferno',
  TIDAL_WAVE: 'Tidal Wave',
  FORTRESS: 'Fortress',
  STEAM: 'Steam',
  METEOR: 'Meteor',
  MUD: 'Mud',
}

export default function DeathScreen() {
  const stats = useGameStore((s) => s.stats)

  const bestCombo = Object.entries(stats.spellsCast).reduce<{ name: string; count: number }>(
    (best, [spell, count]) => {
      if (count > best.count) return { name: SPELL_NAMES[spell as SpellType], count }
      return best
    },
    { name: 'None', count: 0 }
  )

  const handleRestart = () => {
    useGameStore.getState().reset()
    useDeckStore.getState().reset()
    usePlayerStore.getState().reset()
    useEnemyStore.getState().reset()
    // Small delay then start
    setTimeout(() => useGameStore.getState().startShift(), 100)
  }

  const handleMenu = () => {
    useGameStore.getState().reset()
    useDeckStore.getState().reset()
    usePlayerStore.getState().reset()
    useEnemyStore.getState().reset()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', zIndex: 20,
      animation: 'fadeIn 0.8s ease-in',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{
        width: '300px', background: '#1c1917', border: '2px solid #44403c',
        borderRadius: '12px', padding: '28px', fontFamily: 'monospace',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center', fontSize: '20px', fontWeight: 'bold',
          color: '#ef4444', letterSpacing: '3px',
          borderBottom: '1px dashed #44403c', paddingBottom: '14px',
        }}>
          KITCHEN CLOSED
        </div>

        {/* Receipt items */}
        <div style={{ marginTop: '18px', fontSize: '13px', color: '#a8a29e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
            <span>Waves Survived</span>
            <span style={{ color: 'white' }}>{stats.wavesCleared}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
            <span>Ingredients Used</span>
            <span style={{ color: 'white' }}>{stats.ingredientsUsed}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
            <span>Enemies Defeated</span>
            <span style={{ color: 'white' }}>{stats.enemiesDefeated}</span>
          </div>
          <div style={{
            borderTop: '1px dashed #44403c', marginTop: '14px', paddingTop: '14px',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Best Combo</span>
            <span style={{ color: '#f97316' }}>
              {bestCombo.count > 0 ? `${bestCombo.name} ×${bestCombo.count}` : '—'}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={handleRestart}
            style={{
              padding: '10px', background: '#b91c1c', border: 'none',
              borderRadius: '6px', color: 'white', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace',
            }}
          >
            ONE MORE RUN
          </button>
          <button
            onClick={handleMenu}
            style={{
              padding: '8px', background: 'transparent',
              border: '1px solid #44403c', borderRadius: '6px',
              color: '#a8a29e', fontSize: '12px', cursor: 'pointer', fontFamily: 'monospace',
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add DeathScreen to App.tsx**

Add import and render in `src/App.tsx`:

```tsx
import DeathScreen from './ui/DeathScreen'

// In the JSX:
{phase === 'death' && <DeathScreen />}
```

- [ ] **Step 3: Verify death screen works**

```bash
npm run dev
```

Expected: When player HP reaches 0 → timeScale drops to 0.2 (slow-mo) → "KITCHEN CLOSED" receipt appears with stats. "ONE MORE RUN" restarts immediately. "Back to Menu" goes to title.

- [ ] **Step 4: Commit**

```bash
git add src/ui/DeathScreen.tsx src/App.tsx
git commit -m "feat: add death screen (The Final Bill) with stats receipt"
```

---

## Task 14: Boss Fight (The Hungry Golem)

**Files:**
- Create: `src/components/Boss.tsx`
- Modify: `src/components/Scene.tsx`, `src/components/EnemyManager.tsx`

- [ ] **Step 1: Create Boss component**

Create `src/components/Boss.tsx`:

```tsx
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnemyStore } from '../stores/enemyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { isInRange } from '../utils/collision'
import { ARENA_SIZE } from './Arena'

type BossAttack = 'heat_wave' | 'salt_rain' | 'deep_soak'

const ATTACK_SEQUENCE: BossAttack[] = ['heat_wave', 'salt_rain', 'deep_soak']
const TELEGRAPH_DURATION = 2
const ATTACK_PAUSE = 5
const BOSS_SPAWN_INTERVAL = 8

interface TelegraphZone {
  id: string
  position: { x: number; z: number }
  radius: number
}

export default function Boss() {
  const attackIndex = useRef(0)
  const phase = useRef<'idle' | 'telegraph' | 'attack'>('idle')
  const timer = useRef(0)
  const soakAngle = useRef(0)
  const spawnTimer = useRef(0)
  const [telegraphs, setTelegraphs] = useState<TelegraphZone[]>([])
  const [soakBeam, setSoakBeam] = useState<{ angle: number; active: boolean }>({ angle: 0, active: false })

  const boss = useEnemyStore((s) => s.enemies.find((e) => e.type === 'boss'))

  useFrame((_, delta) => {
    if (!boss) return
    const gamePhase = useGameStore.getState().phase
    if (gamePhase !== 'boss') return

    const timeScale = useGameStore.getState().timeScale
    const dt = delta * timeScale
    timer.current += dt
    spawnTimer.current += dt

    // Spawn small slimes during boss fight
    if (spawnTimer.current >= BOSS_SPAWN_INTERVAL) {
      spawnTimer.current = 0
      const edge = Math.random() < 0.5 ? -1 : 1
      const half = ARENA_SIZE / 2 - 1
      useEnemyStore.getState().spawnEnemy('slow', {
        x: edge * half,
        z: (Math.random() - 0.5) * ARENA_SIZE * 0.8,
      })
    }

    const currentAttack = ATTACK_SEQUENCE[attackIndex.current % ATTACK_SEQUENCE.length]
    const playerPos = usePlayerStore.getState().position

    if (phase.current === 'idle') {
      if (timer.current >= ATTACK_PAUSE) {
        phase.current = 'telegraph'
        timer.current = 0

        // Set up telegraph based on attack type
        if (currentAttack === 'heat_wave') {
          setTelegraphs([{
            id: 'hw',
            position: { x: boss.position.x, z: boss.position.z },
            radius: 6,
          }])
        } else if (currentAttack === 'salt_rain') {
          const zones: TelegraphZone[] = []
          for (let i = 0; i < 4; i++) {
            zones.push({
              id: `sr_${i}`,
              position: {
                x: playerPos.x + (Math.random() - 0.5) * 6,
                z: playerPos.z + (Math.random() - 0.5) * 6,
              },
              radius: 1.5,
            })
          }
          setTelegraphs(zones)
        } else if (currentAttack === 'deep_soak') {
          soakAngle.current = Math.atan2(
            playerPos.x - boss.position.x,
            playerPos.z - boss.position.z
          )
          setSoakBeam({ angle: soakAngle.current, active: false })
        }
      }
    }

    if (phase.current === 'telegraph') {
      if (timer.current >= TELEGRAPH_DURATION) {
        phase.current = 'attack'
        timer.current = 0

        // Execute attack
        if (currentAttack === 'heat_wave') {
          if (isInRange(boss.position, playerPos, 6)) {
            usePlayerStore.getState().takeDamage(25)
            // Push player back
            const dx = playerPos.x - boss.position.x
            const dz = playerPos.z - boss.position.z
            const dist = Math.sqrt(dx * dx + dz * dz) || 1
            usePlayerStore.getState().setPosition({
              x: Math.max(-9, Math.min(9, playerPos.x + (dx / dist) * 4)),
              z: Math.max(-9, Math.min(9, playerPos.z + (dz / dist) * 4)),
            })
          }
          setTelegraphs([])
        } else if (currentAttack === 'salt_rain') {
          for (const zone of telegraphs) {
            if (isInRange(zone.position, playerPos, zone.radius)) {
              usePlayerStore.getState().takeDamage(20)
            }
          }
          setTelegraphs([])
        } else if (currentAttack === 'deep_soak') {
          setSoakBeam({ angle: soakAngle.current, active: true })
        }

        if (usePlayerStore.getState().hp <= 0) {
          useGameStore.getState().triggerDeath()
        }
      }
    }

    if (phase.current === 'attack') {
      if (currentAttack === 'deep_soak') {
        // Rotating beam — 3 seconds
        soakAngle.current += dt * 0.8
        setSoakBeam({ angle: soakAngle.current, active: true })

        // Check if player is in beam path
        const beamX = boss.position.x + Math.sin(soakAngle.current) * 8
        const beamZ = boss.position.z + Math.cos(soakAngle.current) * 8
        const beamMid = {
          x: (boss.position.x + beamX) / 2,
          z: (boss.position.z + beamZ) / 2,
        }
        if (isInRange(beamMid, playerPos, 2)) {
          usePlayerStore.getState().setStatus('soaked')
          usePlayerStore.getState().takeDamage(5 * dt)
        }

        if (timer.current >= 3) {
          setSoakBeam({ angle: 0, active: false })
          phase.current = 'idle'
          timer.current = 0
          attackIndex.current++
        }
      } else {
        // Instant attacks — short recovery
        if (timer.current >= 0.5) {
          phase.current = 'idle'
          timer.current = 0
          attackIndex.current++
        }
      }
    }

    // Check if boss is dead
    if (boss.hp <= 0) {
      useEnemyStore.getState().removeEnemy(boss.id)
      useEnemyStore.getState().reset()
      useGameStore.getState().completeWave()
    }
  })

  if (!boss) return null

  return (
    <group>
      {/* Boss body */}
      <mesh position={[boss.position.x, 1.5, boss.position.z]} castShadow>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.3} />
      </mesh>

      {/* Telegraph warning circles */}
      {telegraphs.map((zone) => (
        <mesh
          key={zone.id}
          position={[zone.position.x, 0.02, zone.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[zone.radius * 0.8, zone.radius, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.3 + Math.sin(Date.now() * 0.01) * 0.2} />
        </mesh>
      ))}

      {/* Deep Soak beam */}
      {soakBeam.active && boss && (
        <mesh
          position={[
            boss.position.x + Math.sin(soakBeam.angle) * 4,
            0.3,
            boss.position.z + Math.cos(soakBeam.angle) * 4,
          ]}
          rotation={[0, soakBeam.angle, 0]}
        >
          <boxGeometry args={[0.6, 0.3, 8]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.6} emissive="#3b82f6" emissiveIntensity={1} />
        </mesh>
      )}
    </group>
  )
}
```

- [ ] **Step 2: Add Boss to Scene**

Update `src/components/Scene.tsx`:

```tsx
import { Canvas } from '@react-three/fiber'
import Arena from './Arena'
import Camera from './Camera'
import Player from './Player'
import EnemyManager from './EnemyManager'
import SpellManager from './Spell'
import Boss from './Boss'

export default function Scene() {
  return (
    <Canvas shadows>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <Camera />
      <Arena />
      <Player />
      <EnemyManager />
      <SpellManager />
      <Boss />
    </Canvas>
  )
}
```

- [ ] **Step 3: Update EnemyManager to spawn boss**

In `src/components/EnemyManager.tsx`, the wave-end logic already calls `useGameStore.getState().startBoss()` when wave >= 7. We need to spawn the boss enemy when the phase transitions to 'boss'. Add a `useFrame` check:

Add this before the existing `useFrame` in EnemyManager, or add to the existing one:

```tsx
  // Watch for boss phase to spawn the golem
  const prevPhase = useRef<string>('menu')

  useFrame(() => {
    const { phase } = useGameStore.getState()
    if (phase === 'boss' && prevPhase.current !== 'boss') {
      useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: -7 })
    }
    prevPhase.current = phase
  })
```

Add `import { useRef } from 'react'` if not already present.

- [ ] **Step 4: Verify boss fight works**

```bash
npm run dev
```

Expected: After clearing wave 7, boss phase starts. The Hungry Golem (large red sphere) appears at center-north. It cycles through telegraphed attacks: red warning circles appear for 2s before attacks land. Small slimes spawn during the fight. Defeating the boss triggers the reward screen.

- [ ] **Step 5: Commit**

```bash
git add src/components/Boss.tsx src/components/Scene.tsx src/components/EnemyManager.tsx
git commit -m "feat: add Hungry Golem boss with 3 telegraphed attack patterns"
```

---

## Task 15: Main Menu

**Files:**
- Create: `src/ui/MainMenu.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create MainMenu component**

Create `src/ui/MainMenu.tsx`:

```tsx
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'

export default function MainMenu() {
  const handleStart = () => {
    useDeckStore.getState().reset()
    usePlayerStore.getState().reset()
    useEnemyStore.getState().reset()
    useGameStore.getState().startShift()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', zIndex: 10,
    }}>
      <h1 style={{
        color: '#f59e0b', fontSize: '42px', fontFamily: 'serif',
        textShadow: '0 0 20px rgba(245,158,11,0.4)', marginBottom: '8px',
      }}>
        The Alchemist's Kitchen
      </h1>

      <p style={{ color: '#a8a29e', fontSize: '14px', marginBottom: '8px' }}>
        Hell's Kitchen: Alchemist Edition
      </p>

      <p style={{ color: '#78716c', fontSize: '12px', marginBottom: '32px', maxWidth: '400px', textAlign: 'center', lineHeight: 1.6 }}>
        Combine ingredients in your cauldron to cast powerful spells.
        Survive the shift. Defeat the Hungry Golem.
      </p>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', fontSize: '24px' }}>
        <span title="Chili (Fire)">🌶️</span>
        <span title="Bottle (Water)">🧴</span>
        <span title="Salt (Stone)">🧂</span>
      </div>

      <button
        onClick={handleStart}
        style={{
          padding: '14px 40px', fontSize: '18px', background: '#f59e0b',
          border: 'none', borderRadius: '8px', color: 'white',
          cursor: 'pointer', fontWeight: 'bold', letterSpacing: '2px',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#d97706')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#f59e0b')}
      >
        START SHIFT
      </button>

      <div style={{ marginTop: '40px', color: '#57534e', fontSize: '11px', textAlign: 'center' }}>
        <div>WASD to move · 1/2/3 to slot ingredients · Space to cook</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace inline menu in App.tsx**

Update `src/App.tsx` — replace the inline menu block with:

```tsx
import MainMenu from './ui/MainMenu'

// Replace the phase === 'menu' block:
{phase === 'menu' && <MainMenu />}
```

Remove the old inline menu JSX.

- [ ] **Step 3: Verify menu screen**

```bash
npm run dev
```

Expected: Game loads with themed title screen showing game name, ingredient icons, START SHIFT button, and control hints. Clicking START SHIFT begins the game.

- [ ] **Step 4: Commit**

```bash
git add src/ui/MainMenu.tsx src/App.tsx
git commit -m "feat: add themed main menu with controls guide"
```

---

## Task 16: Polish — Cook Cooldown, Perk Effects, Death Slow-Mo

**Files:**
- Modify: `src/stores/deckStore.ts`, `src/App.tsx`, `src/utils/castSpell.ts`, `src/components/Spell.tsx`

- [ ] **Step 1: Add cook cooldown logic**

Update `src/App.tsx` — track cooldown with a ref:

```tsx
import { useEffect, useRef } from 'react'

// Inside App component:
const cookCooldownRef = useRef(0)

useEffect(() => {
  const interval = setInterval(() => {
    if (cookCooldownRef.current > 0) {
      cookCooldownRef.current = Math.max(0, cookCooldownRef.current - 0.016)
    }
  }, 16)
  return () => clearInterval(interval)
}, [])
```

Update the cook logic in the keydown handler and pass cooldown to CauldronUI:

```tsx
if (e.key === ' ') {
  e.preventDefault()
  if (cookCooldownRef.current > 0) return

  const spell = useDeckStore.getState().cook()
  if (spell) {
    const perks = useDeckStore.getState().activePerks
    const fastPrepStacks = perks.find((p) => p.id === 'fast_prep')?.stackCount || 0
    const baseCooldown = Math.max(0.2, 1.5 - fastPrepStacks * 0.5)
    cookCooldownRef.current = baseCooldown

    useGameStore.getState().recordIngredientUsed()
    useGameStore.getState().recordIngredientUsed()
    useGameStore.getState().recordSpellCast(spell)
    castSpell(spell)
  }
}
```

- [ ] **Step 2: Apply perk modifiers to spells**

Update `src/utils/castSpell.ts` to apply perk effects:

```ts
import { SpellType, SpellEffect } from '../types'
import { SPELL_CONFIG } from '../data/recipes'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'
import { findNearestEnemy } from './collision'

let spellId = 0

export function castSpell(spellType: SpellType) {
  const playerPos = usePlayerStore.getState().position
  const config = SPELL_CONFIG[spellType]
  const perks = useDeckStore.getState().activePerks

  let damage = config.damage
  let radius = config.radius

  // Extra Spicy: Chili spells +20% damage per stack, smaller AOE
  const extraSpicy = perks.find((p) => p.id === 'extra_spicy')?.stackCount || 0
  if (extraSpicy > 0 && (spellType === 'INFERNO' || spellType === 'STEAM' || spellType === 'METEOR')) {
    damage *= 1 + 0.2 * extraSpicy
    radius *= Math.max(0.5, 1 - 0.1 * extraSpicy)
  }

  let targetPos = { ...playerPos }

  if (spellType === 'METEOR') {
    const nearest = findNearestEnemy(playerPos, useEnemyStore.getState().enemies)
    if (nearest) {
      targetPos = { ...nearest.position }
    }
  }

  const spell: SpellEffect = {
    id: `spell_${spellId++}`,
    type: spellType,
    position: targetPos,
    radius,
    damage: Math.round(damage),
    duration: config.duration,
    elapsed: 0,
  }

  ;(window as any).__castSpell?.(spell)

  // Double Batch: chance to trigger twice
  const doubleBatch = perks.find((p) => p.id === 'double_batch')?.stackCount || 0
  if (doubleBatch > 0) {
    const chance = 0.1 * doubleBatch
    if (Math.random() < chance) {
      const spellCopy: SpellEffect = {
        ...spell,
        id: `spell_${spellId++}`,
        elapsed: 0,
      }
      setTimeout(() => (window as any).__castSpell?.(spellCopy), 200)
    }
  }
}
```

- [ ] **Step 3: Apply Deep Freeze and Heavy Salt in Spell collision**

Update `src/components/Spell.tsx` — in the collision check section of `SpellVisual`, after checking knockback:

```tsx
// Inside the for loop in SpellVisual useFrame, after the hit check:

// Deep Freeze: Bottle spells stun
const perks = useDeckStore.getState().activePerks
const deepFreeze = perks.find((p) => p.id === 'deep_freeze')?.stackCount || 0
if (deepFreeze > 0 && (spell.type === 'TIDAL_WAVE' || spell.type === 'MUD')) {
  useEnemyStore.getState().setEnemyStatus(enemy.id, 'stunned')
  // Clear stun after 2s per stack
  setTimeout(() => {
    useEnemyStore.getState().setEnemyStatus(enemy.id, 'normal')
  }, 2000 * deepFreeze)
}

// Heavy Salt: Salt spells push 2x further per stack
const heavySalt = perks.find((p) => p.id === 'heavy_salt')?.stackCount || 0
if (heavySalt > 0 && (spell.type === 'FORTRESS' || spell.type === 'METEOR')) {
  const dx = enemy.position.x - spell.position.x
  const dz = enemy.position.z - spell.position.z
  const dist = Math.sqrt(dx * dx + dz * dz) || 1
  const pushForce = 3 * heavySalt
  useEnemyStore.getState().updateEnemyPosition(enemy.id, {
    x: enemy.position.x + (dx / dist) * pushForce,
    z: enemy.position.z + (dz / dist) * pushForce,
  })
}
```

Add the import at the top of Spell.tsx:
```tsx
import { useDeckStore } from '../stores/deckStore'
```

- [ ] **Step 4: Add death desaturation effect**

Update `src/components/Scene.tsx` to apply grayscale when in death phase:

```tsx
import { Canvas } from '@react-three/fiber'
import Arena from './Arena'
import Camera from './Camera'
import Player from './Player'
import EnemyManager from './EnemyManager'
import SpellManager from './Spell'
import Boss from './Boss'
import { useGameStore } from '../stores/gameStore'

export default function Scene() {
  const phase = useGameStore((s) => s.phase)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      filter: phase === 'death' ? 'grayscale(100%)' : 'none',
      transition: 'filter 1s ease-in',
    }}>
      <Canvas shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
        <Camera />
        <Arena />
        <Player />
        <EnemyManager />
        <SpellManager />
        <Boss />
      </Canvas>
    </div>
  )
}
```

This uses CSS `filter: grayscale(100%)` on the canvas wrapper — simplest approach for MVP, no post-processing library needed.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (stores, recipes, perks, collision).

- [ ] **Step 6: Verify full game loop manually**

```bash
npm run dev
```

Expected: Full game loop works — menu → combat with waves → reward with perks → perks affect spells → boss fight after wave 7 → death with slo-mo and receipt → restart or menu. Cook has 1.5s cooldown, reduced by Fast Prep perk.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add cook cooldown, perk effects, and polish game loop"
```

---

## Task 17: Final Verification & Cleanup

**Files:**
- Modify: various (cleanup only)

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 4: Manual end-to-end playthrough**

Test this full sequence:
1. Main menu → START SHIFT
2. Slot ingredients with 1/2/3 keys and clicks
3. Cook spells with Spacebar
4. Survive wave 1 → reward screen → pick perk
5. Verify perk appears in top-right
6. Pick same perk again in wave 2 → verify stack count shows ×2
7. Let enemies kill you → verify slo-mo → The Final Bill with correct stats
8. Click ONE MORE RUN → verify clean restart
9. Play through wave 7 → verify boss spawns with telegraph attacks
10. Defeat boss → verify reward/completion

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
