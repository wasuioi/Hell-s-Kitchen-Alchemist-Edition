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

describe('playerStore dash', () => {
  beforeEach(() => {
    usePlayerStore.getState().reset()
  })

  it('startDash sets isDashing and dashDirection', () => {
    usePlayerStore.getState().startDash({ x: 1, z: 0 })
    const state = usePlayerStore.getState()
    expect(state.isDashing).toBe(true)
    expect(state.dashDirection).toEqual({ x: 1, z: 0 })
    expect(state.dashCooldownUntil).toBeGreaterThan(0)
  })

  it('endDash clears isDashing and dashDirection', () => {
    usePlayerStore.getState().startDash({ x: 0, z: -1 })
    usePlayerStore.getState().endDash()
    const state = usePlayerStore.getState()
    expect(state.isDashing).toBe(false)
    expect(state.dashDirection).toBeNull()
  })

  it('startDash removes soaked status', () => {
    usePlayerStore.getState().setStatus('soaked')
    usePlayerStore.getState().startDash({ x: 1, z: 0 })
    expect(usePlayerStore.getState().status).toBe('normal')
  })

  it('reset clears dash state', () => {
    usePlayerStore.getState().startDash({ x: 1, z: 0 })
    usePlayerStore.getState().reset()
    const state = usePlayerStore.getState()
    expect(state.isDashing).toBe(false)
    expect(state.dashDirection).toBeNull()
    expect(state.dashCooldownUntil).toBe(0)
  })
})
