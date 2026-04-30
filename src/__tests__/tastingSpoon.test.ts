import { describe, it, expect, beforeEach } from 'vitest'
import { triggerOnCast } from '../utils/perkTriggers'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'

function addTastingSpoon(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'tasting_spoon', name: 'Tasting Spoon', icon: '/icons/tasting_spoon.png', description: '', stackCount: 1 })
  }
}

beforeEach(() => {
  useDeckStore.getState().reset()
  usePlayerStore.getState().reset()
  // Set HP below max so heal is observable
  usePlayerStore.setState({ hp: 50 })
})

describe('triggerOnCast — tasting_spoon', () => {
  it('does nothing when tasting_spoon is not active', () => {
    for (let i = 0; i < 5; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(50)
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(0)
  })

  it('tier 1: increments counter without healing before interval', () => {
    addTastingSpoon(1)
    for (let i = 0; i < 4; i++) triggerOnCast()
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(4)
    expect(usePlayerStore.getState().hp).toBe(50)
  })

  it('tier 1: heals +5 HP on 5th cast and resets counter', () => {
    addTastingSpoon(1)
    for (let i = 0; i < 5; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(55)
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(0)
  })

  it('tier 1: heals exactly once per 5 casts (two full intervals)', () => {
    addTastingSpoon(1)
    for (let i = 0; i < 10; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(60)
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(0)
  })

  it('tier 2: heals +8 HP every 4 casts', () => {
    addTastingSpoon(2)
    for (let i = 0; i < 4; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(58)
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(0)
  })

  it('tier 2: no heal before 4 casts', () => {
    addTastingSpoon(2)
    for (let i = 0; i < 3; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(50)
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(3)
  })

  it('tier 3: heals +12 HP every 3 casts', () => {
    addTastingSpoon(3)
    for (let i = 0; i < 3; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(62)
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(0)
  })

  it('tier 3: shaves 0.5s off cook cooldown on heal', () => {
    addTastingSpoon(3)
    const fakeTimestamp = 100.0
    useDeckStore.getState().setCookCooldown(fakeTimestamp, 1.5)
    for (let i = 0; i < 3; i++) triggerOnCast()
    expect(useDeckStore.getState().cookCooldown).toBe(fakeTimestamp - 0.5)
  })

  it('tier 1: does not shave cooldown', () => {
    addTastingSpoon(1)
    const fakeTimestamp = 100.0
    useDeckStore.getState().setCookCooldown(fakeTimestamp, 1.5)
    for (let i = 0; i < 5; i++) triggerOnCast()
    expect(useDeckStore.getState().cookCooldown).toBe(fakeTimestamp)
  })

  it('heal clamps at maxHp', () => {
    addTastingSpoon(1)
    usePlayerStore.setState({ hp: 98 })
    for (let i = 0; i < 5; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(100)
  })

  it('counter resets after heal so cadence stays stable', () => {
    addTastingSpoon(1)
    for (let i = 0; i < 5; i++) triggerOnCast()
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(0)
    // 4 more casts — still no second heal
    for (let i = 0; i < 4; i++) triggerOnCast()
    expect(usePlayerStore.getState().hp).toBe(55)
    expect(useDeckStore.getState().tastingSpoonCastCount).toBe(4)
  })
})
