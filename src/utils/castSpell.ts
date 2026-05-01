import type { SpellType, SpellEffect } from '../types'
import { SPELL_CONFIG, SPEED_BUFF_DURATION_MS } from '../data/recipes'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'
import { findNearestEnemy } from './collision'
import { spawnSpriteVfx } from './spawnVfx'

let spellId = 0

const CHILI_SPELLS: SpellType[] = ['INFERNO', 'STEAM', 'METEOR']

function buildSpell(spellType: SpellType): SpellEffect {
  const playerPos = usePlayerStore.getState().position
  const config = SPELL_CONFIG[spellType]
  let targetPos = { ...playerPos }
  if (spellType === 'METEOR') {
    const nearest = findNearestEnemy(playerPos, useEnemyStore.getState().enemies)
    if (nearest) targetPos = { ...nearest.position }
  }

  let damage = config.damage
  let radius = config.radius
  let sizzle = false

  // Extra Spicy perk: boosts CHILI-based spells
  if (CHILI_SPELLS.includes(spellType)) {
    const extraSpicyStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'extra_spicy')?.stackCount || 0
    if (extraSpicyStacks > 0) {
      damage = damage * (1 + 0.2 * extraSpicyStacks)
      radius = Math.max(0.5, radius * (1 - 0.1 * extraSpicyStacks))
    }
  }

  // BoilingPoint perk: INFERNO consumes all banked Heat for bonus damage
  // (and at T3, heals 1 HP per stack consumed before clearing).
  if (spellType === 'INFERNO') {
    const bpStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'boiling_point')?.stackCount || 0
    if (bpStacks > 0) {
      const heat = usePlayerStore.getState().heatStacks
      if (heat > 0) {
        const tier = Math.min(bpStacks, 3)
        const basePerStack = [0.10, 0.12, 0.15][tier - 1]
        const overflow = Math.max(0, bpStacks - 3) * 0.05
        const perStack = basePerStack + overflow
        damage = damage * (1 + perStack * heat)
        if (tier >= 3) usePlayerStore.getState().heal(heat * 2)
        usePlayerStore.getState().consumeHeat()
        // VFX only fires on the "big release" — Heat ≥5 (where the player
        // is in the visible danger zone with the red tint blink). Below
        // that, INFERNO still consumes Heat and gets the damage bonus, but
        // the cast doesn't get the theatrical two-burst treatment.
        if (heat >= 5) {
          spawnSpriteVfx('boiling_point_consume', playerPos.x, playerPos.z, 5)
          spawnSpriteVfx('boiling_point_spell', targetPos.x, targetPos.z, radius * 2.5)
        }
      }
    }
  }

  // Sauté perk: bonus damage (and T3 Sizzle DoT) when casting while moving
  const sauteStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'saute')?.stackCount || 0
  if (sauteStacks > 0) {
    const tier = Math.min(sauteStacks, 3)
    const windowMs = [250, 500, 500][tier - 1]
    const bonus = [1.12, 1.20, 1.32][tier - 1]
    const since = performance.now() - usePlayerStore.getState().lastMoveTime
    if (since < windowMs) {
      damage *= bonus
      if (tier >= 3) sizzle = true
    }
  }

  return {
    id: `spell_${spellId++}`, type: spellType, position: targetPos,
    radius, damage, duration: config.duration, elapsed: 0, sizzle,
  }
}

function applySaltSpeedBuff() {
  const now = performance.now()
  const currentUntil = usePlayerStore.getState().speedBuffUntil
  const base = Math.max(now, currentUntil)
  usePlayerStore.getState().setSpeedBuff(base + SPEED_BUFF_DURATION_MS)
}

export function castSpell(spellType: SpellType) {
  const spell = buildSpell(spellType)
  ;(window as any).__castSpell?.(spell)
  ;(window as any).__playerAttack?.()

  // Salt Speed: grant the player a speed buff (stacks duration if cast again)
  if (spellType === 'SALT_SPEED') applySaltSpeedBuff()

  // Double Batch perk: chance to cast again after 200ms
  const doubleBatchStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'double_batch')?.stackCount || 0
  if (doubleBatchStacks > 0 && Math.random() < 0.1 * doubleBatchStacks) {
    setTimeout(() => {
      const bonusSpell = buildSpell(spellType)
      ;(window as any).__castSpell?.(bonusSpell)
      if (spellType === 'SALT_SPEED') applySaltSpeedBuff()
    }, 200)
  }
}
