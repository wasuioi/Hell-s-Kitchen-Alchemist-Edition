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
