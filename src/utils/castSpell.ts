import type { SpellType, SpellEffect } from '../types'
import { SPELL_CONFIG } from '../data/recipes'
import { PARTICLE_CONFIG } from '../data/particleConfig'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'
import { findNearestEnemy } from './collision'

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
        const basePerStack = [0.20, 0.20, 0.25][tier - 1]
        const overflow = Math.max(0, bpStacks - 3) * 0.05
        const perStack = basePerStack + overflow
        damage = damage * (1 + perStack * heat)
        if (tier >= 3) usePlayerStore.getState().heal(heat)
        usePlayerStore.getState().consumeHeat()
      }
    }
  }

  return {
    id: `spell_${spellId++}`, type: spellType, position: targetPos,
    radius, damage, duration: config.duration, elapsed: 0,
  }
}

export function castSpell(spellType: SpellType) {
  const spell = buildSpell(spellType)
  ;(window as any).__castSpell?.(spell)
  ;(window as any).__setLastSpellColor?.(PARTICLE_CONFIG[spellType].color)
  ;(window as any).__playerAttack?.()

  // Double Batch perk: chance to cast again after 200ms
  const doubleBatchStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'double_batch')?.stackCount || 0
  if (doubleBatchStacks > 0 && Math.random() < 0.1 * doubleBatchStacks) {
    setTimeout(() => {
      const bonusSpell = buildSpell(spellType)
      ;(window as any).__castSpell?.(bonusSpell)
    }, 200)
  }
}
