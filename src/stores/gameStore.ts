import { create } from 'zustand'
import type { GamePhase, GameStats, SpellType } from '../types'

interface GameState {
  phase: GamePhase; currentWave: number; timeScale: number; stats: GameStats
  startShift: () => void; completeWave: () => void; nextWave: () => void
  skipReward: () => void
  startBoss: () => void; triggerVictory: () => void; triggerDeath: () => void
  recordEnemyDefeated: () => void; recordIngredientUsed: () => void
  recordSpellCast: (spell: SpellType) => void; reset: () => void
}

const initialStats: GameStats = { enemiesDefeated: 0, ingredientsUsed: 0, wavesCleared: 0, spellsCast: {} as Record<SpellType, number> }

export const useGameStore = create<GameState>((set) => ({
  phase: 'menu', currentWave: 0, timeScale: 1,
  stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> },
  startShift: () => set({ phase: 'combat', currentWave: 1, timeScale: 1, stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> } }),
  completeWave: () => set((s) => ({ phase: 'reward', stats: { ...s.stats, wavesCleared: s.stats.wavesCleared + 1 } })),
  nextWave: () => set((s) => ({ phase: 'combat', currentWave: s.currentWave + 1 })),
  skipReward: () => set((s) => ({ phase: 'combat', currentWave: s.currentWave + 1 })),
  startBoss: () => set({ phase: 'boss' }),
  triggerVictory: () => set((s) => ({ phase: 'victory', stats: { ...s.stats, wavesCleared: s.stats.wavesCleared + 1 } })),
  triggerDeath: () => set({ phase: 'death', timeScale: 0.2 }),
  recordEnemyDefeated: () => set((s) => ({ stats: { ...s.stats, enemiesDefeated: s.stats.enemiesDefeated + 1 } })),
  recordIngredientUsed: () => set((s) => ({ stats: { ...s.stats, ingredientsUsed: s.stats.ingredientsUsed + 1 } })),
  recordSpellCast: (spell) => set((s) => ({ stats: { ...s.stats, spellsCast: { ...s.stats.spellsCast, [spell]: (s.stats.spellsCast[spell] || 0) + 1 } } })),
  reset: () => set({ phase: 'menu', currentWave: 0, timeScale: 1, stats: { ...initialStats, spellsCast: {} as Record<SpellType, number> } }),
}))
