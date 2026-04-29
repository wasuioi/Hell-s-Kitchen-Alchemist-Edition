import { describe, it, expect } from 'vitest'
import { isInRange, getDistance, findNearestEnemy } from '../utils/collision'

describe('getDistance', () => {
  it('returns 0 for same position', () => { expect(getDistance({ x: 0, z: 0 }, { x: 0, z: 0 })).toBe(0) })
  it('returns correct distance', () => { expect(getDistance({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5) })
})
describe('isInRange', () => {
  it('returns true when within radius', () => { expect(isInRange({ x: 0, z: 0 }, { x: 1, z: 1 }, 2)).toBe(true) })
  it('returns false when outside radius', () => { expect(isInRange({ x: 0, z: 0 }, { x: 5, z: 5 }, 2)).toBe(false) })
  it('returns true when exactly at radius', () => { expect(isInRange({ x: 0, z: 0 }, { x: 3, z: 4 }, 5)).toBe(true) })
})
describe('findNearestEnemy', () => {
  const base = { hp: 10, maxHp: 10, type: 'slow' as const, soakedUntil: 0, frozenUntil: 0, burningUntil: 0, poisonedUntil: 0, slowedUntil: 0, knockback: null, hitFlashUntil: 0, dying: false, detonating: false }
  const enemies = [
    { id: 'a', position: { x: 10, z: 0 }, ...base },
    { id: 'b', position: { x: 2, z: 0 }, ...base },
    { id: 'c', position: { x: 5, z: 0 }, ...base },
  ]
  it('returns the nearest enemy', () => { expect(findNearestEnemy({ x: 0, z: 0 }, enemies)?.id).toBe('b') })
  it('returns null for empty array', () => { expect(findNearestEnemy({ x: 0, z: 0 }, [])).toBeNull() })
  it('respects maxRange and returns the nearest within it', () => {
    expect(findNearestEnemy({ x: 0, z: 0 }, enemies, 6)?.id).toBe('b')
  })
  it('returns null when no enemy is within maxRange', () => {
    expect(findNearestEnemy({ x: 0, z: 0 }, enemies, 1)).toBeNull()
  })
  it('includes enemies at exactly maxRange', () => {
    expect(findNearestEnemy({ x: 0, z: 0 }, enemies, 2)?.id).toBe('b')
  })
})
