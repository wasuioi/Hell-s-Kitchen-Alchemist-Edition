import { describe, it, expect, beforeEach } from 'vitest'
import { triggerOnDamageTaken, resetGreaseFireCooldown, triggerIcedTowel, resetIcedTowelCooldown } from '../utils/perkTriggers'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'

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

function addIcedTowel(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'iced_towel', name: 'Iced Towel', icon: '/icons/iced_towel.png', description: '', stackCount: 1 })
  }
}

describe('triggerIcedTowel', () => {
  beforeEach(() => {
    useEnemyStore.getState().reset()
    useDeckStore.getState().reset()
    usePlayerStore.getState().reset()
    resetIcedTowelCooldown()
  })

  it('does nothing when iced_towel perk is not active', () => {
    const now = performance.now()
    triggerIcedTowel(now)
    expect(usePlayerStore.getState().chilledUntil).toBe(0)
  })

  it('applies chilled buff at tier 1', () => {
    addIcedTowel(1)
    const now = performance.now()
    triggerIcedTowel(now)
    const s = usePlayerStore.getState()
    // T1: 25% reduction → chilledMult = 0.25, duration 3s
    expect(s.chilledMult).toBeCloseTo(0.25)
    expect(s.chilledUntil).toBeGreaterThan(now + 2900)
    expect(s.chilledUntil).toBeLessThan(now + 3100)
  })

  it('respects the internal cooldown', () => {
    addIcedTowel(1)
    const now = performance.now()
    triggerIcedTowel(now)
    const firstUntil = usePlayerStore.getState().chilledUntil
    // reset chilled to check that second call is blocked
    usePlayerStore.setState({ chilledUntil: 0, chilledMult: 0 })
    triggerIcedTowel(now + 1000)
    expect(usePlayerStore.getState().chilledUntil).toBe(0)
    // original call should have set icedTowelReadyAt = now + 15000
    expect(firstUntil).toBeGreaterThan(now)
  })

  it('applies 35% reduction at tier 2', () => {
    addIcedTowel(2)
    const now = performance.now()
    triggerIcedTowel(now)
    expect(usePlayerStore.getState().chilledMult).toBeCloseTo(0.35)
  })

  it('soaks enemies in radius at tier 2', () => {
    addIcedTowel(2)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 3, z: 0 }) // within T2 radius of 4
    const now = performance.now()
    triggerIcedTowel(now)
    expect(useEnemyStore.getState().enemies[0].soakedUntil).toBeGreaterThan(now)
  })

  it('does not soak enemies outside radius at tier 2', () => {
    addIcedTowel(2)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 5, z: 0 }) // outside T2 radius of 4
    const now = performance.now()
    triggerIcedTowel(now)
    expect(useEnemyStore.getState().enemies[0].soakedUntil).toBe(0)
  })

  it('deals 12 damage and stuns enemies at tier 3', () => {
    addIcedTowel(3)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 }) // within T3 radius of 5
    const now = performance.now()
    triggerIcedTowel(now)
    const enemy = useEnemyStore.getState().enemies[0]
    expect(enemy.hp).toBe(18) // 30 - 12
    expect(enemy.stunnedUntil).toBeGreaterThan(now)
    expect(enemy.soakedUntil).toBeGreaterThan(now)
  })

  it('applies 50% reduction at tier 3', () => {
    addIcedTowel(3)
    const now = performance.now()
    triggerIcedTowel(now)
    expect(usePlayerStore.getState().chilledMult).toBeCloseTo(0.50)
  })
})
