import type { Position, Enemy } from '../types'

export function getDistance(a: Position, b: Position): number {
  const dx = a.x - b.x; const dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz)
}
export function isInRange(a: Position, b: Position, radius: number): boolean { return getDistance(a, b) <= radius }

export function findNearestEnemy(position: Position, enemies: Enemy[], maxRange?: number): Enemy | null {
  let nearest: Enemy | null = null
  let nearestDist = Infinity
  for (let i = 0; i < enemies.length; i++) {
    const dist = getDistance(position, enemies[i].position)
    if (maxRange !== undefined && dist > maxRange) continue
    if (dist < nearestDist) { nearest = enemies[i]; nearestDist = dist }
  }
  return nearest
}
