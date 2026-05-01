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

export type HazardDef = DiscHazardDef | RectHazardDef

export const HAZARD_DEFS: Record<HazardType, HazardDef> = {
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
}

// All hazard types currently available for random scheduling.
export const HAZARD_POOL: HazardType[] = ['grease_fire', 'steam_vent']
