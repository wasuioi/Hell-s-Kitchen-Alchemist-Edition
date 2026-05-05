import { useDeckStore } from '../stores/deckStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { useCharStarStore } from '../stores/charStarStore'
import { PERK_POOL } from '../data/perks'
import { spawnExplosionVfx, spawnSpriteVfx, spawnDamageNumberVfx } from './spawnVfx'
import type { Enemy, Position } from '../types'

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
  const baseCd = [3.0, 2.5, 2.0][tier - 1]
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
    spawnDamageNumberVfx(enemy.position.x, enemy.position.z, dmg, dmgColor, enemy.type === 'boss' ? 5 : 1.5)

    const updated = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
    if (!updated || updated.hp > 0) continue

    if (updated.type === 'exploder') {
      useEnemyStore.getState().setEnemyDetonating(updated.id)
      // chainDepth=1 → short delay, exploder bun in place (no sprint).
      window.__queueDetonation?.(updated.id, 1)
      continue
    }
    useEnemyStore.getState().setEnemyDying(updated.id)
    useGameStore.getState().recordEnemyDefeated()
    if (updated.type === 'boss') {
      useEnemyStore.getState().reset()
      useGameStore.getState().triggerVictory()
      return
    }
    triggerOnEnemyDeath(updated, 'other')
  }

  if (tier >= 3) {
    useEnemyStore.getState().applyStatusInRadius(position, radius, 'burning', 3)
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

// Called whenever a non-boss, non-exploder enemy transitions to dying.
// Handles the CharStar perk: CHILI kills spawn a carcass; at T2+ CharStar
// detonation chain-kills can also spawn one.
//
// `killSource` is 'chili' when a CHILI-recipe spell delivered the killing
// blow, 'chain' when a CharStar detonation did, and 'other' otherwise.
// The `enemy` argument should be the pre-damage snapshot so that
// `lastHitRecipeKind` reflects the spell that marked it, not the killing hit.
export function triggerOnEnemyDeath(enemy: Enemy, killSource: 'chili' | 'chain' | 'other') {
  if (enemy.type === 'boss' || enemy.type === 'exploder') return
  const stacks = useDeckStore.getState().activePerks.find((p) => p.id === 'char_star')?.stackCount ?? 0
  if (stacks === 0) return

  const tier = Math.min(stacks, 3)

  // For chain kills at T2: check if the enemy had a recent CHILI hit (within 3s)
  // before the CharStar detonated. We use the enemy snapshot (pre-detonation
  // lastHitRecipeKind) so the CharStar's own damage doesn't clobber the flag.
  const isChiliMarked =
    enemy.lastHitRecipeKind === 'CHILI' &&
    performance.now() - (enemy.lastHitAt ?? 0) < 3000

  const eligible =
    killSource === 'chili' ||
    (tier >= 2 && killSource === 'chain' && isChiliMarked) ||
    (tier >= 3 && killSource === 'chain')

  if (!eligible) return

  const lifetimeMsValues: [number, number, number] = [1000, 1200, 1500]
  useCharStarStore.getState().addCharStar({
    position: { x: enemy.position.x, z: enemy.position.z },
    spawnedAt: performance.now(),
    lifetimeMs: lifetimeMsValues[tier - 1],
    source: killSource === 'chili' ? 'chili' : 'chain',
  })
}
