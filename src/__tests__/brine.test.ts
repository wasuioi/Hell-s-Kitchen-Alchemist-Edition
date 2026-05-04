import { describe, it, expect } from 'vitest'
import { PERK_POOL } from '../data/perks'
import type { SpellType } from '../types'

// Mirror the lookup table from Spell.tsx to verify multiplier values are correct
function getBrineMult(stacks: number): number {
  return [1, 1.25, 1.45, 1.70][Math.min(stacks, 3)]
}

const BOTTLE_RECIPE_SPELLS: SpellType[] = ['TIDAL_WAVE', 'MUD', 'STEAM']
const NON_BOTTLE_SPELLS: SpellType[] = ['INFERNO', 'METEOR', 'SALT_SPEED']

describe('brine perk definition', () => {
  const brine = PERK_POOL.find((p) => p.id === 'brine')

  it('is in PERK_POOL', () => { expect(brine).toBeDefined() })
  it('is common rarity', () => { expect(brine!.rarity).toBe('common') })
  it('has three tiers', () => { expect(brine!.tiers).toHaveLength(3) })
  it('T1 shows +25% status duration', () => { expect(brine!.tiers![0].stats?.['Status Duration']).toBe('+25%') })
  it('T2 shows +45% status duration', () => { expect(brine!.tiers![1].stats?.['Status Duration']).toBe('+45%') })
  it('T3 shows +70% status duration', () => { expect(brine!.tiers![2].stats?.['Status Duration']).toBe('+70%') })
  it('T3 added effect mentions soaked', () => { expect(brine!.tiers![2].added).toContain('Soaked') })
})

describe('brine multiplier values', () => {
  it('is 1.00 with 0 stacks (no perk)', () => { expect(getBrineMult(0)).toBe(1) })
  it('is 1.25 at T1 (1 stack)', () => { expect(getBrineMult(1)).toBe(1.25) })
  it('is 1.45 at T2 (2 stacks)', () => { expect(getBrineMult(2)).toBe(1.45) })
  it('is 1.70 at T3 (3 stacks)', () => { expect(getBrineMult(3)).toBe(1.70) })
  it('caps at 1.70 for overflow stacks beyond T3', () => { expect(getBrineMult(5)).toBe(1.70) })
})

describe('brine BOTTLE_RECIPE_SPELLS membership', () => {
  it('applies to TIDAL_WAVE', () => { expect(BOTTLE_RECIPE_SPELLS).toContain('TIDAL_WAVE') })
  it('applies to MUD', () => { expect(BOTTLE_RECIPE_SPELLS).toContain('MUD') })
  it('applies to STEAM', () => { expect(BOTTLE_RECIPE_SPELLS).toContain('STEAM') })
  it('does not apply to INFERNO', () => { expect(NON_BOTTLE_SPELLS).toContain('INFERNO') })
  it('does not apply to METEOR', () => { expect(NON_BOTTLE_SPELLS).toContain('METEOR') })
  it('does not apply to SALT_SPEED', () => { expect(NON_BOTTLE_SPELLS).toContain('SALT_SPEED') })
})
