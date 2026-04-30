import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../stores/playerStore'
import { useDeckStore } from '../stores/deckStore'

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

describe('playerStore heat', () => {
  beforeEach(() => { usePlayerStore.getState().reset() })

  it('starts with zero heat', () => {
    expect(usePlayerStore.getState().heatStacks).toBe(0)
    expect(usePlayerStore.getState().lastHitAt).toBe(0)
  })

  it('addHeat increments by 1 and stamps lastHitAt', () => {
    const before = performance.now()
    usePlayerStore.getState().addHeat(5)
    const s = usePlayerStore.getState()
    expect(s.heatStacks).toBe(1)
    expect(s.lastHitAt).toBeGreaterThanOrEqual(before)
  })

  it('addHeat caps at maxStacks', () => {
    for (let i = 0; i < 10; i++) usePlayerStore.getState().addHeat(5)
    expect(usePlayerStore.getState().heatStacks).toBe(5)
  })

  it('consumeHeat returns the consumed count and clears heat', () => {
    usePlayerStore.getState().addHeat(7)
    usePlayerStore.getState().addHeat(7)
    usePlayerStore.getState().addHeat(7)
    const consumed = usePlayerStore.getState().consumeHeat()
    expect(consumed).toBe(3)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('decayHeat does nothing if window has not elapsed', () => {
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().decayHeat(4000)
    expect(usePlayerStore.getState().heatStacks).toBe(1)
  })

  it('decayHeat removes 1 stack when window elapsed and resets the timer', () => {
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    // Force lastHitAt into the past
    usePlayerStore.setState({ lastHitAt: performance.now() - 5000 })
    usePlayerStore.getState().decayHeat(4000)
    const s = usePlayerStore.getState()
    expect(s.heatStacks).toBe(1)
    // lastHitAt should have been bumped to ~now so the next decay needs another window
    expect(s.lastHitAt).toBeGreaterThan(performance.now() - 1000)
  })

  it('decayHeat at 0 stacks is a no-op', () => {
    usePlayerStore.getState().decayHeat(4000)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('reset clears heat state', () => {
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.setState({ lastHitAt: 12345 })
    usePlayerStore.getState().reset()
    const s = usePlayerStore.getState()
    expect(s.heatStacks).toBe(0)
    expect(s.lastHitAt).toBe(0)
  })
})

describe('playerStore takeDamage + boiling_point integration', () => {
  beforeEach(() => {
    usePlayerStore.getState().reset()
    useDeckStore.getState().reset()
  })

  function addBoilingPoint(stacks: number) {
    for (let i = 0; i < stacks; i++) {
      useDeckStore.getState().addPerk({
        id: 'boiling_point', name: 'Boiling Point', icon: '/icons/boiling_point.png',
        description: '', stackCount: 1,
      })
    }
  }

  it('does not gain heat when boiling_point is not active', () => {
    usePlayerStore.getState().takeDamage(10)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('gains heat per hit when boiling_point is active', () => {
    addBoilingPoint(1)
    usePlayerStore.getState().takeDamage(10)
    usePlayerStore.getState().takeDamage(10)
    expect(usePlayerStore.getState().heatStacks).toBe(2)
  })

  it('caps at 5 stacks at T1', () => {
    addBoilingPoint(1)
    for (let i = 0; i < 10; i++) usePlayerStore.getState().takeDamage(5)
    expect(usePlayerStore.getState().heatStacks).toBe(5)
  })

  it('caps at 7 stacks at T2', () => {
    addBoilingPoint(2)
    for (let i = 0; i < 10; i++) usePlayerStore.getState().takeDamage(5)
    expect(usePlayerStore.getState().heatStacks).toBe(7)
  })

  it('caps at 7 stacks at T3', () => {
    addBoilingPoint(3)
    for (let i = 0; i < 10; i++) usePlayerStore.getState().takeDamage(5)
    expect(usePlayerStore.getState().heatStacks).toBe(7)
  })

  it('does not gain heat from a 0-damage call', () => {
    addBoilingPoint(1)
    usePlayerStore.getState().takeDamage(0)
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })
})
