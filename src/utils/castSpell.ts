import type { SpellType, SpellEffect } from '../types'
import { SPELL_CONFIG, SPEED_BUFF_DURATION_MS } from '../data/recipes'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useDeckStore } from '../stores/deckStore'
import { findNearestEnemy } from './collision'
import { triggerOnCast } from './perkTriggers'

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

  return {
    id: `spell_${spellId++}`, type: spellType, position: targetPos,
    radius, damage, duration: config.duration, elapsed: 0,
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

  triggerOnCast()
}
