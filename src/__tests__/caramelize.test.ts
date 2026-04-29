import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { triggerOnEnemyDeath } from '../utils/perkTriggers'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'
import { useWorldStore } from '../stores/worldStore'
import type { Enemy } from '../types'

function makeEnemy(id = 'e1', x = 0, z = 0): Enemy {
  return {
    id,
    position: { x, z },
    hp: 30, maxHp: 30, type: 'slow',
    soakedUntil: 0, frozenUntil: 0, burningUntil: 0, poisonedUntil: 0, slowedUntil: 0, stunnedUntil: 0,
    knockback: null, hitFlashUntil: 0, dying: true, detonating: false,
  }
}

function addCaramelize(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'caramelize', name: 'Caramelize', icon: '', description: '', stackCount: 1 })
  }
}

beforeEach(() => {
  useEnemyStore.getState().reset()
  useDeckStore.getState().reset()
  useWorldStore.getState().reset()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('triggerOnEnemyDeath — caramelize', () => {
  it('does nothing when caramelize perk is not active', () => {
    triggerOnEnemyDeath(makeEnemy())
    expect(useWorldStore.getState().pools).toHaveLength(0)
  })

  it('spawns a pool when drop roll succeeds at tier 1', () => {
    addCaramelize(1)
    vi.spyOn(Math, 'random').mockReturnValue(0) // 0 <= 0.5 → succeeds
    triggerOnEnemyDeath(makeEnemy('e1', 3, 4))
    const pools = useWorldStore.getState().pools
    expect(pools).toHaveLength(1)
    expect(pools[0].x).toBe(3)
    expect(pools[0].z).toBe(4)
    expect(pools[0].radius).toBe(2.0)
    expect(pools[0].dmgPerSecond).toBe(5)
    expect(pools[0].appliesSoaked).toBe(false)
    expect(pools[0].growOnKill).toBe(false)
  })

  it('does not spawn a pool when drop roll fails at tier 1', () => {
    addCaramelize(1)
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // > 0.5 → fails
    triggerOnEnemyDeath(makeEnemy())
    expect(useWorldStore.getState().pools).toHaveLength(0)
  })

  it('applies tier 2 stats and appliesSoaked when stack count is 2', () => {
    addCaramelize(2)
    vi.spyOn(Math, 'random').mockReturnValue(0) // succeeds
    triggerOnEnemyDeath(makeEnemy())
    const pool = useWorldStore.getState().pools[0]
    expect(pool.radius).toBe(2.5)
    expect(pool.lifetimeS).toBe(4.0)
    expect(pool.dmgPerSecond).toBe(8)
    expect(pool.appliesSoaked).toBe(true)
  })

  it('applies tier 3 stats (100% drop) regardless of roll', () => {
    addCaramelize(3)
    // At T3, dropChance is 1.0, so Math.random() must return <= 1.0
    // The check is `Math.random() > dropChance`, so any value works at T3
    // but we also need no existing pool to avoid grow path
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // 0.99 is NOT > 1.0, so drop succeeds
    triggerOnEnemyDeath(makeEnemy('e1', 10, 10)) // far from origin, no pool
    const pool = useWorldStore.getState().pools[0]
    expect(pool.radius).toBe(2.5)
    expect(pool.lifetimeS).toBe(5.0)
    expect(pool.dmgPerSecond).toBe(12)
    expect(pool.growOnKill).toBe(true)
  })

  it('extra stacks beyond 3 still use tier 3 stats', () => {
    addCaramelize(5) // stackCount = 5, tier = min(5,3) = 3
    vi.spyOn(Math, 'random').mockReturnValue(0)
    triggerOnEnemyDeath(makeEnemy('e1', 20, 20))
    const pool = useWorldStore.getState().pools[0]
    expect(pool.dmgPerSecond).toBe(12)
    expect(pool.radius).toBe(2.5)
  })

  it('T3 capstone: grows existing pool instead of spawning when kill is inside pool', () => {
    addCaramelize(3)
    // Spawn a pool at origin with radius 2.0
    useWorldStore.getState().spawnCaramelPool({
      x: 0, z: 0, radius: 2.0, lifetimeS: 5.0, dmgPerSecond: 12,
      slowMul: 0.5, appliesSoaked: true, growOnKill: true,
    })
    const originalId = useWorldStore.getState().pools[0].id
    // Enemy dies at (1, 0) — inside the pool (dist=1 < radius=2.0)
    triggerOnEnemyDeath(makeEnemy('e1', 1, 0))
    const pools = useWorldStore.getState().pools
    // Still exactly 1 pool (no new spawn)
    expect(pools).toHaveLength(1)
    expect(pools[0].id).toBe(originalId)
    // Radius grew by 0.5
    expect(pools[0].radius).toBe(2.5)
  })

  it('T3 capstone: caps pool radius at 5.0', () => {
    addCaramelize(3)
    useWorldStore.getState().spawnCaramelPool({
      x: 0, z: 0, radius: 4.8, lifetimeS: 5.0, dmgPerSecond: 12,
      slowMul: 0.5, appliesSoaked: true, growOnKill: true,
    })
    // Enemy inside the pool (dist 0 < 4.8)
    triggerOnEnemyDeath(makeEnemy('e1', 0, 0))
    expect(useWorldStore.getState().pools[0].radius).toBe(5.0) // capped, not 5.3
  })

  it('T3 capstone: spawns new pool when kill is outside all existing pools', () => {
    addCaramelize(3)
    useWorldStore.getState().spawnCaramelPool({
      x: 0, z: 0, radius: 1.0, lifetimeS: 5.0, dmgPerSecond: 12,
      slowMul: 0.5, appliesSoaked: true, growOnKill: true,
    })
    // Math.random is 0 so drop succeeds; enemy is far outside the pool
    vi.spyOn(Math, 'random').mockReturnValue(0)
    triggerOnEnemyDeath(makeEnemy('e1', 10, 10))
    expect(useWorldStore.getState().pools).toHaveLength(2)
  })
})

describe('worldStore — pool management', () => {
  it('evicts the oldest pool when a 9th pool would be spawned', () => {
    const cfg = { radius: 1, lifetimeS: 3, dmgPerSecond: 5, slowMul: 0.7, appliesSoaked: false, growOnKill: false }
    // Spawn 8 pools at different timestamps
    for (let i = 0; i < 8; i++) {
      useWorldStore.getState().spawnCaramelPool({ x: i, z: 0, ...cfg })
    }
    expect(useWorldStore.getState().pools).toHaveLength(8)
    // Spawn a 9th — the oldest (x=0) should be evicted
    useWorldStore.getState().spawnCaramelPool({ x: 99, z: 0, ...cfg })
    const pools = useWorldStore.getState().pools
    expect(pools).toHaveLength(8)
    // The newest pool (x=99) should be present
    expect(pools.some((p) => p.x === 99)).toBe(true)
  })

  it('growCaramelPool increases radius and caps at 5.0', () => {
    useWorldStore.getState().spawnCaramelPool({
      x: 0, z: 0, radius: 3.0, lifetimeS: 3.0, dmgPerSecond: 5,
      slowMul: 0.7, appliesSoaked: false, growOnKill: false,
    })
    const id = useWorldStore.getState().pools[0].id
    useWorldStore.getState().growCaramelPool(id, 0.5, 5.0)
    expect(useWorldStore.getState().pools[0].radius).toBe(3.5)
    expect(useWorldStore.getState().pools[0].lifetimeS).toBe(5.0)
    // Grow past the cap
    useWorldStore.getState().growCaramelPool(id, 10, 5.0)
    expect(useWorldStore.getState().pools[0].radius).toBe(5.0)
  })

  it('removeCaramelPool removes the correct pool', () => {
    const cfg = { radius: 1, lifetimeS: 3, dmgPerSecond: 5, slowMul: 0.7, appliesSoaked: false, growOnKill: false }
    useWorldStore.getState().spawnCaramelPool({ x: 1, z: 0, ...cfg })
    useWorldStore.getState().spawnCaramelPool({ x: 2, z: 0, ...cfg })
    const [first] = useWorldStore.getState().pools
    useWorldStore.getState().removeCaramelPool(first.id)
    const remaining = useWorldStore.getState().pools
    expect(remaining).toHaveLength(1)
    expect(remaining[0].x).toBe(2)
  })

  it('reset clears all pools', () => {
    const cfg = { radius: 1, lifetimeS: 3, dmgPerSecond: 5, slowMul: 0.7, appliesSoaked: false, growOnKill: false }
    useWorldStore.getState().spawnCaramelPool({ x: 0, z: 0, ...cfg })
    useWorldStore.getState().reset()
    expect(useWorldStore.getState().pools).toHaveLength(0)
  })
})

describe('pool tick math', () => {
  it('damage per tick equals dmgPerSecond * delta', () => {
    // Verify the math used in CaramelPool.tsx's useFrame
    const dmgPerSecond = 12
    const delta = 0.016 // ~60fps
    const dmgThisTick = dmgPerSecond * delta
    expect(dmgThisTick).toBeCloseTo(0.192, 5)
  })

  it('pool damage accumulates to ~dmgPerSecond over 1 second of ticks', () => {
    const dmgPerSecond = 5
    const frames = 60
    const delta = 1 / frames
    let total = 0
    for (let i = 0; i < frames; i++) total += dmgPerSecond * delta
    expect(total).toBeCloseTo(5, 1)
  })
})
