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
  { id: 'fireburst', name: 'V1: Fireburst', description: 'Particle burst only — quick punchy pop' },
  { id: 'shockwave', name: 'V2: Shockwave', description: 'Expanding ring + light flash — clean cinematic' },
  { id: 'hellfire', name: 'V3: Hellfire', description: 'Particles + ring + ground scorch' },
  { id: 'double_ring', name: 'V4: Double Ring', description: 'Layered shockwaves + embers + screen flash' },
  { id: 'supernova', name: 'V5: Supernova', description: 'Maximum impact — fireball core + chain scaling' },
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
