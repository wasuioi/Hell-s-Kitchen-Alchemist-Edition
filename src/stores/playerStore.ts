import { create } from 'zustand'
import type { Position, StatusEffect } from '../types'
import { triggerOnDamageTaken } from '../utils/perkTriggers'
import { useDeckStore } from './deckStore'

const DASH_COOLDOWN_MS = 2500
const DASH_DURATION_MS = 150
// BoilingPoint Heat caps per perk-tier (index = tier - 1)
export const BOILING_POINT_MAX_HEAT = [5, 7, 7]

interface PlayerState {
  position: Position; rotation: number; hp: number; maxHp: number; status: StatusEffect
  // Dash state
  isDashing: boolean
  dashDirection: Position | null
  dashCooldownUntil: number
  dashEndTime: number
  // Heat state (BoilingPoint perk)
  heatStacks: number
  lastHitAt: number
  // Speed buff (Salt Speed spell)
  speedBuffUntil: number
  // Sauté perk: timestamp of last position change
  lastMoveTime: number
  // Actions
  setPosition: (pos: Position) => void; setRotation: (rot: number) => void
  takeDamage: (amount: number) => void; heal: (amount: number) => void
  setStatus: (status: StatusEffect) => void
  startDash: (direction: Position) => void; endDash: () => void
  addHeat: (maxStacks: number) => void
  consumeHeat: () => number
  decayHeat: (decayMs: number) => void
  setSpeedBuff: (until: number) => void
  reset: () => void
}

export const DASH_SPEED_MULTIPLIER = 3
export const PLAYER_DASH_DURATION_MS = DASH_DURATION_MS
export const PLAYER_DASH_COOLDOWN_MS = DASH_COOLDOWN_MS

export const usePlayerStore = create<PlayerState>((set, get) => ({
  position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
  isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
  heatStacks: 0, lastHitAt: 0,
  speedBuffUntil: 0, lastMoveTime: 0,
  setPosition: (pos) => set({ position: pos }),
  setRotation: (rot) => set({ rotation: rot }),
  takeDamage: (amount) => {
    if (amount > 0) {
      triggerOnDamageTaken(amount, get().position)
      const bpStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'boiling_point')?.stackCount ?? 0
      if (bpStacks > 0) {
        const tier = Math.min(bpStacks, 3)
        get().addHeat(BOILING_POINT_MAX_HEAT[tier - 1])
      }
    }
    set((s) => ({ hp: Math.max(0, s.hp - amount) }))
  },
  heal: (amount) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + amount) })),
  setStatus: (status) => set({ status }),
  startDash: (direction) => {
    const now = performance.now()
    set({
      isDashing: true,
      dashDirection: direction,
      dashCooldownUntil: now + DASH_COOLDOWN_MS,
      dashEndTime: now + DASH_DURATION_MS,
      status: 'normal', // Dash removes soaked
    })
  },
  endDash: () => set({ isDashing: false, dashDirection: null }),
  addHeat: (maxStacks) => set((s) => ({
    heatStacks: Math.min(maxStacks, s.heatStacks + 1),
    lastHitAt: performance.now(),
  })),
  consumeHeat: () => {
    const consumed = get().heatStacks
    set({ heatStacks: 0 })
    return consumed
  },
  decayHeat: (decayMs) => {
    const s = get()
    if (s.heatStacks === 0) return
    if (performance.now() - s.lastHitAt < decayMs) return
    set({ heatStacks: s.heatStacks - 1, lastHitAt: performance.now() })
  },
  setSpeedBuff: (until) => set({ speedBuffUntil: until }),
  reset: () => set({
    position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
    isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
    heatStacks: 0, lastHitAt: 0, speedBuffUntil: 0, lastMoveTime: 0,
  }),
}))
