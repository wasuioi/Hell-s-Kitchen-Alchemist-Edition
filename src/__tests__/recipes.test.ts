import { describe, it, expect } from 'vitest'
import { getRecipe } from '../data/recipes'

describe('getRecipe', () => {
  it('returns INFERNO for CHILI + CHILI', () => { expect(getRecipe('CHILI', 'CHILI')).toBe('INFERNO') })
  it('returns TIDAL_WAVE for BOTTLE + BOTTLE', () => { expect(getRecipe('BOTTLE', 'BOTTLE')).toBe('TIDAL_WAVE') })
  it('returns FORTRESS for SALT + SALT', () => { expect(getRecipe('SALT', 'SALT')).toBe('FORTRESS') })
  it('returns STEAM for CHILI + BOTTLE', () => { expect(getRecipe('CHILI', 'BOTTLE')).toBe('STEAM') })
  it('returns STEAM for BOTTLE + CHILI (order independent)', () => { expect(getRecipe('BOTTLE', 'CHILI')).toBe('STEAM') })
  it('returns METEOR for CHILI + SALT', () => { expect(getRecipe('CHILI', 'SALT')).toBe('METEOR') })
  it('returns METEOR for SALT + CHILI (order independent)', () => { expect(getRecipe('SALT', 'CHILI')).toBe('METEOR') })
  it('returns MUD for BOTTLE + SALT', () => { expect(getRecipe('BOTTLE', 'SALT')).toBe('MUD') })
  it('returns MUD for SALT + BOTTLE (order independent)', () => { expect(getRecipe('SALT', 'BOTTLE')).toBe('MUD') })
})
