import { create } from 'zustand'
import { Enemy, EnemyType, Position, StatusEffect } from '../types'

const BASE_HP = 30
const HP_MULTIPLIER: Record<EnemyType, number> = { slow: 1, fast: 1, tanky: 3, boss: 15 }
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
    set((s) => ({ enemies: [...s.enemies, { id: `enemy_${nextId++}`, position, hp, maxHp: hp, type, status: 'normal' }] }))
  },
  damageEnemy: (id, amount) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, hp: Math.max(0, e.hp - amount) } : e) })),
  removeEnemy: (id) => set((s) => ({ enemies: s.enemies.filter((e) => e.id !== id) })),
  updateEnemyPosition: (id, position) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, position } : e) })),
  setEnemyStatus: (id, status) => set((s) => ({ enemies: s.enemies.map((e) => e.id === id ? { ...e, status } : e) })),
  reset: () => set({ enemies: [] }),
}))
