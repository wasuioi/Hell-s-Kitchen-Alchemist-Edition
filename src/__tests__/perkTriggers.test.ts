import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { triggerOnDamageTaken, resetGreaseFireCooldown, triggerSweetSpot, resetSweetSpotMisses } from '../utils/perkTriggers'
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
  resetSweetSpotMisses()
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

describe('triggerSweetSpot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not apply bonus damage when roll fails at T1 (20% threshold)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.20) // exactly at threshold → fails
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 }) // 30 hp
    const id = useEnemyStore.getState().enemies[0].id
    triggerSweetSpot(id, 20, CENTER, 1)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('applies correct bonus damage when roll succeeds at T1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.19) // below 20% threshold → succeeds
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 }) // 30 hp
    const id = useEnemyStore.getState().enemies[0].id
    triggerSweetSpot(id, 20, CENTER, 1)
    // bonus = 20 * (2.0 - 1) = 20 → hp = 30 - 20 = 10
    expect(useEnemyStore.getState().enemies[0].hp).toBe(10)
  })

  it('applies larger bonus at T2 (×2.25)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    useEnemyStore.getState().spawnEnemy('tanky', { x: 0, z: 0 }) // 90 hp
    const id = useEnemyStore.getState().enemies[0].id
    triggerSweetSpot(id, 20, CENTER, 2)
    // bonus = 20 * (2.25 - 1) = 25 → hp = 90 - 25 = 65
    expect(useEnemyStore.getState().enemies[0].hp).toBe(65)
  })

  it('does not apply stun at T1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    triggerSweetSpot(id, 10, CENTER, 1)
    expect(useEnemyStore.getState().enemies[0].stunnedUntil).toBe(0)
  })

  it('applies stun at T2 on successful proc', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    triggerSweetSpot(id, 10, CENTER, 2)
    expect(useEnemyStore.getState().enemies[0].stunnedUntil).toBeGreaterThan(performance.now())
  })

  it('skips a dying enemy', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id = useEnemyStore.getState().enemies[0].id
    useEnemyStore.getState().setEnemyDying(id)
    triggerSweetSpot(id, 20, CENTER, 1)
    // dying flag means trigger bails out — hp unchanged
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('T3 pity timer guarantees crit after 2 consecutive misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // always fails the roll
    // Miss 1
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id1 = useEnemyStore.getState().enemies[0].id
    triggerSweetSpot(id1, 20, { x: -5, z: 0 }, 3)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30) // no bonus
    // Miss 2
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    const id2 = useEnemyStore.getState().enemies[1].id
    triggerSweetSpot(id2, 20, { x: -5, z: 0 }, 3)
    expect(useEnemyStore.getState().enemies[1].hp).toBe(30) // no bonus
    // Third call — guaranteed despite roll = 0.99
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    const id3 = useEnemyStore.getState().enemies[2].id
    triggerSweetSpot(id3, 20, { x: -5, z: 0 }, 3)
    // bonus = 20 * (2.5 - 1) = 30 → hp = 30 - 30 = 0
    expect(useEnemyStore.getState().enemies[2].hp).toBe(0)
  })

  it('T3 pity counter resets after a successful crit', () => {
    let call = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      call++
      return call === 1 ? 0.0 : 0.99 // first call hits, subsequent miss
    })
    // Successful crit on first call → counter resets to 0
    useEnemyStore.getState().spawnEnemy('slow', { x: 0, z: 0 })
    const id1 = useEnemyStore.getState().enemies[0].id
    triggerSweetSpot(id1, 20, { x: -5, z: 0 }, 3)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(0) // crit connected

    // Now 1 miss — counter is 1, not yet guaranteed
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    const id2 = useEnemyStore.getState().enemies[1].id
    triggerSweetSpot(id2, 20, { x: -5, z: 0 }, 3)
    expect(useEnemyStore.getState().enemies[1].hp).toBe(30) // miss, counter = 1
  })
})
