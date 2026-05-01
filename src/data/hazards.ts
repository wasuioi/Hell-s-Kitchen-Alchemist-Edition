import type { HazardType } from '../types'

// Per-type config for environmental hazards (issue #71).
// Lifecycle: telegraph (1s warning, no damage) → active (damage in radius
// every damageInterval seconds) → expired (removed from store).
export interface HazardDef {
  radius: number      // world units
  damage: number      // per damage tick
  damageInterval: number  // seconds between damage ticks while active
  telegraphMs: number // duration of warning ring before hazard goes live
  activeMs: number    // duration of active phase
  color: string       // base color for telegraph + active emissive
}

export const HAZARD_DEFS: Record<HazardType, HazardDef> = {
  grease_fire: {
    radius: 2.2,
    damage: 6,
    damageInterval: 0.5,
    telegraphMs: 1000,
    activeMs: 4000,
    color: '#ff6020',
  },
}

// All hazard types currently available for random scheduling.
export const HAZARD_POOL: HazardType[] = ['grease_fire']
