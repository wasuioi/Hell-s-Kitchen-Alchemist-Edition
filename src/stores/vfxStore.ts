import { create } from 'zustand'

export interface VfxVariant {
  id: string
  name: string
  description: string
}

interface VfxState {
  activeExplosionId: string
  variants: VfxVariant[]
  setActiveExplosion: (id: string) => void
  removeVariant: (id: string) => void
  addVariant: (variant: VfxVariant) => void
}

const DEFAULT_VARIANTS: VfxVariant[] = [
  { id: 'fireburst', name: 'V1: Fireburst', description: '200 sparks with gravity + fire flicker' },
  { id: 'shockwave', name: 'V2: Shockwave', description: 'Clean blast disc + white ring edge + screen flash' },
  { id: 'hellfire', name: 'V3: Hellfire', description: 'Fire carpet spreading on ground + rising smoke' },
  { id: 'double_ring', name: 'V4: Pillar', description: 'Fire column shooting upward + falling embers' },
  { id: 'supernova', name: 'V5: Supernova', description: 'Fireball core + double rings + sparks + chain scaling' },
]

export const useVfxStore = create<VfxState>((set) => ({
  activeExplosionId: 'fireburst',
  variants: [...DEFAULT_VARIANTS],
  setActiveExplosion: (id) => set({ activeExplosionId: id }),
  removeVariant: (id) => set((s) => {
    const filtered = s.variants.filter((v) => v.id !== id)
    // If we removed the active one, switch to first remaining
    const newActive = s.activeExplosionId === id ? (filtered[0]?.id ?? 'fireburst') : s.activeExplosionId
    return { variants: filtered, activeExplosionId: newActive }
  }),
  addVariant: (variant) => set((s) => ({ variants: [...s.variants, variant] })),
}))
