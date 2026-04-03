import type { SpellType, SpellEffect } from '../types'
import { SPELL_CONFIG } from '../data/recipes'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { findNearestEnemy } from './collision'

let spellId = 0

export function castSpell(spellType: SpellType) {
  const playerPos = usePlayerStore.getState().position
  const config = SPELL_CONFIG[spellType]
  let targetPos = { ...playerPos }
  if (spellType === 'METEOR') {
    const nearest = findNearestEnemy(playerPos, useEnemyStore.getState().enemies)
    if (nearest) targetPos = { ...nearest.position }
  }
  const spell: SpellEffect = {
    id: `spell_${spellId++}`, type: spellType, position: targetPos,
    radius: config.radius, damage: config.damage, duration: config.duration, elapsed: 0,
  }
  ;(window as any).__castSpell?.(spell)
}
