import { describe, it, expect, beforeEach } from 'vitest'
import { triggerOnDamageTaken, resetGreaseFireCooldown, triggerOnCook } from '../utils/perkTriggers'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'

const CENTER = { x: 0, z: 0 }

function addGreaseFire(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'grease_fire', name: 'Grease Fire', icon: '🔥', description: '', stackCount: 1 })
  }
}

function addWhiskStorm(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'whisk_storm', name: 'Whisk Storm', icon: '/icons/whisk_storm.png', description: '', stackCount: 1 })
  }
}

beforeEach(() => {
  useEnemyStore.getState().reset()
  useDeckStore.getState().reset()
  resetGreaseFireCooldown()
})

describe('triggerOnDamageTaken', () => {
  it('does nothing when grease_fire perk is not active', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    triggerOnDamageTaken(10, CENTER)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('damages enemies in radius at tier 1', () => {
    addGreaseFire(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerOnDamageTaken(10, CENTER)
    // tier 1: 15 damage, radius 2.5
    expect(useEnemyStore.getState().enemies[0].hp).toBe(15)
  })

  it('does not damage enemies outside tier 1 radius', () => {
    addGreaseFire(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 3, z: 0 })
    triggerOnDamageTaken(10, CENTER)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('respects the internal cooldown', () => {
    addGreaseFire(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    triggerOnDamageTaken(10, CENTER)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(15)
    // second hit immediately — should be blocked by cooldown
    triggerOnDamageTaken(10, CENTER)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(15)
  })

  it('does not apply soaked at tier 2 (no status applied)', () => {
    addGreaseFire(2)
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    triggerOnDamageTaken(10, CENTER)
    expect(useEnemyStore.getState().enemies[0].soakedUntil).toBe(0)
  })

  it('applies burning status at tier 3 (sets burningUntil)', () => {
    addGreaseFire(3)
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    triggerOnDamageTaken(10, CENTER)
    expect(useEnemyStore.getState().enemies[0].burningUntil).toBeGreaterThan(performance.now())
  })

  it('doubles burst damage at tier 3 on heavy hit (>=15)', () => {
    addGreaseFire(3)
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    // tier 3 base = 40, doubled = 80; enemy has 30 hp so will floor at 0
    triggerOnDamageTaken(15, CENTER)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(0)
  })

  it('does not double burst damage at tier 3 on light hit (<15)', () => {
    addGreaseFire(3)
    useEnemyStore.getState().spawnEnemy('tanky', { x: 1, z: 0 }) // 90 hp
    triggerOnDamageTaken(14, CENTER)
    // tier 3 base = 40, no double
    expect(useEnemyStore.getState().enemies[0].hp).toBe(50)
  })

  it('extra stacks beyond tier 3 add +8 damage each', () => {
    addGreaseFire(4)
    useEnemyStore.getState().spawnEnemy('tanky', { x: 1, z: 0 }) // 90 hp
    triggerOnDamageTaken(10, CENTER)
    // tier capped at 3, extra=1, baseDmg = 40 + 8 = 48
    expect(useEnemyStore.getState().enemies[0].hp).toBe(42)
  })
})

describe('triggerOnCook', () => {
  it('does nothing when whisk_storm perk is not active', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].knockback).toBeNull()
  })

  it('applies knockback at tier 1 to enemies in range', () => {
    addWhiskStorm(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].knockback).not.toBeNull()
  })

  it('does not apply knockback to enemies outside tier 1 range', () => {
    addWhiskStorm(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 4, z: 0 }) // > 3.0 range
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].knockback).toBeNull()
  })

  it('knocks enemy outward (vx positive for enemy east of player)', () => {
    addWhiskStorm(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerOnCook(CENTER)
    const kb = useEnemyStore.getState().enemies[0].knockback!
    expect(kb.vx).toBeGreaterThan(0)
    expect(kb.vz).toBeCloseTo(0)
  })

  it('no stun at tier 1', () => {
    addWhiskStorm(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].stunnedUntil).toBe(0)
  })

  it('applies stun at tier 2', () => {
    addWhiskStorm(2)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].stunnedUntil).toBeGreaterThan(performance.now())
  })

  it('no damage at tier 1', () => {
    addWhiskStorm(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('applies damage at tier 3', () => {
    addWhiskStorm(3)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(20) // 30 - 10
  })

  it('does not apply knockback to boss', () => {
    addWhiskStorm(1)
    useEnemyStore.getState().spawnEnemy('boss', { x: 2, z: 0 })
    triggerOnCook(CENTER)
    expect(useEnemyStore.getState().enemies[0].knockback).toBeNull()
  })
})
