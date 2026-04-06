import { create } from 'zustand'
import type { Position, StatusEffect } from '../types'

const DASH_COOLDOWN_MS = 2500
const DASH_DURATION_MS = 150

interface PlayerState {
  position: Position; rotation: number; hp: number; maxHp: number; status: StatusEffect
  // Dash state
  isDashing: boolean
  dashDirection: Position | null
  dashCooldownUntil: number
  dashEndTime: number
  // Actions
  setPosition: (pos: Position) => void; setRotation: (rot: number) => void
  takeDamage: (amount: number) => void; heal: (amount: number) => void
  setStatus: (status: StatusEffect) => void
  startDash: (direction: Position) => void; endDash: () => void
  reset: () => void
}

export const DASH_SPEED_MULTIPLIER = 3
export const PLAYER_DASH_DURATION_MS = DASH_DURATION_MS
export const PLAYER_DASH_COOLDOWN_MS = DASH_COOLDOWN_MS

export const usePlayerStore = create<PlayerState>((set) => ({
  position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
  isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
  setPosition: (pos) => set({ position: pos }),
  setRotation: (rot) => set({ rotation: rot }),
  takeDamage: (amount) => set((s) => ({ hp: Math.max(0, s.hp - amount) })),
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
  reset: () => set({
    position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
    isDashing: false, dashDirection: null, dashCooldownUntil: 0, dashEndTime: 0,
  }),
}))
