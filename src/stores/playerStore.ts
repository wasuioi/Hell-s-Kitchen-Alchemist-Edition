import { create } from 'zustand'
import { Position, StatusEffect } from '../types'

interface PlayerState {
  position: Position; rotation: number; hp: number; maxHp: number; status: StatusEffect
  setPosition: (pos: Position) => void; setRotation: (rot: number) => void
  takeDamage: (amount: number) => void; heal: (amount: number) => void
  setStatus: (status: StatusEffect) => void; reset: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal',
  setPosition: (pos) => set({ position: pos }),
  setRotation: (rot) => set({ rotation: rot }),
  takeDamage: (amount) => set((s) => ({ hp: Math.max(0, s.hp - amount) })),
  heal: (amount) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + amount) })),
  setStatus: (status) => set({ status }),
  reset: () => set({ position: { x: 0, z: 0 }, rotation: 0, hp: 100, maxHp: 100, status: 'normal' }),
}))
