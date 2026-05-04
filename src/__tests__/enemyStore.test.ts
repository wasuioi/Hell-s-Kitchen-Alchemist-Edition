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

  it('tanky spawns with tanky_idle ai state', () => {
    useEnemyStore.getState().spawnEnemy('tanky', { x: 0, z: 0 })
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.ai).toEqual({ kind: 'tanky_idle' })
  })

  it('non-tanky spawns with chase ai state', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('fast', { x: 1, z: 0 })
    useEnemyStore.getState().spawnEnemy('exploder', { x: 2, z: 0 })
    useEnemyStore.getState().spawnEnemy('boss', { x: 3, z: 0 })
    for (const enemy of useEnemyStore.getState().enemies) {
      expect(enemy.ai).toEqual({ kind: 'chase' })
    }
  })

  it('setEnemyAi transitions through tanky charge cycle', () => {
    useEnemyStore.getState().spawnEnemy('tanky', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    const get = () => useEnemyStore.getState().enemies[0].ai

    useEnemyStore.getState().setEnemyAi(id, { kind: 'tanky_telegraph', until: 1000 })
    expect(get()).toEqual({ kind: 'tanky_telegraph', until: 1000 })

    useEnemyStore.getState().setEnemyAi(id, {
      kind: 'tanky_charge', until: 2000, vx: 9, vz: 0,
    })
    expect(get()).toEqual({ kind: 'tanky_charge', until: 2000, vx: 9, vz: 0 })

    useEnemyStore.getState().setEnemyAi(id, { kind: 'tanky_idle' })
    expect(get()).toEqual({ kind: 'tanky_idle' })
  })
})

describe('sear flags', () => {
  beforeEach(() => { useEnemyStore.getState().reset() })

  it('spawned enemy has seared=false and searedDamageMult=1', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.seared).toBe(false)
    expect(enemy.searedDamageMult).toBe(1)
  })

  it('markSeared sets seared=true and searedDamageMult', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().markSeared(id, 1.15)
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.seared).toBe(true)
    expect(enemy.searedDamageMult).toBe(1.15)
  })

  it('resetSearedFlags resets seared and searedDamageMult on all enemies', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('fast', { x: 2, z: 0 })
    const ids = useEnemyStore.getState().enemies.map((e) => e.id)
    useEnemyStore.getState().markSeared(ids[0], 1.15)
    useEnemyStore.getState().markSeared(ids[1], 1)
    useEnemyStore.getState().resetSearedFlags()
    for (const enemy of useEnemyStore.getState().enemies) {
      expect(enemy.seared).toBe(false)
      expect(enemy.searedDamageMult).toBe(1)
    }
  })
})

describe('damageEnemiesInRadius', () => {
  beforeEach(() => { useEnemyStore.getState().reset() })

  it('damages enemies within radius', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 3, z: 0 })
    useEnemyStore.getState().damageEnemiesInRadius({ x: 0, z: 0 }, 4, 10)
    const enemies = useEnemyStore.getState().enemies
    expect(enemies[0].hp).toBe(20)
    expect(enemies[1].hp).toBe(20)
  })

  it('does not damage enemies outside radius', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 10, z: 0 })
    useEnemyStore.getState().damageEnemiesInRadius({ x: 0, z: 0 }, 4, 10)
    const enemies = useEnemyStore.getState().enemies
    expect(enemies[0].hp).toBe(20)
    expect(enemies[1].hp).toBe(30)
  })

  it('does not reduce hp below 0', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().damageEnemiesInRadius({ x: 0, z: 0 }, 4, 999)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(0)
  })
})

describe('applyStatusInRadius', () => {
  beforeEach(() => { useEnemyStore.getState().reset() })

  it('applies soaked status to enemies within radius (sets soakedUntil)', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().applyStatusInRadius({ x: 0, z: 0 }, 4, 'soaked', 2)
    expect(useEnemyStore.getState().enemies[0].soakedUntil).toBeGreaterThan(performance.now())
  })

  it('does not apply status to enemies outside radius', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 10, z: 0 })
    useEnemyStore.getState().applyStatusInRadius({ x: 0, z: 0 }, 4, 'soaked', 2)
    expect(useEnemyStore.getState().enemies[0].soakedUntil).toBe(0)
  })

  it('applies stunned to enemies (sets stunnedUntil with requested duration)', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const before = performance.now()
    useEnemyStore.getState().applyStatusInRadius({ x: 0, z: 0 }, 4, 'stunned', 1)
    const after = performance.now()
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.stunnedUntil).toBeGreaterThanOrEqual(before + 1000)
    expect(enemy.stunnedUntil).toBeLessThanOrEqual(after + 1000)
  })

  it('applies burning to enemies (sets burningUntil with requested duration)', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const before = performance.now()
    useEnemyStore.getState().applyStatusInRadius({ x: 0, z: 0 }, 4, 'burning', 2)
    const after = performance.now()
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.burningUntil).toBeGreaterThanOrEqual(before + 2000)
    expect(enemy.burningUntil).toBeLessThanOrEqual(after + 2000)
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
