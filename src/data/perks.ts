export interface PerkDefinition {
  id: string; name: string; icon: string; description: string
}

export const PERK_POOL: PerkDefinition[] = [
  { id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'Chili spells +20% damage, smaller AOE' },
  { id: 'deep_freeze', name: 'Deep Freeze', icon: '🧊', description: 'Bottle spells stun enemies for 2 seconds' },
  { id: 'heavy_salt', name: 'Heavy Salt', icon: '🪨', description: 'Salt spells push enemies 2x further' },
  { id: 'fast_prep', name: 'Fast Prep', icon: '⚡', description: 'Cook cooldown reduced by 0.5s' },
  { id: 'double_batch', name: 'Double Batch', icon: '🧪', description: '10% chance spell triggers twice' },
]

export function getRandomPerks(count: number): PerkDefinition[] {
  const shuffled = [...PERK_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
