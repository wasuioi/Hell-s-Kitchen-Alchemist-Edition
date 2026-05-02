import { useDeckStore } from '../stores/deckStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { useHazardStore } from '../stores/hazardStore'
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

// ── SaltSigil perk ───────────────────────────────────────────────────────────
//
// Player-planted ground hazards that slow and damage enemies. Called from
// HazardManager's useFrame every render tick (nowMs = performance.now()).
//
// Module-level state tracks per-sigil data that doesn't belong in the store:
//   sigilEntryBursted: which enemies have already taken the T2 first-entry
//   burst from each sigil so re-entry doesn't re-burst.

const sigilEntryBursted = new Map<string, Set<string>>()  // sigilId → Set<enemyId>

// Per-tier config constants.
const SIGIL_RADIUS = [4.0, 5.0, 6.0] as const
const SIGIL_LIFETIME_MS = [5000, 6000, 7000] as const
const SIGIL_DOT_DMG = [2, 2, 3] as const  // per 250ms tick → effective ~8/8/12 DPS
const SIGIL_DOT_INTERVAL_MS = 250
// Slow status is refreshed every tick; 400ms keeps it active between ticks.
const SIGIL_SLOW_REFRESH_MS = SIGIL_DOT_INTERVAL_MS + 150

function handleSigilKill(
  enemy: Enemy,
  sigilId: string,
  tier: number,
  radius: number,
  now: number,
) {
  if (enemy.type === 'exploder') {
    useEnemyStore.getState().setEnemyDetonating(enemy.id)
    ;(window as Window & { __queueDetonation?: (id: string, depth?: number) => void }).__queueDetonation?.(enemy.id, 1)
  } else {
    useEnemyStore.getState().setEnemyDying(enemy.id)
    useGameStore.getState().recordEnemyDefeated()
    if (enemy.type === 'boss') {
      useEnemyStore.getState().reset()
      useGameStore.getState().triggerVictory()
      return
    }
  }

  if (tier < 3) return

  // T3: refresh sigil +2s and stun every other in-radius enemy for 0.5s.
  const sigil = useHazardStore.getState().hazards.find((h) => h.id === sigilId)
  if (sigil) {
    useHazardStore.getState().setHazardSpawnedAt(sigilId, sigil.spawnedAt + 2000)
    const stunUntil = now + 500
    for (const other of useEnemyStore.getState().enemies) {
      if (other.dying || other.detonating) continue
      const dx = other.position.x - sigil.position.x
      const dz = other.position.z - sigil.position.z
      if (Math.hypot(dx, dz) > radius) continue
      useEnemyStore.getState().setEnemyStunned(other.id, stunUntil)
    }
  }
}

export function tickSaltSigils(now: number) {
  const stacks = useDeckStore.getState().activePerks.find((p) => p.id === 'salt_sigil')?.stackCount ?? 0
  if (stacks === 0) return

  const tier = Math.min(stacks, 3) as 1 | 2 | 3
  const radius = SIGIL_RADIUS[tier - 1]
  const lifetimeMs = SIGIL_LIFETIME_MS[tier - 1]
  const dotDmg = SIGIL_DOT_DMG[tier - 1]

  // Snapshot so removeHazard mid-loop is safe.
  const hazards = useHazardStore.getState().hazards.slice()

  for (const h of hazards) {
    if (h.type !== 'salt_sigil') continue

    const age = now - h.spawnedAt

    if (age > lifetimeMs) {
      sigilEntryBursted.delete(h.id)
      useHazardStore.getState().removeHazard(h.id)
      continue
    }

    const dotReady = now - h.lastDamageAt >= SIGIL_DOT_INTERVAL_MS
    const enemies = useEnemyStore.getState().enemies
    let dotHitAny = false

    for (const enemy of enemies) {
      if (enemy.dying || enemy.detonating) continue
      if (enemy.type === 'boss') continue

      const dx = enemy.position.x - h.position.x
      const dz = enemy.position.z - h.position.z
      if (Math.hypot(dx, dz) > radius) continue

      // Slow: refresh each tick so the enemy stays slowed while inside.
      useEnemyStore.getState().setEnemySlowed(enemy.id, now + SIGIL_SLOW_REFRESH_MS)

      // T2+ first-entry burst — one-shot per sigil per enemy.
      if (tier >= 2) {
        if (!sigilEntryBursted.has(h.id)) sigilEntryBursted.set(h.id, new Set())
        const bursted = sigilEntryBursted.get(h.id)!
        if (!bursted.has(enemy.id)) {
          bursted.add(enemy.id)
          useEnemyStore.getState().damageEnemy(enemy.id, 14)
          useEnemyStore.getState().setEnemyHitFlash(enemy.id, now + 100)
          spawnDamageNumberVfx(enemy.position.x, enemy.position.z, 14, '#fbbf24')
          const afterBurst = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
          if (afterBurst && afterBurst.hp <= 0 && !afterBurst.dying) {
            handleSigilKill(afterBurst, h.id, tier, radius, now)
            continue
          }
        }
      }

      if (!dotReady) continue

      dotHitAny = true
      useEnemyStore.getState().damageEnemy(enemy.id, dotDmg)
      useEnemyStore.getState().setEnemyHitFlash(enemy.id, now + 100)
      spawnDamageNumberVfx(enemy.position.x, enemy.position.z, dotDmg, '#f59e0b')

      const afterDot = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
      if (afterDot && afterDot.hp <= 0 && !afterDot.dying) {
        handleSigilKill(afterDot, h.id, tier, radius, now)
      }
    }

    if (dotHitAny) useHazardStore.getState().setLastDamageAt(h.id, now)
  }
}

export function resetSaltSigilState() {
  sigilEntryBursted.clear()
}
