import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePickupStore, HEART_DROP_CHANCE } from '../stores/pickupStore'

describe('pickupStore', () => {
  beforeEach(() => { usePickupStore.getState().reset() })

  it('starts empty', () => {
    expect(usePickupStore.getState().hearts).toEqual([])
  })

  it('spawn adds a heart at the given position', () => {
    usePickupStore.getState().spawn({ x: 5, z: 3 })
    const hearts = usePickupStore.getState().hearts
    expect(hearts).toHaveLength(1)
    expect(hearts[0].position).toEqual({ x: 5, z: 3 })
    expect(hearts[0].id).toBeTruthy()
  })

  it('spawn twice adds two hearts with distinct ids', () => {
    usePickupStore.getState().spawn({ x: 0, z: 0 })
    usePickupStore.getState().spawn({ x: 1, z: 1 })
    const hearts = usePickupStore.getState().hearts
    expect(hearts).toHaveLength(2)
    expect(hearts[0].id).not.toBe(hearts[1].id)
  })

  it('remove deletes the heart with the given id', () => {
    usePickupStore.getState().spawn({ x: 0, z: 0 })
    const id = usePickupStore.getState().hearts[0].id
    usePickupStore.getState().remove(id)
    expect(usePickupStore.getState().hearts).toEqual([])
  })

  it('reset clears all hearts', () => {
    usePickupStore.getState().spawn({ x: 0, z: 0 })
    usePickupStore.getState().spawn({ x: 1, z: 1 })
    usePickupStore.getState().reset()
    expect(usePickupStore.getState().hearts).toEqual([])
  })

  it('exports HEART_DROP_CHANCE = 0.08', () => {
    expect(HEART_DROP_CHANCE).toBe(0.08)
  })
})

import { useEnemyStore } from '../stores/enemyStore'

describe('enemyStore heart drop on death', () => {
  beforeEach(() => {
    useEnemyStore.getState().reset()
    usePickupStore.getState().reset()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('spawns a heart at enemy position when roll < 0.08', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05)
    useEnemyStore.getState().spawnEnemy('slow', { x: 5, z: 3 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    const hearts = usePickupStore.getState().hearts
    expect(hearts).toHaveLength(1)
    expect(hearts[0].position).toEqual({ x: 5, z: 3 })
  })

  it('does NOT spawn a heart when roll >= 0.08', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    expect(usePickupStore.getState().hearts).toHaveLength(0)
  })

  it('does NOT spawn a heart when boss dies, even on lucky roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    expect(usePickupStore.getState().hearts).toHaveLength(0)
  })

  it('still marks the enemy as dying regardless of drop outcome', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    expect(useEnemyStore.getState().enemies[0].dying).toBe(true)
  })
})
