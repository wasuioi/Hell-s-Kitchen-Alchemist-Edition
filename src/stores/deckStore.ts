import { create } from 'zustand'
import type { Ingredient, Perk, SpellType } from '../types'
import { getRecipe } from '../data/recipes'

const INGREDIENTS: Ingredient[] = ['CHILI', 'BOTTLE', 'SALT']
function drawRandomIngredient(): Ingredient { return INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)] }

interface DeckState {
  hand: Ingredient[]; cauldron: { slotA: Ingredient | null; slotB: Ingredient | null }
  activePerks: Perk[]; cookCooldown: number; cookCooldownDuration: number
  tastingSpoonCastCount: number
  initHand: () => void; slotIngredient: (handIndex: number) => void
  cook: () => SpellType | null; addPerk: (perk: Perk) => void; clearPerks: () => void
  setCookCooldown: (timestamp: number, duration: number) => void
  setTastingSpoonCastCount: (n: number) => void
  reduceCookCooldown: (seconds: number) => void
  reset: () => void
}

export const useDeckStore = create<DeckState>((set, get) => ({
  hand: [], cauldron: { slotA: null, slotB: null }, activePerks: [], cookCooldown: 0, cookCooldownDuration: 1.5, tastingSpoonCastCount: 0,
  initHand: () => set({ hand: [drawRandomIngredient(), drawRandomIngredient(), drawRandomIngredient()], cauldron: { slotA: null, slotB: null } }),
  slotIngredient: (handIndex) => {
    const state = get()
    if (state.cauldron.slotA !== null && state.cauldron.slotB !== null) return
    if (handIndex < 0 || handIndex >= state.hand.length) return
    const ingredient = state.hand[handIndex]
    const newHand = [...state.hand]; newHand[handIndex] = drawRandomIngredient()
    if (state.cauldron.slotA === null) { set({ hand: newHand, cauldron: { slotA: ingredient, slotB: null } }) }
    else { set({ hand: newHand, cauldron: { slotA: state.cauldron.slotA, slotB: ingredient } }) }
  },
  cook: () => {
    const state = get()
    if (state.cauldron.slotA === null || state.cauldron.slotB === null) return null
    const spell = getRecipe(state.cauldron.slotA, state.cauldron.slotB)
    set({ cauldron: { slotA: null, slotB: null } }); return spell
  },
  addPerk: (perk) => set((state) => {
    const existing = state.activePerks.find((p) => p.id === perk.id)
    if (existing) { return { activePerks: state.activePerks.map((p) => p.id === perk.id ? { ...p, stackCount: p.stackCount + 1 } : p) } }
    return { activePerks: [...state.activePerks, { ...perk, stackCount: 1 }] }
  }),
  clearPerks: () => set({ activePerks: [] }),
  setCookCooldown: (timestamp, duration) => set({ cookCooldown: timestamp, cookCooldownDuration: duration }),
  setTastingSpoonCastCount: (n) => set({ tastingSpoonCastCount: n }),
  reduceCookCooldown: (seconds) => set((s) => ({ cookCooldown: s.cookCooldown > 0 ? s.cookCooldown - seconds : 0 })),
  reset: () => set({ hand: [], cauldron: { slotA: null, slotB: null }, activePerks: [], cookCooldown: 0, cookCooldownDuration: 1.5, tastingSpoonCastCount: 0 }),
}))
