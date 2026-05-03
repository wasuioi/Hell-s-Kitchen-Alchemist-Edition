import { describe, it, expect, beforeEach } from 'vitest'
import { triggerOnDamageTaken, resetGreaseFireCooldown, triggerPanFlip } from '../utils/perkTriggers'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'

const CENTER = { x: 0, z: 0 }

function addGreaseFire(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'grease_fire', name: 'Grease Fire', icon: '🔥', description: '', stackCount: 1 })
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

function addPanFlip(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'pan_flip', name: 'Pan Flip', icon: '', description: '', stackCount: 1 })
  }
}

describe('triggerPanFlip', () => {
  beforeEach(() => {
    useEnemyStore.getState().reset()
    useDeckStore.getState().reset()
  })

  it('does nothing when pan_flip perk is not active', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    triggerPanFlip(0, 0)
    expect(useEnemyStore.getState().enemies[0].airborne).toBeFalsy()
  })

  it('sets airborne on slow enemy within radius at tier 1', () => {
    addPanFlip(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerPanFlip(0, 0)
    expect(useEnemyStore.getState().enemies[0].airborne).toBe(true)
    expect(useEnemyStore.getState().enemies[0].airborneUntil).toBeGreaterThan(performance.now())
  })

  it('sets airborne on fast enemy within radius', () => {
    addPanFlip(1)
    useEnemyStore.getState().spawnEnemy('fast', { x: 2, z: 0 })
    triggerPanFlip(0, 0)
    expect(useEnemyStore.getState().enemies[0].airborne).toBe(true)
  })

  it('does not set airborne on enemy outside radius', () => {
    addPanFlip(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 4, z: 0 })
    triggerPanFlip(0, 0)
    expect(useEnemyStore.getState().enemies[0].airborne).toBeFalsy()
  })

  it('slows tanky enemy instead of lifting (tier 1: 30% slow)', () => {
    addPanFlip(1)
    useEnemyStore.getState().spawnEnemy('tanky', { x: 1, z: 0 })
    const before = performance.now()
    triggerPanFlip(0, 0)
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.airborne).toBeFalsy()
    expect(enemy.slowedUntil).toBeGreaterThan(before)
    expect(enemy.slowFactor).toBe(0.7)
  })

  it('slows boss at 0.85x speed', () => {
    addPanFlip(1)
    useEnemyStore.getState().spawnEnemy('boss', { x: 1, z: 0 })
    triggerPanFlip(0, 0)
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.airborne).toBeFalsy()
    expect(enemy.slowFactor).toBe(0.85)
  })

  it('tier 3 sets t3 splash flag on lifted enemies', () => {
    addPanFlip(3)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerPanFlip(0, 0)
    expect(useEnemyStore.getState().enemies[0].airborneSplash).toBe(true)
  })

  it('tier 1 does not set t3 splash flag', () => {
    addPanFlip(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    triggerPanFlip(0, 0)
    expect(useEnemyStore.getState().enemies[0].airborneSplash).toBe(false)
  })

  it('setEnemyAirborne stores correct landing stun duration', () => {
    addPanFlip(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    triggerPanFlip(0, 0)
    expect(useEnemyStore.getState().enemies[0].airborneStunS).toBe(0.3)
  })

  it('clearEnemyAirborne clears all airborne fields', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyAirborne(id, 0.5, 0.3, false)
    expect(useEnemyStore.getState().enemies[0].airborne).toBe(true)
    useEnemyStore.getState().clearEnemyAirborne(id)
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.airborne).toBe(false)
    expect(enemy.airborneUntil).toBe(0)
  })

  it('setEnemySlow sets slowedUntil and slowFactor', () => {
    useEnemyStore.getState().spawnEnemy('tanky', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    const before = performance.now()
    useEnemyStore.getState().setEnemySlow(id, 0.7, 1.0)
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.slowFactor).toBe(0.7)
    expect(enemy.slowedUntil).toBeGreaterThanOrEqual(before + 1000)
  })
})
