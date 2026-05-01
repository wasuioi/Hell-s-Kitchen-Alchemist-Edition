import { describe, it, expect } from 'vitest'
import { PERK_POOL, getRandomPerks, drawPerksWithRarity } from '../data/perks'

describe('PERK_POOL', () => {
  it('contains 7 perks', () => { expect(PERK_POOL).toHaveLength(7) })
  it('each perk has required fields', () => {
    for (const perk of PERK_POOL) {
      expect(perk).toHaveProperty('id')
      expect(perk).toHaveProperty('name')
      expect(perk).toHaveProperty('icon')
      expect(perk).toHaveProperty('description')
      expect(perk).toHaveProperty('rarity')
    }
  })
  it('each perk has a valid rarity', () => {
    const validRarities = ['common', 'rare', 'epic', 'legendary']
    for (const perk of PERK_POOL) { expect(validRarities).toContain(perk.rarity) }
  })
})

describe('getRandomPerks', () => {
  it('returns 3 perks', () => { expect(getRandomPerks(3)).toHaveLength(3) })
  it('returns no duplicates', () => {
    const perks = getRandomPerks(3)
    expect(new Set(perks.map(p => p.id)).size).toBe(3)
  })
  it('returns all 5 if asked for 5', () => { expect(getRandomPerks(5)).toHaveLength(5) })
})

describe('drawPerksWithRarity', () => {
  it('returns the requested count', () => { expect(drawPerksWithRarity(3)).toHaveLength(3) })
  it('returns no duplicate perks', () => {
    const perks = drawPerksWithRarity(3)
    expect(new Set(perks.map(p => p.id)).size).toBe(3)
  })
  it('returns all 5 if asked for 5', () => { expect(drawPerksWithRarity(5)).toHaveLength(5) })
  it('does not crash when count exceeds pool size', () => {
    const perks = drawPerksWithRarity(10)
    expect(perks.length).toBeLessThanOrEqual(PERK_POOL.length)
  })
  it('returns perks from PERK_POOL', () => {
    const poolIds = new Set(PERK_POOL.map(p => p.id))
    for (const perk of drawPerksWithRarity(3)) { expect(poolIds.has(perk.id)).toBe(true) }
  })
})
