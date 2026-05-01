import { create } from 'zustand'
import type { Ingredient, Perk, SpellType } from '../types'
import { getRecipe } from '../data/recipes'

const INGREDIENTS: Ingredient[] = ['CHILI', 'BOTTLE', 'SALT']
function drawRandomIngredient(): Ingredient {
  return INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]
}

export interface CauldronSlot {
  ingredient: Ingredient
  fromHandIndex: number
}

interface DeckState {
  hand: Ingredient[]
  cauldron: { slotA: CauldronSlot | null; slotB: CauldronSlot | null }
  activePerks: Perk[]
  cookCooldown: number
  cookCooldownDuration: number
  initHand: () => void
  slotIngredient: (handIndex: number) => void
  cook: () => SpellType | null
  addPerk: (perk: Perk) => void
  clearPerks: () => void
  setCookCooldown: (timestamp: number, duration: number) => void
  reset: () => void
}

export const useDeckStore = create<DeckState>((set, get) => ({
  hand: [],
  cauldron: { slotA: null, slotB: null },
  activePerks: [],
  cookCooldown: 0,
  cookCooldownDuration: 1.5,

  initHand: () => set({
    hand: [drawRandomIngredient(), drawRandomIngredient(), drawRandomIngredient()],
    cauldron: { slotA: null, slotB: null },
  }),

  slotIngredient: (handIndex) => {
    const state = get()
    if (handIndex < 0 || handIndex >= state.hand.length) return
    const { slotA, slotB } = state.cauldron
    // Toggle off: clicking the index that fills A or B unselects it.
    if (slotA?.fromHandIndex === handIndex) {
      set({ cauldron: { slotA: null, slotB } })
      return
    }
    if (slotB?.fromHandIndex === handIndex) {
      set({ cauldron: { slotA, slotB: null } })
      return
    }
    // Place into next empty slot.
    const ingredient = state.hand[handIndex]
    if (slotA === null) {
      set({ cauldron: { slotA: { ingredient, fromHandIndex: handIndex }, slotB } })
      return
    }
    if (slotB === null) {
      set({ cauldron: { slotA, slotB: { ingredient, fromHandIndex: handIndex } } })
      return
    }
    // Both slots full and clicked index isn't selected — do nothing.
  },

  cook: () => {
    const state = get()
    const { slotA, slotB } = state.cauldron
    if (slotA === null || slotB === null) return null
    const spell = getRecipe(slotA.ingredient, slotB.ingredient)
    const newHand = [...state.hand]
    newHand[slotA.fromHandIndex] = drawRandomIngredient()
    newHand[slotB.fromHandIndex] = drawRandomIngredient()
    set({ hand: newHand, cauldron: { slotA: null, slotB: null } })
    return spell
  },

  addPerk: (perk) => set((state) => {
    const existing = state.activePerks.find((p) => p.id === perk.id)
    if (existing) {
      return {
        activePerks: state.activePerks.map((p) =>
          p.id === perk.id ? { ...p, stackCount: p.stackCount + 1 } : p
        ),
      }
    }
    return { activePerks: [...state.activePerks, { ...perk, stackCount: 1 }] }
  }),

  clearPerks: () => set({ activePerks: [] }),

  setCookCooldown: (timestamp, duration) => set({
    cookCooldown: timestamp,
    cookCooldownDuration: duration,
  }),

  reset: () => set({
    hand: [],
    cauldron: { slotA: null, slotB: null },
    activePerks: [],
    cookCooldown: 0,
    cookCooldownDuration: 1.5,
  }),
}))
