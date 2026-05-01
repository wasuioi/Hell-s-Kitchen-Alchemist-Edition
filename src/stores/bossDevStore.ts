import { create } from 'zustand'

// Default boss visual height (units). When the dev panel is closed, the
// store value sits at this default and the Boss component renders normally.
export const DEFAULT_BOSS_HEIGHT = 6

interface BossDevState {
  enabled: boolean
  posX: number
  posZ: number
  size: number
  setEnabled: (b: boolean) => void
  setPosX: (n: number) => void
  setPosZ: (n: number) => void
  setSize: (n: number) => void
  reset: () => void
}

export const useBossDevStore = create<BossDevState>((set) => ({
  enabled: false,
  posX: 0,
  posZ: 0,
  size: DEFAULT_BOSS_HEIGHT,
  setEnabled: (b) => set({ enabled: b }),
  setPosX: (n) => set({ posX: n }),
  setPosZ: (n) => set({ posZ: n }),
  setSize: (n) => set({ size: n }),
  reset: () => set({ posX: 0, posZ: 0, size: DEFAULT_BOSS_HEIGHT }),
}))
