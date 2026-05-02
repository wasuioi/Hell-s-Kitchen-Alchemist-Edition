import { describe, it, expect, beforeEach } from 'vitest'
import { triggerOnDamageTaken, resetGreaseFireCooldown, triggerJulienneChain } from '../utils/perkTriggers'
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

function addJulienne(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'julienne', name: 'Julienne', icon: '', description: '', stackCount: 1 })
  }
}

describe('triggerJulienneChain', () => {
  it('does nothing when origin enemy id does not exist', () => {
    triggerJulienneChain('nonexistent', 20, 1)
    expect(useEnemyStore.getState().enemies).toHaveLength(0)
  })

  it('T1: chains to 1 nearby enemy at 50% damage', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    const [origin, target] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 1)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === target.id)?.hp).toBe(20) // 30 - 10
  })

  it('T1: does not chain to enemy beyond 2.5 unit range', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 3, z: 0 })
    const [origin, target] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 1)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === target.id)?.hp).toBe(30)
  })

  it('T1: does not chain to the origin enemy itself', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const [origin] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 1)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === origin.id)?.hp).toBe(30)
  })

  it('T1: only chains to 1 enemy even when multiple are in range', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: -1, z: 0 })
    const [origin] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 1)
    const damaged = useEnemyStore.getState().enemies.filter((e) => e.id !== origin.id && e.hp < 30)
    expect(damaged).toHaveLength(1)
  })

  it('T2: chains to 2 enemies at 70% damage and stuns them', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: -2, z: 0 })
    const [origin, t1, t2] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 2) // 70% of 20 = 14
    const after = useEnemyStore.getState().enemies
    expect(after.find((e) => e.id === t1.id)?.hp).toBe(16)
    expect(after.find((e) => e.id === t2.id)?.hp).toBe(16)
    expect(after.find((e) => e.id === t1.id)?.stunnedUntil).toBeGreaterThan(performance.now())
    expect(after.find((e) => e.id === t2.id)?.stunnedUntil).toBeGreaterThan(performance.now())
  })

  it('T2: does not soak chained enemies', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    const [origin, target] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 2)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === target.id)?.soakedUntil).toBe(0)
  })

  it('T3: chains to 3 enemies at 100% damage with stun and soak', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: -1, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 1.5 })
    const [origin, t1, t2, t3] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 3) // 100% of 20 = 20
    const after = useEnemyStore.getState().enemies
    expect(after.find((e) => e.id === t1.id)?.hp).toBe(10)
    expect(after.find((e) => e.id === t2.id)?.hp).toBe(10)
    expect(after.find((e) => e.id === t3.id)?.hp).toBe(10)
    expect(after.find((e) => e.id === t1.id)?.stunnedUntil).toBeGreaterThan(performance.now())
    expect(after.find((e) => e.id === t1.id)?.soakedUntil).toBeGreaterThan(performance.now())
  })

  it('T3: expands range to 3.5 units', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 3.4, z: 0 }) // within T3 range but outside T1
    const [origin, target] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 20, 3)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === target.id)?.hp).toBe(10)
  })

  it('does not chain to dying enemies', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    const [origin, target] = useEnemyStore.getState().enemies
    useEnemyStore.getState().setEnemyDying(target.id)
    triggerJulienneChain(origin.id, 20, 1)
    expect(useEnemyStore.getState().enemies.find((e) => e.id === target.id)?.hp).toBe(30)
  })

  it('marks a chained enemy as dying when chain reduces hp to 0', () => {
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 }) // 30 hp
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    const [origin, target] = useEnemyStore.getState().enemies
    triggerJulienneChain(origin.id, 60, 1) // 50% of 60 = 30 — kills the target
    expect(useEnemyStore.getState().enemies.find((e) => e.id === target.id)?.dying).toBe(true)
  })
})
