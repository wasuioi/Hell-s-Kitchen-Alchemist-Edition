import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { drawPerksWithRarity } from '../data/perks'

describe('Reroll behavior', () => {
  it('drawPerksWithRarity called twice can produce different results', () => {
    // With 5 perks and 3 drawn, there is some chance they differ.
    // Run many times to confirm the function is not deterministic.
    let sawDifference = false
    for (let i = 0; i < 50 && !sawDifference; i++) {
      const first = drawPerksWithRarity(3).map(p => p.id).join(',')
      const second = drawPerksWithRarity(3).map(p => p.id).join(',')
      if (first !== second) sawDifference = true
    }
    expect(sawDifference).toBe(true)
  })

  it('reroll produces 3 perks with no duplicates', () => {
    const rerolled = drawPerksWithRarity(3)
    expect(rerolled).toHaveLength(3)
    expect(new Set(rerolled.map(p => p.id)).size).toBe(3)
  })
})

describe('Skip reward behavior', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
    useDeckStore.getState().reset()
  })

  it('skipReward moves to combat phase', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    expect(useGameStore.getState().phase).toBe('rest')
    useGameStore.getState().skipReward()
    expect(useGameStore.getState().phase).toBe('combat')
  })

  it('skipReward does not add any perk to activePerks', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    useGameStore.getState().skipReward()
    expect(useDeckStore.getState().activePerks).toHaveLength(0)
  })

  it('skipReward advances wave by 1', () => {
    useGameStore.getState().startShift()
    const waveBefore = useGameStore.getState().currentWave
    useGameStore.getState().completeWave()
    useGameStore.getState().skipReward()
    expect(useGameStore.getState().currentWave).toBe(waveBefore + 1)
  })
})
