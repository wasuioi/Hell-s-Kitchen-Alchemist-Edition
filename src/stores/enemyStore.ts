import { create } from 'zustand'
import type { AiState, Enemy, EnemyType, Knockback, Position, StatusEffect } from '../types'
import { isInRange } from '../utils/collision'
import { useDeckStore } from './deckStore'
import { useStockCubeStore } from './stockCubeStore'

// Bonemeal Stock perk (#28) — when an enemy dies, roll a chance to drop a
// world pickup that heals the player. Only active when the perk is owned;
// boss is excluded so the boss bar isn't farmed for healing trickle.
const BONEMEAL_DROP_CHANCE = 0.5
const BONEMEAL_CUBE_LIFETIME_MS = 8000

function tryDropBonemealCube(enemy: Enemy) {
  if (enemy.type === 'boss') return
  const owns = useDeckStore.getState().activePerks.some((p) => p.id === 'bonemeal_stock')
  if (!owns) return
  if (Math.random() >= BONEMEAL_DROP_CHANCE) return
  useStockCubeStore.getState().spawnCube(enemy.position, BONEMEAL_CUBE_LIFETIME_MS)
}

const BASE_HP = 30
const HP_MULTIPLIER: Record<EnemyType, number> = { slow: 1, fast: 1, tanky: 3, boss: 15, exploder: 1 }
let nextId = 0

interface EnemyState {
  enemies: Enemy[]
  spawnEnemy: (type: EnemyType, position: Position) => void
  damageEnemy: (id: string, amount: number) => void
  damageEnemiesInRadius: (center: Position, radius: number, amount: number) => void
  applyStatusInRadius: (center: Position, radius: number, status: StatusEffect | 'burning', duration: number) => void
  removeEnemy: (id: string) => void
  updateEnemyPosition: (id: string, position: Position) => void
  setEnemySoaked: (id: string, until: number) => void
  setEnemyFrozen: (id: string, until: number) => void
  setEnemyBurning: (id: string, until: number) => void
  setEnemyPoisoned: (id: string, until: number) => void
  setEnemySlowed: (id: string, until: number) => void
  setEnemyStunned: (id: string, until: number) => void
  clearEnemySoaked: (id: string) => void
  clearEnemyFrozen: (id: string) => void
  clearEnemyStunned: (id: string) => void
  setEnemyKnockback: (id: string, knockback: Knockback | null) => void
  setEnemyHitFlash: (id: string, until: number) => void
  setEnemyResistAura: (id: string, until: number) => void
  setEnemyDying: (id: string) => void
  setEnemyDetonating: (id: string) => void
  setEnemyAi: (id: string, ai: AiState) => void
  reset: () => void
}

export const useEnemyStore = create<EnemyState>((set, get) => ({
  enemies: [],
  spawnEnemy: (type, position) => {
    const hp = BASE_HP * HP_MULTIPLIER[type]
    const ai: AiState = type === 'tanky' ? { kind: 'tanky_idle' } : { kind: 'chase' }
    set((s) => ({
      enemies: [...s.enemies, {
        id: `enemy_${nextId++}`, position, hp, maxHp: hp, type,
        soakedUntil: 0, frozenUntil: 0, burningUntil: 0, poisonedUntil: 0, slowedUntil: 0, stunnedUntil: 0,
        knockback: null, hitFlashUntil: 0, resistAuraUntil: 0, dying: false, detonating: false, detonationStartTime: 0, ai,
      }],
    }))
  },
  damageEnemy: (id, amount) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, hp: Math.max(0, e.hp - amount) } : e) })),
  damageEnemiesInRadius: (center, radius, amount) => set((s) => ({
    enemies: s.enemies.map((e) => isInRange(center, e.position, radius) ? { ...e, hp: Math.max(0, e.hp - amount) } : e),
  })),
  applyStatusInRadius: (center, radius, status, duration) => {
    const affectedIds = get().enemies.filter((e) => isInRange(center, e.position, radius)).map((e) => e.id)
    if (affectedIds.length === 0) return
    // Map status name to its expiry-timestamp field.
    const field: keyof Enemy | null =
      status === 'soaked' ? 'soakedUntil' :
      status === 'stunned' ? 'stunnedUntil' :
      status === 'burning' ? 'burningUntil' :
      null
    if (!field) return
    const until = performance.now() + duration * 1000
    set((s) => ({
      enemies: s.enemies.map((e) => affectedIds.includes(e.id) ? { ...e, [field]: until } : e),
    }))
  },
  removeEnemy: (id) => set((s) => ({ enemies: s.enemies.filter((e) => e.id !== id) })),
  updateEnemyPosition: (id, position) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, position } : e) })),
  setEnemySoaked: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, soakedUntil: until } : e) })),
  setEnemyFrozen: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, frozenUntil: until } : e) })),
  setEnemyBurning: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, burningUntil: until } : e) })),
  setEnemyPoisoned: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, poisonedUntil: until } : e) })),
  setEnemySlowed: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, slowedUntil: until } : e) })),
  setEnemyStunned: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, stunnedUntil: until } : e) })),
  clearEnemySoaked: (id) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, soakedUntil: 0 } : e) })),
  clearEnemyFrozen: (id) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, frozenUntil: 0 } : e) })),
  clearEnemyStunned: (id) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, stunnedUntil: 0 } : e) })),
  setEnemyKnockback: (id, knockback) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, knockback } : e) })),
  setEnemyHitFlash: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, hitFlashUntil: until } : e) })),
  setEnemyResistAura: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, resistAuraUntil: until } : e) })),
  setEnemyDying: (id) => {
    const enemy = get().enemies.find((e) => e.id === id)
    // Only roll the drop on the first transition to dying (callers sometimes
    // re-trigger this on already-dying chains).
    if (enemy && !enemy.dying) tryDropBonemealCube(enemy)
    set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, dying: true } : e) }))
  },
  setEnemyDetonating: (id) => {
    const startTime = performance.now()
    set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, detonating: true, detonationStartTime: startTime } : e) }))
  },
  setEnemyAi: (id, ai) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, ai } : e) })),
  reset: () => set({ enemies: [] }),
}))
