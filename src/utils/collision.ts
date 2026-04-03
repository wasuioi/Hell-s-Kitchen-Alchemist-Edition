import { Position, Enemy } from '../types'

export function getDistance(a: Position, b: Position): number {
  const dx = a.x - b.x; const dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz)
}
export function isInRange(a: Position, b: Position, radius: number): boolean { return getDistance(a, b) <= radius }
export function findNearestEnemy(position: Position, enemies: Enemy[]): Enemy | null {
  if (enemies.length === 0) return null
  let nearest = enemies[0]; let nearestDist = getDistance(position, nearest.position)
  for (let i = 1; i < enemies.length; i++) {
    const dist = getDistance(position, enemies[i].position)
    if (dist < nearestDist) { nearest = enemies[i]; nearestDist = dist }
  }
  return nearest
}
