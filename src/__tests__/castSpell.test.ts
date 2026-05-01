import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlayerStore } from '../stores/playerStore'
import { useDeckStore } from '../stores/deckStore'
import { SPELL_CONFIG } from '../data/recipes'

const INFERNO_BASE = SPELL_CONFIG.INFERNO.damage
const TIDAL_BASE = SPELL_CONFIG.TIDAL_WAVE.damage

// Mock the window globals castSpell calls so the test doesn't crash. Vitest
// runs in jsdom (vitest.config.ts), so `window` already exists — we only
// need to attach the dynamic globals that the 3D scene normally provides.
beforeEach(() => {
  ;(window as any).__castSpell = vi.fn()
  ;(window as any).__playerAttack = vi.fn()
  ;(window as any).__spawnSpriteVfx = vi.fn()
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

describe('castSpell + boiling_point', () => {
  it('does not affect damage when no heat is banked', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.damage).toBe(INFERNO_BASE)
  })

  it('multiplies INFERNO damage by +10% per Heat stack at T1', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    for (let i = 0; i < 5; i++) usePlayerStore.getState().addHeat(5) // 5 heat
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // base × (1 + 0.10 × 5) = base × 1.5
    expect(spell.damage).toBeCloseTo(INFERNO_BASE * 1.5, 5)
  })

  it('multiplies INFERNO damage by +15% per Heat stack at T3', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(3)
    for (let i = 0; i < 7; i++) usePlayerStore.getState().addHeat(7) // 7 heat
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // base × (1 + 0.15 × 7) = base × 2.05
    expect(spell.damage).toBeCloseTo(INFERNO_BASE * 2.05, 5)
  })

  it('overflow stacks add +5%/Heat per perk stack beyond T3', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(4) // 1 stack of overflow
    for (let i = 0; i < 7; i++) usePlayerStore.getState().addHeat(7)
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // perStack = 0.15 + 0.05 × 1 = 0.20
    // perStack = 0.15 + 0.05 × 1 = 0.20 → base × (1 + 0.20 × 7) = base × 2.40
    expect(spell.damage).toBeCloseTo(INFERNO_BASE * 2.40, 5)
  })

  it('clears heat after INFERNO is cast', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    castSpell('INFERNO')
    expect(usePlayerStore.getState().heatStacks).toBe(0)
  })

  it('does NOT consume heat when casting a non-INFERNO spell', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    castSpell('TIDAL_WAVE')
    expect(usePlayerStore.getState().heatStacks).toBe(2)
  })

  it('T3 heals 2 HP per Heat stack consumed', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(3)
    usePlayerStore.getState().takeDamage(50) // hp 100→50, also adds 1 heat
    for (let i = 0; i < 4; i++) usePlayerStore.getState().addHeat(7)
    // total heat: 5 (1 from takeDamage + 4 from addHeat) → heals 5 × 2 = 10
    castSpell('INFERNO')
    expect(usePlayerStore.getState().hp).toBe(60) // 50 + 10 healed
  })

  it('T1 does NOT heal on consume', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().takeDamage(50)
    castSpell('INFERNO')
    expect(usePlayerStore.getState().hp).toBe(50) // 1 heat consumed but no heal at T1
  })
})

describe('castSpell + boiling_point VFX', () => {
  it('spawns both consume + spell VFX when Heat is at threshold (5+) on INFERNO', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    for (let i = 0; i < 5; i++) usePlayerStore.getState().addHeat(5) // 5 heat — at threshold
    castSpell('INFERNO')
    const calls = (window as any).__spawnSpriteVfx.mock.calls
    const slugs = calls.map((c: any[]) => c[0].spriteSlug)
    expect(slugs).toContain('boiling_point_consume')
    expect(slugs).toContain('boiling_point_spell')
  })

  it('does not spawn VFX when no Heat is banked', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    castSpell('INFERNO')
    const calls = (window as any).__spawnSpriteVfx.mock.calls
    const slugs = calls.map((c: any[]) => c[0].spriteSlug)
    expect(slugs).not.toContain('boiling_point_consume')
  })

  it('does not spawn VFX when casting non-INFERNO with banked Heat', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    castSpell('TIDAL_WAVE')
    const calls = (window as any).__spawnSpriteVfx.mock.calls
    const slugs = calls.map((c: any[]) => c[0].spriteSlug)
    expect(slugs).not.toContain('boiling_point_consume')
  })

  it('does NOT spawn VFX when Heat is below 5 on INFERNO', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5) // 4 heat — below threshold
    castSpell('INFERNO')
    const calls = (window as any).__spawnSpriteVfx.mock.calls
    const slugs = calls.map((c: any[]) => c[0].spriteSlug)
    expect(slugs).not.toContain('boiling_point_consume')
    expect(slugs).not.toContain('boiling_point_spell')
  })

  it('still applies damage multiplier when Heat is below 5 (no VFX)', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
    usePlayerStore.getState().addHeat(5) // 2 heat
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // base × (1 + 0.10 × 2) = base × 1.2 — multiplier still works
    expect(spell.damage).toBeCloseTo(INFERNO_BASE * 1.2, 5)
    expect(usePlayerStore.getState().heatStacks).toBe(0) // Heat still consumes
  })
})

function addSaute(stacks: number) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({
      id: 'saute', name: 'Sauté', icon: '/icons/saute.png',
      description: '', stackCount: 1,
    })
  }
}

describe('castSpell + saute', () => {
  it('applies +12% damage at T1 when player moved recently', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(1)
    usePlayerStore.setState({ lastMoveTime: performance.now() - 100 }) // 100ms ago, within 250ms
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.damage).toBeCloseTo(TIDAL_BASE * 1.12, 5)
  })

  it('no bonus when player has not moved recently at T1', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(1)
    usePlayerStore.setState({ lastMoveTime: 0 }) // never moved
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.damage).toBeCloseTo(TIDAL_BASE, 5)
  })

  it('no bonus when last move was outside the T1 250ms window', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(1)
    usePlayerStore.setState({ lastMoveTime: performance.now() - 400 }) // 400ms ago, outside 250ms
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.damage).toBeCloseTo(TIDAL_BASE, 5)
  })

  it('applies +20% damage at T2', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(2)
    usePlayerStore.setState({ lastMoveTime: performance.now() - 100 })
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.damage).toBeCloseTo(TIDAL_BASE * 1.20, 5)
  })

  it('T2 window is 500ms — triggers if last move was 400ms ago', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(2)
    usePlayerStore.setState({ lastMoveTime: performance.now() - 400 })
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.damage).toBeCloseTo(TIDAL_BASE * 1.20, 5)
  })

  it('applies +32% damage at T3', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(3)
    usePlayerStore.setState({ lastMoveTime: performance.now() - 100 })
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.damage).toBeCloseTo(TIDAL_BASE * 1.32, 5)
  })

  it('sets sizzle=true on spell at T3 when moving', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(3)
    usePlayerStore.setState({ lastMoveTime: performance.now() - 100 })
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.sizzle).toBe(true)
  })

  it('sizzle is falsy at T1 even when moving', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(1)
    usePlayerStore.setState({ lastMoveTime: performance.now() - 100 })
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.sizzle).toBeFalsy()
  })

  it('sizzle is falsy at T3 when not moving', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addSaute(3)
    usePlayerStore.setState({ lastMoveTime: 0 })
    castSpell('TIDAL_WAVE')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    expect(spell.sizzle).toBeFalsy()
  })
})
