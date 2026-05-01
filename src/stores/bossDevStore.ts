import { create } from 'zustand'

// Defaults for the floating "BOSS" label rendered above the boss's head.
// offsets are relative to the boss's current position; the Boss component
// adds them on top of the standard `floorOffset + BOSS_HEIGHT` anchor.
export const DEFAULT_LABEL_OFFSET_X = 0
export const DEFAULT_LABEL_OFFSET_Y = 0
export const DEFAULT_LABEL_FONT_SIZE = 28

interface BossDevState {
  enabled: boolean
  labelOffsetX: number
  labelOffsetY: number
  labelFontSize: number
  setEnabled: (b: boolean) => void
  setLabelOffsetX: (n: number) => void
  setLabelOffsetY: (n: number) => void
  setLabelFontSize: (n: number) => void
  reset: () => void
}

export const useBossDevStore = create<BossDevState>((set) => ({
  enabled: false,
  labelOffsetX: DEFAULT_LABEL_OFFSET_X,
  labelOffsetY: DEFAULT_LABEL_OFFSET_Y,
  labelFontSize: DEFAULT_LABEL_FONT_SIZE,
  setEnabled: (b) => set({ enabled: b }),
  setLabelOffsetX: (n) => set({ labelOffsetX: n }),
  setLabelOffsetY: (n) => set({ labelOffsetY: n }),
  setLabelFontSize: (n) => set({ labelFontSize: n }),
  reset: () => set({
    labelOffsetX: DEFAULT_LABEL_OFFSET_X,
    labelOffsetY: DEFAULT_LABEL_OFFSET_Y,
    labelFontSize: DEFAULT_LABEL_FONT_SIZE,
  }),
}))
