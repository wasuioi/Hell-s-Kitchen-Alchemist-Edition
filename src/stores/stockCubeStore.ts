import { create } from 'zustand'
import type { Position, StockCube } from '../types'

let nextId = 0

interface StockCubeState {
  cubes: StockCube[]
  spawnCube: (position: Position, lifetimeMs: number) => void
  removeCube: (id: string) => void
  reset: () => void
}

export const useStockCubeStore = create<StockCubeState>((set) => ({
  cubes: [],
  spawnCube: (position, lifetimeMs) => set((s) => ({
    cubes: [...s.cubes, {
      id: `stock_cube_${nextId++}`,
      position,
      spawnedAt: performance.now(),
      lifetimeMs,
    }],
  })),
  removeCube: (id) => set((s) => ({ cubes: s.cubes.filter((c) => c.id !== id) })),
  reset: () => set({ cubes: [] }),
}))
