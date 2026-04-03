import { describe, it, expect, beforeEach } from 'vitest'
import { useDeckStore } from '../stores/deckStore'

describe('useDeckStore', () => {
  beforeEach(() => { useDeckStore.getState().reset() })
  it('initializes with 3 ingredients in hand', () => { useDeckStore.getState().initHand(); expect(useDeckStore.getState().hand).toHaveLength(3) })
  it('each hand ingredient is CHILI, BOTTLE, or SALT', () => {
    useDeckStore.getState().initHand()
    for (const card of useDeckStore.getState().hand) { expect(['CHILI', 'BOTTLE', 'SALT']).toContain(card) }
  })
  it('slotIngredient moves card from hand to cauldron slot A', () => {
    useDeckStore.getState().initHand()
    const firstCard = useDeckStore.getState().hand[0]
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().cauldron.slotA).toBe(firstCard)
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
    expect(useDeckStore.getState().hand).toHaveLength(3)
  })
  it('slotIngredient fills slot B when A is full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    const secondCard = useDeckStore.getState().hand[0]
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().cauldron.slotA).not.toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBe(secondCard)
  })
  it('slotIngredient does nothing when both slots are full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0); useDeckStore.getState().slotIngredient(0)
    const handBefore = [...useDeckStore.getState().hand]
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().hand).toEqual(handBefore)
  })
  it('cook returns spell type and clears cauldron', () => {
    useDeckStore.getState().initHand()
    useDeckStore.setState({ cauldron: { slotA: 'CHILI', slotB: 'CHILI' } })
    expect(useDeckStore.getState().cook()).toBe('INFERNO')
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
  })
  it('cook returns null when cauldron is not full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.setState({ cauldron: { slotA: 'CHILI', slotB: null } })
    expect(useDeckStore.getState().cook()).toBeNull()
  })
  it('addPerk adds to activePerks', () => {
    useDeckStore.getState().addPerk({ id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'test', stackCount: 1 })
    expect(useDeckStore.getState().activePerks).toHaveLength(1)
  })
  it('addPerk increments stackCount for duplicate perks', () => {
    const perk = { id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'test', stackCount: 1 }
    useDeckStore.getState().addPerk(perk); useDeckStore.getState().addPerk(perk)
    expect(useDeckStore.getState().activePerks).toHaveLength(1)
    expect(useDeckStore.getState().activePerks[0].stackCount).toBe(2)
  })
  it('reset clears everything', () => {
    useDeckStore.getState().initHand(); useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().addPerk({ id: 'x', name: 'x', icon: 'x', description: 'x', stackCount: 1 })
    useDeckStore.getState().reset()
    expect(useDeckStore.getState().hand).toHaveLength(0)
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().activePerks).toHaveLength(0)
  })
})
