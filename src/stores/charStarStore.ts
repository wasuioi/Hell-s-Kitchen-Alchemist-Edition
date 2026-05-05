import { create } from 'zustand'
import type { CharStar, Position } from '../types'

let nextId = 0

interface CharStarState {
  charStars: CharStar[]
  addCharStar: (star: { position: Position; spawnedAt: number; lifetimeMs: number; source: 'chili' | 'chain' }) => void
  removeCharStar: (id: string) => void
  reset: () => void
}

export const useCharStarStore = create<CharStarState>((set) => ({
  charStars: [],
  addCharStar: (star) => set((s) => ({
    charStars: [...s.charStars, { ...star, id: `charstar_${nextId++}` }],
  })),
  removeCharStar: (id) => set((s) => ({ charStars: s.charStars.filter((c) => c.id !== id) })),
  reset: () => set({ charStars: [] }),
}))
