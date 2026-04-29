import { create } from 'zustand'
import type { CaramelPool } from '../types'

const MAX_POOLS = 8
let nextId = 0

interface WorldState {
  pools: CaramelPool[]
  spawnCaramelPool: (cfg: Omit<CaramelPool, 'id' | 'spawnedAt'>) => void
  removeCaramelPool: (id: string) => void
  growCaramelPool: (id: string, radiusDelta: number, newLifetimeS: number) => void
  reset: () => void
}

export const useWorldStore = create<WorldState>((set) => ({
  pools: [],
  spawnCaramelPool: (cfg) => set((s) => {
    const newPool: CaramelPool = {
      id: `pool_${nextId++}`,
      spawnedAt: performance.now() / 1000,
      ...cfg,
    }
    let pools = [...s.pools, newPool]
    if (pools.length > MAX_POOLS) {
      pools.sort((a, b) => a.spawnedAt - b.spawnedAt)
      pools = pools.slice(pools.length - MAX_POOLS)
    }
    return { pools }
  }),
  removeCaramelPool: (id) => set((s) => ({
    pools: s.pools.filter((p) => p.id !== id),
  })),
  growCaramelPool: (id, radiusDelta, newLifetimeS) => set((s) => ({
    pools: s.pools.map((p) =>
      p.id === id
        ? { ...p, radius: Math.min(5.0, p.radius + radiusDelta), spawnedAt: performance.now() / 1000, lifetimeS: newLifetimeS }
        : p
    ),
  })),
  reset: () => set({ pools: [] }),
}))
