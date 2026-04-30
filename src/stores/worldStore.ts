import { create } from 'zustand'
import type { EmberPatch } from '../types'

const PATCH_CONFIG = [
  { radius: 2.5, lifetime: 3.0, maxPatches: 4 },
  { radius: 3.5, lifetime: 4.0, maxPatches: 5 },
  { radius: 4.0, lifetime: 5.0, maxPatches: 6 },
]

let nextPatchId = 0

interface WorldState {
  patches: EmberPatch[]
  spawnEmberPatch: (x: number, z: number, tier: number) => void
  tickPatches: (dt: number) => EmberPatch[]
  findPatchContaining: (x: number, z: number) => EmberPatch | null
  refreshAndGrow: (id: string, growBy: number, radiusCap: number) => void
  reset: () => void
}

export const useWorldStore = create<WorldState>((set, get) => ({
  patches: [],

  spawnEmberPatch: (x, z, tier) => {
    const t = Math.max(1, Math.min(3, tier))
    const cfg = PATCH_CONFIG[t - 1]
    const newPatch: EmberPatch = {
      id: `patch_${nextPatchId++}`,
      x, z,
      radius: cfg.radius,
      lifetimeRemaining: cfg.lifetime,
      totalLifetime: cfg.lifetime,
      tier: t,
    }
    set((s) => {
      const next = [...s.patches, newPatch]
      // FIFO cap: drop oldest when over max
      return { patches: next.length > cfg.maxPatches ? next.slice(next.length - cfg.maxPatches) : next }
    })
  },

  tickPatches: (dt) => {
    const patches = get().patches
    if (patches.length === 0) return patches
    const alive = patches
      .map((p) => ({ ...p, lifetimeRemaining: p.lifetimeRemaining - dt }))
      .filter((p) => p.lifetimeRemaining > 0)
    set({ patches: alive })
    return alive
  },

  findPatchContaining: (x, z) => {
    return get().patches.find((p) => {
      const dx = x - p.x
      const dz = z - p.z
      return dx * dx + dz * dz <= p.radius * p.radius
    }) ?? null
  },

  refreshAndGrow: (id, growBy, radiusCap) => {
    set((s) => ({
      patches: s.patches.map((p) =>
        p.id === id
          ? { ...p, lifetimeRemaining: p.totalLifetime, radius: Math.min(radiusCap, p.radius + growBy) }
          : p
      ),
    }))
  },

  reset: () => set({ patches: [] }),
}))
