import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../stores/playerStore'
import { useDeckStore } from '../stores/deckStore'
import { useEnemyStore } from '../stores/enemyStore'
import { castSpell } from '../utils/castSpell'
import { resetGreaseFireCooldown } from '../utils/perkTriggers'

function addApron(stacks = 1) {
  for (let i = 0; i < stacks; i++) {
    useDeckStore.getState().addPerk({ id: 'ashen_apron', name: 'Ashen Apron', icon: '/icons/ashen_apron.png', description: '', stackCount: 1 })
  }
}

// Build N charges by calling addAshCharge N times (each call increments by 1).
function giveCharges(n: number, max: number) {
  for (let i = 0; i < n; i++) usePlayerStore.getState().addAshCharge(max)
}

beforeEach(() => {
  usePlayerStore.getState().reset()
  useDeckStore.getState().reset()
  useEnemyStore.getState().reset()
  resetGreaseFireCooldown()
})

describe('AshenApron — charge building via castSpell', () => {
  it('increments ashCharges by 1 when perk is active', () => {
    addApron(1)
    castSpell('INFERNO')
    expect(usePlayerStore.getState().ashCharges).toBe(1)
  })

  it('caps charges at T1 max of 3', () => {
    addApron(1)
    for (let i = 0; i < 5; i++) castSpell('INFERNO')
    expect(usePlayerStore.getState().ashCharges).toBe(3)
  })

  it('caps charges at T2 max of 5', () => {
    addApron(2)
    for (let i = 0; i < 10; i++) castSpell('INFERNO')
    expect(usePlayerStore.getState().ashCharges).toBe(5)
  })

  it('caps charges at T3 max of 7', () => {
    addApron(3)
    for (let i = 0; i < 10; i++) castSpell('INFERNO')
    expect(usePlayerStore.getState().ashCharges).toBe(7)
  })

  it('does not build charges when perk is not active', () => {
    castSpell('INFERNO')
    expect(usePlayerStore.getState().ashCharges).toBe(0)
  })
})

describe('AshenApron — damage reduction via takeDamage', () => {
  it('consumes a charge and reduces damage by 50% at T1', () => {
    addApron(1)
    giveCharges(1, 3) // 1 charge
    usePlayerStore.getState().takeDamage(40)
    // 40 * (1 - 0.5) = 20 → HP 80
    expect(usePlayerStore.getState().hp).toBe(80)
    expect(usePlayerStore.getState().ashCharges).toBe(0)
  })

  it('applies full damage when no charges remain', () => {
    addApron(1)
    usePlayerStore.getState().takeDamage(40)
    expect(usePlayerStore.getState().hp).toBe(60)
    expect(usePlayerStore.getState().ashCharges).toBe(0)
  })

  it('reduces damage by 70% at T2', () => {
    addApron(2)
    giveCharges(5, 5) // 5 charges (T2 max)
    usePlayerStore.getState().takeDamage(40)
    // 40 * (1 - 0.7) = 12 → HP 88
    expect(usePlayerStore.getState().hp).toBe(88)
    expect(usePlayerStore.getState().ashCharges).toBe(4)
  })

  it('reduces damage by 90% at T3', () => {
    addApron(3)
    giveCharges(7, 7) // 7 charges (T3 max)
    usePlayerStore.getState().takeDamage(40)
    // 40 * (1 - 0.9) = 4 → HP 96
    expect(usePlayerStore.getState().hp).toBe(96)
    expect(usePlayerStore.getState().ashCharges).toBe(6)
  })

  it('only consumes one charge per hit', () => {
    addApron(1)
    giveCharges(3, 3) // 3 charges
    usePlayerStore.getState().takeDamage(20)
    expect(usePlayerStore.getState().ashCharges).toBe(2)
  })

  it('does not reduce damage when perk is not active', () => {
    giveCharges(3, 3) // charges with no perk
    usePlayerStore.getState().takeDamage(40)
    expect(usePlayerStore.getState().hp).toBe(60) // no reduction
  })
})

describe('AshenApron — T2+ ash burst via triggerOnDamageTaken', () => {
  it('T1 does not burst — enemy in radius takes no extra damage', () => {
    addApron(1)
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    giveCharges(1, 3)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    usePlayerStore.getState().takeDamage(10)
    // T1: charge absorbed, no burst
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('T2 burst damages enemies within 3u radius', () => {
    addApron(2)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 }) // 2u from player, within 3u
    giveCharges(1, 5)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    usePlayerStore.getState().takeDamage(20)
    // burst: 15 dmg → 30 - 15 = 15
    expect(useEnemyStore.getState().enemies[0].hp).toBe(15)
  })

  it('T2 burst does not damage enemies outside 3u radius', () => {
    addApron(2)
    useEnemyStore.getState().spawnEnemy('slow', { x: 4, z: 0 }) // 4u away, outside 3u radius
    giveCharges(1, 5)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    usePlayerStore.getState().takeDamage(20)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })

  it('T3 burst deals 25 damage within 5u radius', () => {
    addApron(3)
    useEnemyStore.getState().spawnEnemy('tanky', { x: 4, z: 0 }) // 4u from player, within 5u
    giveCharges(1, 7)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    usePlayerStore.getState().takeDamage(10)
    // burst: 25 dmg → 90 - 25 = 65
    expect(useEnemyStore.getState().enemies[0].hp).toBe(65)
  })

  it('T3 burst applies soaked for 1.5s to enemies hit', () => {
    addApron(3)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    giveCharges(1, 7)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    usePlayerStore.getState().takeDamage(10)
    expect(useEnemyStore.getState().enemies[0].soakedUntil).toBeGreaterThan(performance.now())
  })

  it('T2 burst does not apply soaked', () => {
    addApron(2)
    useEnemyStore.getState().spawnEnemy('slow', { x: 2, z: 0 })
    giveCharges(1, 5)
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    usePlayerStore.getState().takeDamage(10)
    expect(useEnemyStore.getState().enemies[0].soakedUntil).toBe(0)
  })

  it('burst does not fire when no charges were available', () => {
    addApron(2)
    useEnemyStore.getState().spawnEnemy('slow', { x: 1, z: 0 })
    // ashCharges = 0 → no absorption, no burst
    usePlayerStore.getState().setPosition({ x: 0, z: 0 })
    usePlayerStore.getState().takeDamage(10)
    expect(useEnemyStore.getState().enemies[0].hp).toBe(30)
  })
})
