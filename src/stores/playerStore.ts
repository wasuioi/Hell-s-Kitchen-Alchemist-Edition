import { create } from 'zustand'
import type { Position, StatusEffect } from '../types'
import { triggerOnDamageTaken } from '../utils/perkTriggers'
import { useDeckStore } from './deckStore'

const DASH_COOLDOWN_MS = 2500
const DASH_DURATION_MS = 150

interface PlayerState {
  position: Position; rotation: number; hp: number; maxHp: number; status: StatusEffect
  // Dash state
  isDashing: boolean
  dashDirection: Position | null
  dashCooldownUntil: number
  dashEndTime: number
  // Speed buff (Salt Speed spell)
  speedBuffUntil: number
  // Ashen Apron charge resource
  ashCharges: number
  // Actions
  setPosition: (pos: Position) => void; setRotation: (rot: number) => void
  takeDamage: (amount: number) => void; heal: (amount: number) => void
  setStatus: (status: StatusEffect) => void
  startDash: (direction: Position) => void; endDash: () => void
  setSpeedBuff: (until: number) => void
  addAshCharge: (max: number) => void
  consumeAshCharge: () => void
  reset: () => void
}

export const DASH_SPEED_MULTIPLIER = 3
export const PLAYER_DASH_DURATION_MS = DASH_DURATION_MS
export const PLAYER_DASH_COOLDOWN_MS = DASH_COOLDOWN_MS

export const usePlayerStore = create<PlayerState>((set, get) => ({
  position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
  isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
  speedBuffUntil: 0, ashCharges: 0,
  setPosition: (pos) => set({ position: pos }),
  setRotation: (rot) => set({ rotation: rot }),
  takeDamage: (amount) => {
    let modifiedAmount = amount
    let ashChargeConsumed = false
    const apron = useDeckStore.getState().activePerks.find((p) => p.id === 'ashen_apron')
    if (apron && get().ashCharges > 0 && amount > 0) {
      const tier = Math.min(apron.stackCount, 3)
      const reduction = [0.5, 0.7, 0.9][tier - 1]
      modifiedAmount = Math.round(amount * (1 - reduction))
      get().consumeAshCharge()
      ashChargeConsumed = true
    }
    if (modifiedAmount > 0) triggerOnDamageTaken(modifiedAmount, get().position, ashChargeConsumed)
    set((s) => ({ hp: Math.max(0, s.hp - modifiedAmount) }))
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
  setSpeedBuff: (until) => set({ speedBuffUntil: until }),
  addAshCharge: (max) => set((s) => ({ ashCharges: Math.min(s.ashCharges + 1, max) })),
  consumeAshCharge: () => set((s) => ({ ashCharges: Math.max(s.ashCharges - 1, 0) })),
  reset: () => set({
    position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
    isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
    speedBuffUntil: 0, ashCharges: 0,
  }),
}))
