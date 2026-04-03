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
  const enemies = [
    { id: 'a', position: { x: 10, z: 0 }, hp: 10, maxHp: 10, type: 'slow' as const, status: 'normal' as const },
    { id: 'b', position: { x: 2, z: 0 }, hp: 10, maxHp: 10, type: 'slow' as const, status: 'normal' as const },
    { id: 'c', position: { x: 5, z: 0 }, hp: 10, maxHp: 10, type: 'slow' as const, status: 'normal' as const },
  ]
  it('returns the nearest enemy', () => { expect(findNearestEnemy({ x: 0, z: 0 }, enemies)?.id).toBe('b') })
  it('returns null for empty array', () => { expect(findNearestEnemy({ x: 0, z: 0 }, [])).toBeNull() })
})
