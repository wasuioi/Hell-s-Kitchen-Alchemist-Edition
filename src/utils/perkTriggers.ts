import { useDeckStore } from '../stores/deckStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { usePlayerStore } from '../stores/playerStore'
import { PERK_POOL, MAX_PERK_TIER } from '../data/perks'
import { spawnExplosionVfx, spawnSpriteVfx, spawnDamageNumberVfx } from './spawnVfx'
import { isInRange } from './collision'
import type { Position } from '../types'

// Convention for future on-trigger perks: alongside the gameplay logic
// (damage, status, etc.), spawn visible feedback so the player actually
// sees the perk fire. The VFX spawn helpers are no-ops outside the 3D
// scene (e.g. in unit tests), so it's safe to call them from anywhere.
//
// Visual lookup pattern: if the perk has a `vfxSprite` slug it plays
// the sprite-sheet VFX (custom per-perk look); otherwise it falls back
// to the generic fireburst explosion. Per-enemy juice (hit flash, damage
// numbers, shake) mirrors what Spell.tsx does, so on-trigger perks read
// as "real" damage to the player.

let lastGreaseFireAt = -Infinity

export function triggerOnDamageTaken(amount: number, position: Position) {
  const stacks = useDeckStore.getState().activePerks.find((p) => p.id === 'grease_fire')?.stackCount ?? 0
  if (stacks === 0) return

  const tier = Math.min(stacks, 3)
  const baseCd = [2.0, 1.5, 1.0][tier - 1]
  const cd = Math.max(0.5, baseCd - 0.2 * Math.max(0, stacks - tier))
  const now = performance.now() / 1000
  if (now - lastGreaseFireAt < cd) return
  lastGreaseFireAt = now

  const baseDmg = [15, 25, 40][tier - 1] + 8 * Math.max(0, stacks - tier)
  // Tighter AOE so grease_fire feels like a "self-defence ring" the
  // player has to position into, not a free arena-clear. Tier-stat data
  // in src/data/perks.ts mirrors these numbers.
  const radius = [2.5, 3.5, 4.5][tier - 1]
  const dmg = tier === 3 && amount >= 15 ? baseDmg * 2 : baseDmg

  // Per-enemy: damage + hit flash + floating number + death check.
  // Mirrors what Spell.tsx does so an enemy that hits 0 HP from this perk
  // actually dies (it would otherwise sit at 0 HP forever, "invincible"
  // until a spell finally hit it). Exploder enemies queue a detonation
  // chain instead of dying outright; bosses trigger the victory flow.
  const enemies = useEnemyStore.getState().enemies
  const dmgColor = dmg >= 80 ? '#ef4444' : dmg >= 40 ? '#fbbf24' : '#ffffff'
  let hitCount = 0
  for (const enemy of enemies) {
    if (enemy.dying || enemy.detonating) continue
    const dx = enemy.position.x - position.x
    const dz = enemy.position.z - position.z
    if (Math.hypot(dx, dz) > radius) continue
    hitCount++
    useEnemyStore.getState().damageEnemy(enemy.id, dmg)
    useEnemyStore.getState().setEnemyHitFlash(enemy.id, performance.now() + 100)
    spawnDamageNumberVfx(enemy.position.x, enemy.position.z, dmg, dmgColor)

    const updated = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
    if (!updated || updated.hp > 0) continue

    if (updated.type === 'exploder') {
      useEnemyStore.getState().setEnemyDetonating(updated.id)
      window.__queueDetonation?.(updated.id)
      continue
    }
    useEnemyStore.getState().setEnemyDying(updated.id)
    useGameStore.getState().recordEnemyDefeated()
    if (updated.type === 'boss') {
      useEnemyStore.getState().reset()
      useGameStore.getState().triggerVictory()
      return
    }
  }

  if (tier >= 2) {
    const status = tier >= 3 ? 'stunned' : 'soaked'
    const dur = tier >= 3 ? 0.5 : 1.5
    useEnemyStore.getState().applyStatusInRadius(position, radius, status, dur)
  }

  // VFX layer — sprite-sheet if the perk defines one, else the generic
  // fireburst. Screen flash + shake on every trigger so the player feels
  // the burst even when no enemies are in range. The sprite size scales
  // with the AOE radius (×2.5: ~80% of the plane is visible fire, so a
  // plane that big has its rim land at the radius).
  const def = PERK_POOL.find((p) => p.id === 'grease_fire')
  if (def?.vfxSprite) {
    spawnSpriteVfx(def.vfxSprite, position.x, position.z, radius * 2.5)
  } else {
    spawnExplosionVfx(position.x, position.z)
  }
  useGameStore.getState().triggerScreenFlash()
  if (hitCount > 0) useGameStore.getState().triggerScreenShake(0.4, 150)
}

export function resetGreaseFireCooldown() {
  lastGreaseFireAt = -Infinity
}

const PRESSURE_RADIUS = 5.0
const PRESSURE_THRESHOLDS: Record<number, number> = { 1: 3, 2: 2, 3: 1 }
const RELEASE_COOLDOWN_MS = 1500
let lastReleaseAt = 0

export function updatePressureState(playerPos: Position) {
  const stacks = useDeckStore.getState().activePerks.find((p) => p.id === 'pressure_cooker')?.stackCount ?? 0
  if (stacks === 0) return

  const tier = Math.min(stacks, MAX_PERK_TIER)
  const threshold = PRESSURE_THRESHOLDS[tier]
  const wasPressured = usePlayerStore.getState().pressured
  const enemies = useEnemyStore.getState().enemies
  const nearby = enemies.filter(
    (e) => !e.dying && !e.detonating && isInRange(playerPos, e.position, PRESSURE_RADIUS),
  ).length
  const isPressured = nearby >= threshold
  if (isPressured !== wasPressured) usePlayerStore.getState().setPressured(isPressured)

  // T3 release burst on the falling edge
  const now = performance.now()
  if (tier >= 3 && wasPressured && !isPressured && now - lastReleaseAt > RELEASE_COOLDOWN_MS) {
    lastReleaseAt = now
    const damage = 35
    const radius = 6
    const releaseEnemies = useEnemyStore.getState().enemies
    const dmgColor = '#ffffff'
    for (const enemy of releaseEnemies) {
      if (enemy.dying || enemy.detonating) continue
      if (!isInRange(playerPos, enemy.position, radius)) continue
      useEnemyStore.getState().damageEnemy(enemy.id, damage)
      useEnemyStore.getState().setEnemyHitFlash(enemy.id, performance.now() + 100)
      spawnDamageNumberVfx(enemy.position.x, enemy.position.z, damage, dmgColor)
    }
    useEnemyStore.getState().applyStatusInRadius(playerPos, radius, 'stunned', 1.0)
    spawnSpriteVfx('pressure_release_burst', playerPos.x, playerPos.z, radius * 2)

    // Death-check loop — mirrors triggerOnDamageTaken pattern
    const afterDmg = useEnemyStore.getState().enemies
    for (const enemy of afterDmg) {
      if (enemy.dying || enemy.detonating || enemy.hp > 0) continue
      if (enemy.type === 'exploder') {
        useEnemyStore.getState().setEnemyDetonating(enemy.id)
        window.__queueDetonation?.(enemy.id)
        continue
      }
      useEnemyStore.getState().setEnemyDying(enemy.id)
      useGameStore.getState().recordEnemyDefeated()
      if (enemy.type === 'boss') {
        useEnemyStore.getState().reset()
        useGameStore.getState().triggerVictory()
        return
      }
    }
  }
}

export function resetPressureCookerState() {
  lastReleaseAt = 0
  usePlayerStore.getState().setPressured(false)
}
