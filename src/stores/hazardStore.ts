import { create } from 'zustand'
import type { Hazard, HazardType, Position } from '../types'

let nextId = 0

interface HazardState {
  hazards: Hazard[]
  spawnHazard: (type: HazardType, position: Position) => void
  removeHazard: (id: string) => void
  setLastDamageAt: (id: string, time: number) => void
  reset: () => void
}

export const useHazardStore = create<HazardState>((set) => ({
  hazards: [],
  spawnHazard: (type, position) => set((s) => ({
    hazards: [...s.hazards, {
      id: `hazard_${nextId++}`,
      type,
      position,
      spawnedAt: performance.now(),
      lastDamageAt: 0,
    }],
  })),
  removeHazard: (id) => set((s) => ({ hazards: s.hazards.filter((h) => h.id !== id) })),
  setLastDamageAt: (id, time) => set((s) => ({
    hazards: s.hazards.map((h) => h.id === id ? { ...h, lastDamageAt: time } : h),
  })),
  reset: () => set({ hazards: [] }),
}))
