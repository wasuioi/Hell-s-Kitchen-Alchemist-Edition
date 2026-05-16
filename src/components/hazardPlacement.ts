import { HAZARD_DEFS } from '../data/hazards'
import { ARENA_SIZE } from './Arena'
import type { HazardType, Position } from '../types'

// Pull disc spawns away from arena walls so they don't clip out of bounds.
const DISC_SPAWN_INSET = 4
// Keep wall vents away from corners so the rectangle doesn't graze the
// neighbouring wall.
const WALL_VENT_CORNER_INSET = 4

/** Pick a spawn position + rotation for a freshly-rolled hazard type.
 *  Exported so DevPanel can reuse the same placement rules when manually
 *  spawning a hazard of a chosen type. */
export function rollHazardPlacement(type: HazardType): { position: Position; rotation: number } {
  const def = HAZARD_DEFS[type]
  // Disc + falling both land at a random arena point — falling is just
  // visually different (drops from above) but its impact center is on the floor.
  if (def.shape === 'disc' || def.shape === 'falling') {
    const half = ARENA_SIZE / 2 - DISC_SPAWN_INSET
    return {
      position: {
        x: (Math.random() - 0.5) * 2 * half,
        z: (Math.random() - 0.5) * 2 * half,
      },
      rotation: 0,
    }
  }
  // Rect (steam vent): anchor on a random wall, perpendicular into arena.
  const half = ARENA_SIZE / 2
  const alongMax = ARENA_SIZE / 2 - WALL_VENT_CORNER_INSET
  const along = (Math.random() - 0.5) * 2 * alongMax
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { position: { x: along, z: -half }, rotation: 0 }              // north wall, +z
    case 1: return { position: { x: along, z: half }, rotation: Math.PI }         // south wall, -z
    case 2: return { position: { x: half, z: along }, rotation: -Math.PI / 2 }    // east wall, -x
    default: return { position: { x: -half, z: along }, rotation: Math.PI / 2 }   // west wall, +x
  }
}
