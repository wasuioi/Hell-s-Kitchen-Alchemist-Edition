import { describe, it, expect } from 'vitest'
import { PARTICLE_CONFIG } from '../data/particleConfig'
import type { SpellType } from '../types'

const ALL_SPELLS: SpellType[] = ['INFERNO', 'TIDAL_WAVE', 'SALT_SPEED', 'STEAM', 'METEOR', 'MUD']

describe('PARTICLE_CONFIG', () => {
  it('has config for every spell type', () => {
    for (const spell of ALL_SPELLS) {
      expect(PARTICLE_CONFIG[spell]).toBeDefined()
    }
  })

  it('every spell has required fields', () => {
    for (const spell of ALL_SPELLS) {
      const cfg = PARTICLE_CONFIG[spell]
      expect(cfg.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(cfg.lingerYSpeed).toBeGreaterThan(0)
      expect(cfg.texture).toMatch(/^circle|square$/)
      expect(cfg.burstDirection).toMatch(/^sphere|hemisphere$/)
    }
  })

  it('stone spells use square texture and hemisphere burst', () => {
    expect(PARTICLE_CONFIG.SALT_SPEED.texture).toBe('square')
    expect(PARTICLE_CONFIG.SALT_SPEED.burstDirection).toBe('hemisphere')
    expect(PARTICLE_CONFIG.METEOR.texture).toBe('square')
    expect(PARTICLE_CONFIG.METEOR.burstDirection).toBe('hemisphere')
  })

  it('non-stone spells use circle texture and sphere burst', () => {
    expect(PARTICLE_CONFIG.INFERNO.texture).toBe('circle')
    expect(PARTICLE_CONFIG.INFERNO.burstDirection).toBe('sphere')
    expect(PARTICLE_CONFIG.TIDAL_WAVE.texture).toBe('circle')
    expect(PARTICLE_CONFIG.TIDAL_WAVE.burstDirection).toBe('sphere')
    expect(PARTICLE_CONFIG.STEAM.texture).toBe('circle')
    expect(PARTICLE_CONFIG.STEAM.burstDirection).toBe('sphere')
    expect(PARTICLE_CONFIG.MUD.texture).toBe('circle')
    expect(PARTICLE_CONFIG.MUD.burstDirection).toBe('sphere')
  })

  it('meteor has jitter flag', () => {
    expect(PARTICLE_CONFIG.METEOR.meteorJitter).toBe(true)
  })

  it('inferno has fireFlicker flag', () => {
    expect(PARTICLE_CONFIG.INFERNO.fireFlicker).toBe(true)
  })
})
