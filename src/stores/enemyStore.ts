import { create } from 'zustand'
import type { Enemy, EnemyType, Knockback, Position, StatusEffect } from '../types'
import { isInRange } from '../utils/collision'

const BASE_HP = 30
const HP_MULTIPLIER: Record<EnemyType, number> = { slow: 1, fast: 1, tanky: 3, boss: 15, exploder: 1 }
let nextId = 0

interface EnemyState {
  enemies: Enemy[]
  spawnEnemy: (type: EnemyType, position: Position) => void
  damageEnemy: (id: string, amount: number) => void
  damageEnemiesInRadius: (center: Position, radius: number, amount: number) => void
  applyStatusInRadius: (center: Position, radius: number, status: StatusEffect, duration: number) => void
  removeEnemy: (id: string) => void
  updateEnemyPosition: (id: string, position: Position) => void
  setEnemyStatus: (id: string, status: StatusEffect) => void
  setEnemyKnockback: (id: string, knockback: Knockback | null) => void
  setEnemyHitFlash: (id: string, until: number) => void
  setEnemyDying: (id: string) => void
  setEnemyDetonating: (id: string) => void
  reset: () => void
}

export const useEnemyStore = create<EnemyState>((set, get) => ({
  enemies: [],
  spawnEnemy: (type, position) => {
    const hp = BASE_HP * HP_MULTIPLIER[type]
    set((s) => ({
      enemies: [...s.enemies, {
        id: `enemy_${nextId++}`, position, hp, maxHp: hp, type, status: 'normal',
        knockback: null, hitFlashUntil: 0, dying: false, detonating: false,
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
    set((s) => ({ enemies: s.enemies.map((e) => affectedIds.includes(e.id) ? { ...e, status } : e) }))
    for (const id of affectedIds) {
      setTimeout(() => { useEnemyStore.getState().setEnemyStatus(id, 'normal') }, duration * 1000)
    }
  },
  removeEnemy: (id) => set((s) => ({ enemies: s.enemies.filter((e) => e.id !== id) })),
  updateEnemyPosition: (id, position) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, position } : e) })),
  setEnemyStatus: (id, status) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, status } : e) })),
  setEnemyKnockback: (id, knockback) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, knockback } : e) })),
  setEnemyHitFlash: (id, until) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, hitFlashUntil: until } : e) })),
  setEnemyDying: (id) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, dying: true } : e) })),
  setEnemyDetonating: (id) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, detonating: true } : e) })),
  reset: () => set({ enemies: [] }),
}))
