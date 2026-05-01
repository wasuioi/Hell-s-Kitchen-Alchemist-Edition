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
