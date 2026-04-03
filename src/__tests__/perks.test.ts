import { describe, it, expect } from 'vitest'
import { PERK_POOL, getRandomPerks } from '../data/perks'

describe('PERK_POOL', () => {
  it('contains 5 perks', () => { expect(PERK_POOL).toHaveLength(5) })
  it('each perk has required fields', () => {
    for (const perk of PERK_POOL) {
      expect(perk).toHaveProperty('id')
      expect(perk).toHaveProperty('name')
      expect(perk).toHaveProperty('icon')
      expect(perk).toHaveProperty('description')
    }
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
