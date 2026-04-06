import { describe, it, expect, beforeEach } from 'vitest'
import { useEnemyStore } from '../stores/enemyStore'

describe('enemyStore juice + exploder', () => {
  beforeEach(() => {
    useEnemyStore.getState().reset()
  })

  it('spawned enemy has juice fields defaulted', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 5 })
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.hitFlashUntil).toBe(0)
    expect(enemy.dying).toBe(false)
    expect(enemy.detonating).toBe(false)
  })

  it('spawns exploder with correct HP', () => {
    useEnemyStore.getState().spawnEnemy('exploder', { x: 3, z: 3 })
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.type).toBe('exploder')
    expect(enemy.hp).toBe(30) // 1x base HP
    expect(enemy.maxHp).toBe(30)
  })

  it('setEnemyHitFlash sets hitFlashUntil', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyHitFlash(id, performance.now() + 100)
    expect(useEnemyStore.getState().enemies[0].hitFlashUntil).toBeGreaterThan(0)
  })

  it('setEnemyDying marks enemy as dying', () => {
    useEnemyStore.getState().spawnEnemy('fast', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    expect(useEnemyStore.getState().enemies[0].dying).toBe(true)
  })

  it('setEnemyDetonating marks enemy as detonating', () => {
    useEnemyStore.getState().spawnEnemy('exploder', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDetonating(id)
    expect(useEnemyStore.getState().enemies[0].detonating).toBe(true)
  })
})

describe('useEnemyStore', () => {
  beforeEach(() => { useEnemyStore.getState().reset() })
  it('starts with no enemies', () => { expect(useEnemyStore.getState().enemies).toHaveLength(0) })
  it('spawnEnemy adds an enemy', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 10, z: 0 })
    expect(useEnemyStore.getState().enemies).toHaveLength(1)
    expect(useEnemyStore.getState().enemies[0].type).toBe('slow')
  })
  it('slow enemies have correct HP', () => { useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 }); expect(useEnemyStore.getState().enemies[0].hp).toBe(30) })
  it('fast enemies have correct HP', () => { useEnemyStore.getState().spawnEnemy('fast', { x: 0, z: 0 }); expect(useEnemyStore.getState().enemies[0].hp).toBe(30) })
  it('tanky enemies have 3x HP', () => { useEnemyStore.getState().spawnEnemy('tanky', { x: 0, z: 0 }); expect(useEnemyStore.getState().enemies[0].hp).toBe(90) })
  it('boss has 15x HP', () => { useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: 0 }); expect(useEnemyStore.getState().enemies[0].hp).toBe(450) })
  it('damageEnemy reduces enemy HP', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().damageEnemy(id, 10); expect(useEnemyStore.getState().enemies[0].hp).toBe(20)
  })
  it('damageEnemy does not go below 0', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().damageEnemy(useEnemyStore.getState().enemies[0].id, 999)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(0)
  })
  it('removeEnemy removes by id', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 }); useEnemyStore.getState().spawnEnemy('fast', { x: 5, z: 0 })
    useEnemyStore.getState().removeEnemy(useEnemyStore.getState().enemies[0].id)
    expect(useEnemyStore.getState().enemies).toHaveLength(1)
  })
  it('updateEnemyPosition moves an enemy', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 10, z: 0 })
    useEnemyStore.getState().updateEnemyPosition(useEnemyStore.getState().enemies[0].id, { x: 8, z: 1 })
    expect(useEnemyStore.getState().enemies[0].position).toEqual({ x: 8, z: 1 })
  })
  it('reset clears all enemies', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 }); useEnemyStore.getState().spawnEnemy('fast', { x: 5, z: 0 })
    useEnemyStore.getState().reset(); expect(useEnemyStore.getState().enemies).toHaveLength(0)
  })
})
