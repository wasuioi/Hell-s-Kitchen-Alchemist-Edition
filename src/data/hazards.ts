import type { HazardType } from '../types'

// Per-type config for environmental hazards (issue #71).
// Lifecycle: telegraph (warning, no damage) → active (damage in shape every
// damageInterval seconds) → expired (removed from store).

interface BaseHazardDef {
  damage: number
  damageInterval: number  // seconds between damage ticks while active
  telegraphMs: number     // duration of warning before hazard goes live
  activeMs: number        // duration of active phase
  color: string           // base color for telegraph + active emissive
}

/** Circle hazard (e.g. grease fire) — `radius` is the damage circle's radius. */
export interface DiscHazardDef extends BaseHazardDef {
  shape: 'disc'
  radius: number
}

/** Directional hazard (e.g. steam vent). Anchored at `position`, extends
 *  `length` units along its rotated +z axis with `width` perpendicular.
 *  Damage area = rectangle from local (−width/2, 0) to (+width/2, length). */
export interface RectHazardDef extends BaseHazardDef {
  shape: 'rect'
  width: number
  length: number
}

/** Vertical-impact hazard (e.g. falling pot). Visually distinct — telegraph
 *  is a growing shadow on the floor while a mesh drops in from above. The
 *  damage check is a single circle of `radius` at impact. Pair with a
 *  damageInterval longer than activeMs to make it a single-tick wallop. */
export interface FallingHazardDef extends BaseHazardDef {
  shape: 'falling'
  radius: number
}

export type HazardDef = DiscHazardDef | RectHazardDef | FallingHazardDef

export const HAZARD_DEFS: Record<HazardType, HazardDef> = {
  // Salt Sigil (perk #118) — player-planted; lifecycle/damage are handled entirely
  // by tickSaltSigils() in perkTriggers.ts, not by HazardManager's main loop.
  // This stub satisfies the Record<HazardType, HazardDef> constraint only.
  salt_sigil: {
    shape: 'disc',
    radius: 4.0,
    damage: 0,
    damageInterval: 99,
    telegraphMs: 0,
    activeMs: 0,
    color: '#f59e0b',
  },
  grease_fire: {
    shape: 'disc',
    radius: 2.2,
    damage: 6,
    damageInterval: 0.5,
    telegraphMs: 1000,
    activeMs: 4000,
    color: '#ff6020',
  },
  steam_vent: {
    shape: 'rect',
    width: 1.8,
    length: 6,
    damage: 4,
    damageInterval: 0.5,
    telegraphMs: 1200,
    activeMs: 2500,
    color: '#a8e8ff',
  },
  falling_pot: {
    shape: 'falling',
    radius: 1.6,
    damage: 22,            // single-shot wallop — punishes ignoring the shadow
    damageInterval: 99,    // > activeMs ⇒ effectively single tick at impact
    telegraphMs: 1500,     // long enough to read the shadow + reposition
    activeMs: 500,         // brief landed window where the pot still hurts
    color: '#3a3a3a',      // dark cast-iron gray
  },
}

// All hazard types currently available for random scheduling.
export const HAZARD_POOL: HazardType[] = ['grease_fire', 'steam_vent', 'falling_pot']
