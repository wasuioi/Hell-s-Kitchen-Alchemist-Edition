import { describe, it, expect, beforeEach } from 'vitest'
import { triggerOnDamageTaken, resetGreaseFireCooldown, triggerOnKnockbackCollision } from '../utils/perkTriggers'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'

const CENTER = { x: 0, z: 0 }

function addGreaseFire(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'grease_fire', name: 'Grease Fire', icon: '🔥', description: '', stackCount: 1 })
  }
}

function addRollingPin(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'rolling_pin', name: 'Rolling Pin', icon: '/icons/rolling_pin.png', description: '', stackCount: 1 })
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

describe('triggerOnKnockbackCollision', () => {
  it('does nothing when rolling_pin perk is not active', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 5, z: 5 }) // roller
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 }) // victim within 1.2 of origin
    const roller = useEnemyStore.getState().enemies[0]
    const victimId = useEnemyStore.getState().enemies[1].id
    useEnemyStore.getState().setEnemyKnockback(roller.id, { vx: 10, vz: 0 })
    const rollerWithKb = useEnemyStore.getState().enemies.find((e) => e.id === roller.id)!
    triggerOnKnockbackCollision(rollerWithKb, CENTER)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === victimId)!.hp).toBe(30)
  })

  it('hits each victim only once per knockback arc (alreadyStruck)', () => {
    addRollingPin(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 5, z: 5 }) // roller
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 }) // victim (30 hp)
    const roller = useEnemyStore.getState().enemies[0]
    const victimId = useEnemyStore.getState().enemies[1].id
    useEnemyStore.getState().setEnemyKnockback(roller.id, { vx: 10, vz: 0 })
    const rollerWithKb = useEnemyStore.getState().enemies.find((e) => e.id === roller.id)!
    triggerOnKnockbackCollision(rollerWithKb, CENTER)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === victimId)!.hp).toBe(18) // 30 - 12
    // Second call with same roller — victim already in alreadyStruck, no additional damage
    triggerOnKnockbackCollision(rollerWithKb, CENTER)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === victimId)!.hp).toBe(18)
  })

  it('applies stun at tier 2', () => {
    addRollingPin(2)
    useEnemyStore.getState().spawnEnemy('slow', { x: 5, z: 5 }) // roller
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 }) // victim
    const roller = useEnemyStore.getState().enemies[0]
    const victimId = useEnemyStore.getState().enemies[1].id
    useEnemyStore.getState().setEnemyKnockback(roller.id, { vx: 10, vz: 0 })
    const rollerWithKb = useEnemyStore.getState().enemies.find((e) => e.id === roller.id)!
    triggerOnKnockbackCollision(rollerWithKb, CENTER)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === victimId)!.stunnedUntil).toBeGreaterThan(performance.now())
  })

  it('chains knockback to first surviving victim at tier 3 (fires once)', () => {
    addRollingPin(3)
    useEnemyStore.getState().spawnEnemy('tanky', { x: 5, z: 5 }) // roller
    useEnemyStore.getState().spawnEnemy('tanky', { x: 1, z: 0 }) // victim (90 hp, survives 26 dmg)
    const roller = useEnemyStore.getState().enemies[0]
    const victimId = useEnemyStore.getState().enemies[1].id
    useEnemyStore.getState().setEnemyKnockback(roller.id, { vx: 10, vz: 0 })
    const rollerWithKb = useEnemyStore.getState().enemies.find((e) => e.id === roller.id)!
    triggerOnKnockbackCollision(rollerWithKb, CENTER)
    const victim = useEnemyStore.getState().enemies.find((e) => e.id === victimId)!
    expect(victim.knockback).not.toBeNull()
    expect(victim.knockback!.chained).toBe(true)
    expect(victim.knockback!.vx).toBeCloseTo(6) // 10 * 0.6
    // kb.chained is now true — a second call with a new victim would not chain again
    expect(rollerWithKb.knockback!.chained).toBe(true)
  })

  it('marks struck enemy as dying when it reaches 0 HP', () => {
    addRollingPin(1) // T1: 12 damage
    useEnemyStore.getState().spawnEnemy('slow', { x: 5, z: 5 }) // roller
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 }) // victim (30 hp)
    const roller = useEnemyStore.getState().enemies[0]
    const victimId = useEnemyStore.getState().enemies[1].id
    // Pre-damage victim to 10 hp so T1 (12 dmg) kills it
    useEnemyStore.getState().damageEnemy(victimId, 20)
    useEnemyStore.getState().setEnemyKnockback(roller.id, { vx: 10, vz: 0 })
    const rollerWithKb = useEnemyStore.getState().enemies.find((e) => e.id === roller.id)!
    triggerOnKnockbackCollision(rollerWithKb, CENTER)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === victimId)!.dying).toBe(true)
  })
})
