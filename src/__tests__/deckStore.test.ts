import { describe, it, expect, beforeEach } from 'vitest'
import { useDeckStore } from '../stores/deckStore'

describe('useDeckStore', () => {
  beforeEach(() => { useDeckStore.getState().reset() })

  it('initializes with 3 ingredients in hand', () => {
    useDeckStore.getState().initHand()
    expect(useDeckStore.getState().hand).toHaveLength(3)
  })

  it('each hand ingredient is CHILI, BOTTLE, or SALT', () => {
    useDeckStore.getState().initHand()
    for (const card of useDeckStore.getState().hand) {
      expect(['CHILI', 'BOTTLE', 'SALT']).toContain(card)
    }
  })

  it('slotIngredient places hand card into slot A and tags fromHandIndex', () => {
    useDeckStore.getState().initHand()
    const firstCard = useDeckStore.getState().hand[0]
    useDeckStore.getState().slotIngredient(0)
    const { slotA, slotB } = useDeckStore.getState().cauldron
    expect(slotA).toEqual({ ingredient: firstCard, fromHandIndex: 0 })
    expect(slotB).toBeNull()
  })

  it('slotIngredient does NOT mutate the hand on selection', () => {
    useDeckStore.getState().initHand()
    const handBefore = [...useDeckStore.getState().hand]
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().hand).toEqual(handBefore)
  })

  it('slotIngredient fills slot B when A is full and indices differ', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(1)
    const { slotA, slotB } = useDeckStore.getState().cauldron
    expect(slotA?.fromHandIndex).toBe(0)
    expect(slotB?.fromHandIndex).toBe(1)
  })

  it('slotIngredient on the same index that fills slot A unselects it (toggle)', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
  })

  it('slotIngredient on the same index that fills slot B unselects only B', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(1)
    useDeckStore.getState().slotIngredient(1)
    const { slotA, slotB } = useDeckStore.getState().cauldron
    expect(slotA?.fromHandIndex).toBe(0)
    expect(slotB).toBeNull()
  })

  it('slotIngredient does nothing when both slots filled by other indices', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(1)
    const handBefore = [...useDeckStore.getState().hand]
    const cauldronBefore = useDeckStore.getState().cauldron
    useDeckStore.getState().slotIngredient(2)
    expect(useDeckStore.getState().hand).toEqual(handBefore)
    expect(useDeckStore.getState().cauldron).toEqual(cauldronBefore)
  })

  it('cook returns spell type and clears cauldron', () => {
    useDeckStore.getState().initHand()
    useDeckStore.setState({
      cauldron: {
        slotA: { ingredient: 'CHILI', fromHandIndex: 0 },
        slotB: { ingredient: 'CHILI', fromHandIndex: 1 },
      },
    })
    expect(useDeckStore.getState().cook()).toBe('INFERNO')
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
  })

  it('cook draws fresh ingredients ONLY at the fromHandIndex positions', () => {
    useDeckStore.setState({
      hand: ['CHILI', 'BOTTLE', 'SALT'],
      cauldron: {
        slotA: { ingredient: 'CHILI', fromHandIndex: 0 },
        slotB: { ingredient: 'BOTTLE', fromHandIndex: 1 },
      },
    })
    useDeckStore.getState().cook()
    const hand = useDeckStore.getState().hand
    expect(hand).toHaveLength(3)
    // index 2 was untouched
    expect(hand[2]).toBe('SALT')
    // indices 0 and 1 are valid ingredients (might equal old by chance)
    expect(['CHILI', 'BOTTLE', 'SALT']).toContain(hand[0])
    expect(['CHILI', 'BOTTLE', 'SALT']).toContain(hand[1])
  })

  it('cook returns null when cauldron is not full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.setState({
      cauldron: {
        slotA: { ingredient: 'CHILI', fromHandIndex: 0 },
        slotB: null,
      },
    })
    expect(useDeckStore.getState().cook()).toBeNull()
  })

  it('addPerk adds to activePerks', () => {
    useDeckStore.getState().addPerk({ id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'test', stackCount: 1 })
    expect(useDeckStore.getState().activePerks).toHaveLength(1)
  })

  it('addPerk increments stackCount for duplicate perks', () => {
    const perk = { id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'test', stackCount: 1 }
    useDeckStore.getState().addPerk(perk)
    useDeckStore.getState().addPerk(perk)
    expect(useDeckStore.getState().activePerks).toHaveLength(1)
    expect(useDeckStore.getState().activePerks[0].stackCount).toBe(2)
  })

  it('reset clears everything', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().addPerk({ id: 'x', name: 'x', icon: 'x', description: 'x', stackCount: 1 })
    useDeckStore.getState().reset()
    expect(useDeckStore.getState().hand).toHaveLength(0)
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
    expect(useDeckStore.getState().activePerks).toHaveLength(0)
  })
})
