import { describe, it, expect } from 'vitest'
import { TIER_MODIFIERS } from '../data/waves'

describe('TIER_MODIFIERS', () => {
  it('mild is identity (no modifier)', () => {
    const m = TIER_MODIFIERS.mild
    expect(m.speedMultiplier).toBe(1)
    expect(m.extraEliteCount).toBe(0)
    expect(m.hazardIntervalMultiplier).toBe(1)
    expect(m.perkPoolSize).toBe(3)
    expect(m.perkPickCount).toBe(1)
  })

  it('spicy applies 25% speed boost, +1 elite, +4 perk pool, 1 pick', () => {
    const m = TIER_MODIFIERS.spicy
    expect(m.speedMultiplier).toBe(1.25)
    expect(m.extraEliteCount).toBe(1)
    expect(m.hazardIntervalMultiplier).toBe(0.75)
    expect(m.perkPoolSize).toBe(4)
    expect(m.perkPickCount).toBe(1)
  })

  it('hellfire applies 50% speed boost, +2 elite, double pick from 4', () => {
    const m = TIER_MODIFIERS.hellfire
    expect(m.speedMultiplier).toBe(1.5)
    expect(m.extraEliteCount).toBe(2)
    expect(m.hazardIntervalMultiplier).toBeCloseTo(0.6)
    expect(m.perkPoolSize).toBe(4)
    expect(m.perkPickCount).toBe(2)
  })
})
