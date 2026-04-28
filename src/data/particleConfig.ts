import type { SpellType } from '../types'

export interface ParticleSpellConfig {
  color: string
  lingerYSpeed: number
  texture: 'circle' | 'square'
  burstDirection: 'sphere' | 'hemisphere'
  meteorJitter?: boolean
  fireFlicker?: boolean
  burstCount?: number
}

export const PARTICLE_CONFIG: Record<SpellType, ParticleSpellConfig> = {
  INFERNO: {
    color: '#ef4444',
    lingerYSpeed: 1.5,
    texture: 'circle',
    burstDirection: 'sphere',
    fireFlicker: true,
    burstCount: 100,
  },
  TIDAL_WAVE: {
    color: '#3b82f6',
    lingerYSpeed: 1.0,
    texture: 'circle',
    burstDirection: 'sphere',
  },
  FORTRESS: {
    color: '#9ca3af',
    lingerYSpeed: 0.8,
    texture: 'square',
    burstDirection: 'hemisphere',
  },
  STEAM: {
    color: '#a855f7',
    lingerYSpeed: 2.5,
    texture: 'circle',
    burstDirection: 'sphere',
  },
  METEOR: {
    color: '#f97316',
    lingerYSpeed: 1.0,
    texture: 'square',
    burstDirection: 'hemisphere',
    meteorJitter: true,
    burstCount: 100,
  },
  MUD: {
    color: '#b48c50',
    lingerYSpeed: 0.5,
    texture: 'circle',
    burstDirection: 'sphere',
  },
}
