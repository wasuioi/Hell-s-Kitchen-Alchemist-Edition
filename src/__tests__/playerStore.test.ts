import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../stores/playerStore'

describe('usePlayerStore', () => {
  beforeEach(() => { usePlayerStore.getState().reset() })
  it('starts at center with full HP', () => {
    const s = usePlayerStore.getState()
    expect(s.position).toEqual({ x: 0, z: 0 }); expect(s.hp).toBe(100); expect(s.maxHp).toBe(100); expect(s.status).toBe('normal')
  })
  it('takeDamage reduces HP', () => { usePlayerStore.getState().takeDamage(30); expect(usePlayerStore.getState().hp).toBe(70) })
  it('takeDamage does not go below 0', () => { usePlayerStore.getState().takeDamage(150); expect(usePlayerStore.getState().hp).toBe(0) })
  it('heal increases HP', () => { usePlayerStore.getState().takeDamage(50); usePlayerStore.getState().heal(20); expect(usePlayerStore.getState().hp).toBe(70) })
  it('heal does not exceed maxHp', () => { usePlayerStore.getState().takeDamage(10); usePlayerStore.getState().heal(50); expect(usePlayerStore.getState().hp).toBe(100) })
  it('setPosition updates position', () => { usePlayerStore.getState().setPosition({ x: 5, z: 3 }); expect(usePlayerStore.getState().position).toEqual({ x: 5, z: 3 }) })
  it('setStatus changes status', () => { usePlayerStore.getState().setStatus('soaked'); expect(usePlayerStore.getState().status).toBe('soaked') })
  it('reset restores initial state', () => {
    usePlayerStore.getState().takeDamage(50); usePlayerStore.getState().setPosition({ x: 10, z: 10 }); usePlayerStore.getState().setStatus('stunned')
    usePlayerStore.getState().reset()
    expect(usePlayerStore.getState().hp).toBe(100); expect(usePlayerStore.getState().position).toEqual({ x: 0, z: 0 }); expect(usePlayerStore.getState().status).toBe('normal')
  })
})
