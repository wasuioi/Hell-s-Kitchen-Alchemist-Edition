import { describe, it, expect } from 'vitest'
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
