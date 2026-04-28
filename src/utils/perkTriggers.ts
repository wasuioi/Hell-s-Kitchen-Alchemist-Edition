import { useDeckStore } from '../stores/deckStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { PERK_POOL } from '../data/perks'
import { spawnExplosionVfx, spawnSpriteVfx } from './spawnVfx'
import type { Position } from '../types'

// Convention for future on-trigger perks: alongside the gameplay logic
// (damage, status, etc.), spawn visible feedback so the player actually
// sees the perk fire. spawnExplosionVfx() / spawnSpriteVfx() are no-ops
// outside the 3D scene (e.g. in unit tests), so it is safe to call them
// from anywhere.
//
// Visual lookup pattern: if the perk has a `vfxSprite` slug it plays the
// sprite-sheet VFX (custom per-perk look); otherwise it falls back to the
// generic fireburst explosion.

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
  const radius = [4, 5, 6][tier - 1]
  const dmg = tier === 3 && amount >= 15 ? baseDmg * 2 : baseDmg
  useEnemyStore.getState().damageEnemiesInRadius(position, radius, dmg)

  if (tier >= 2) {
    const status = tier >= 3 ? 'stunned' : 'soaked'
    const dur = tier >= 3 ? 0.5 : 1.5
    useEnemyStore.getState().applyStatusInRadius(position, radius, status, dur)
  }

  // Visible feedback — sprite-sheet VFX if the perk defines one, else the
  // generic fireburst. Always pair with a screen flash so the player feels
  // the trigger even with sound off.
  const def = PERK_POOL.find((p) => p.id === 'grease_fire')
  if (def?.vfxSprite) {
    spawnSpriteVfx(def.vfxSprite, position.x, position.z)
  } else {
    spawnExplosionVfx(position.x, position.z)
  }
  useGameStore.getState().triggerScreenFlash()
}

export function resetGreaseFireCooldown() {
  lastGreaseFireAt = -Infinity
}
