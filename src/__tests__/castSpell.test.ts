import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlayerStore } from '../stores/playerStore'
import { useDeckStore } from '../stores/deckStore'

// Mock the window globals castSpell calls so the test doesn't crash. Vitest
// runs in jsdom (vitest.config.ts), so `window` already exists — we only
// need to attach the dynamic globals that the 3D scene normally provides.
beforeEach(() => {
  ;(window as any).__castSpell = vi.fn()
  ;(window as any).__setLastSpellColor = vi.fn()
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
    // INFERNO base damage is 40 (see SPELL_CONFIG)
    expect(spell.damage).toBe(40)
  })

  it('multiplies INFERNO damage by +20% per Heat stack at T1', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    for (let i = 0; i < 5; i++) usePlayerStore.getState().addHeat(5) // 5 heat
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // 40 × (1 + 0.20 × 5) = 40 × 2.0 = 80
    expect(spell.damage).toBeCloseTo(80, 5)
  })

  it('multiplies INFERNO damage by +25% per Heat stack at T3', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(3)
    for (let i = 0; i < 7; i++) usePlayerStore.getState().addHeat(7) // 7 heat
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // 40 × (1 + 0.25 × 7) = 40 × 2.75 = 110
    expect(spell.damage).toBeCloseTo(110, 5)
  })

  it('overflow stacks add +5%/Heat per perk stack beyond T3', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(4) // 1 stack of overflow
    for (let i = 0; i < 7; i++) usePlayerStore.getState().addHeat(7)
    castSpell('INFERNO')
    const spell = (window as any).__castSpell.mock.calls.at(-1)[0]
    // perStack = 0.25 + 0.05 × 1 = 0.30
    // 40 × (1 + 0.30 × 7) = 40 × 3.10 = 124
    expect(spell.damage).toBeCloseTo(124, 5)
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

  it('T3 heals 1 HP per Heat stack consumed', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(3)
    usePlayerStore.getState().takeDamage(50) // hp 100→50, also adds 1 heat
    for (let i = 0; i < 4; i++) usePlayerStore.getState().addHeat(7)
    // total heat: 5 (1 from takeDamage + 4 from addHeat)
    castSpell('INFERNO')
    expect(usePlayerStore.getState().hp).toBe(55) // 50 + 5 healed
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
  it('spawns both consume + spell VFX when Heat is consumed on INFERNO', async () => {
    const { castSpell } = await import('../utils/castSpell')
    addBoilingPoint(1)
    usePlayerStore.getState().addHeat(5)
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
})
