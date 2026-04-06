import { create } from 'zustand'
import type { GamePhase, GameStats, SpellType } from '../types'

interface GameState {
  phase: GamePhase; currentWave: number; timeScale: number; stats: GameStats
  // Juice state
  shakeIntensity: number; shakeEndTime: number
  freezeUntil: number
  screenFlashUntil: number
  // Actions
  startShift: () => void; completeWave: () => void; nextWave: () => void
  startBoss: () => void; triggerVictory: () => void; triggerDeath: () => void
  recordEnemyDefeated: () => void; recordIngredientUsed: () => void
  recordSpellCast: (spell: SpellType) => void; reset: () => void
  // Juice actions
  triggerScreenShake: (intensity: number, durationMs: number) => void
  triggerHitFreeze: (durationMs: number) => void
  triggerScreenFlash: () => void
  checkHitFreezeExpiry: () => void
}

const initialStats: GameStats = { enemiesDefeated: 0, ingredientsUsed: 0, wavesCleared: 0, spellsCast: {} as Record<SpellType, number> }

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu', currentWave: 0, timeScale: 1,
  stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
  // Juice defaults
  shakeIntensity: 0, shakeEndTime: 0,
  freezeUntil: 0,
  screenFlashUntil: 0,
  // Game flow
  startShift: () => set({ phase: 'combat', currentWave: 1, timeScale: 1, stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> } }),
  completeWave: () => set((s) => ({ phase: 'reward', stats: { ...s.stats, wavesCleared: s.stats.wavesCleared + 1 } })),
  nextWave: () => set((s) => ({ phase: 'combat', currentWave: s.currentWave + 1 })),
  startBoss: () => set({ phase: 'boss' }),
  triggerVictory: () => set((s) => ({ phase: 'victory', stats: { ...s.stats, wavesCleared: s.stats.wavesCleared + 1 } })),
  triggerDeath: () => set({ phase: 'death', timeScale: 0.2 }),
  recordEnemyDefeated: () => set((s) => ({ stats: { ...s.stats, enemiesDefeated: s.stats.enemiesDefeated + 1 } })),
  recordIngredientUsed: () => set((s) => ({ stats: { ...s.stats, ingredientsUsed: s.stats.ingredientsUsed + 1 } })),
  recordSpellCast: (spell) => set((s) => ({ stats: { ...s.stats, spellsCast: { ...s.stats.spellsCast, [spell]: (s.stats.spellsCast[spell] || 0) + 1 } } })),
  reset: () => set({
    phase: 'menu', currentWave: 0, timeScale: 1,
    stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
    shakeIntensity: 0, shakeEndTime: 0, freezeUntil: 0, screenFlashUntil: 0,
  }),
  // Juice actions
  triggerScreenShake: (intensity, durationMs) => {
    const now = performance.now()
    const current = get()
    // Only override if new shake is equal or stronger
    if (intensity >= current.shakeIntensity || now >= current.shakeEndTime) {
      set({ shakeIntensity: intensity, shakeEndTime: now + durationMs })
    }
  },
  triggerHitFreeze: (durationMs) => {
    // CRITICAL: use performance.now() for real-world time, NOT scaled game time
    set({ timeScale: 0.05, freezeUntil: performance.now() + durationMs })
  },
  triggerScreenFlash: () => {
    set({ screenFlashUntil: performance.now() + 80 })
  },
  checkHitFreezeExpiry: () => {
    const { freezeUntil, timeScale, phase } = get()
    if (freezeUntil > 0 && performance.now() >= freezeUntil && timeScale === 0.05 && phase !== 'death') {
      set({ timeScale: 1, freezeUntil: 0 })
    }
  },
}))
