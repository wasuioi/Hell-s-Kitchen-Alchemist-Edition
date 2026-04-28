export type PerkRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface PerkDefinition {
  id: string; name: string; icon: string; description: string; rarity: PerkRarity
}

export const RARITY_WEIGHTS: Record<PerkRarity, number> = {
  common: 60, rare: 25, epic: 12, legendary: 3,
}

export const PERK_POOL: PerkDefinition[] = [
  { id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'Chili spells +20% damage, smaller AOE', rarity: 'common' },
  { id: 'deep_freeze', name: 'Deep Freeze', icon: '🧊', description: 'Bottle spells stun enemies for 2 seconds', rarity: 'rare' },
  { id: 'heavy_salt', name: 'Heavy Salt', icon: '🪨', description: 'Salt spells push enemies 2x further', rarity: 'common' },
  { id: 'fast_prep', name: 'Fast Prep', icon: '⚡', description: 'Cook cooldown reduced by 0.5s', rarity: 'rare' },
  { id: 'double_batch', name: 'Double Batch', icon: '🧪', description: '10% chance spell triggers twice', rarity: 'epic' },
  { id: 'grease_fire', name: 'Grease Fire', icon: '🔥', description: 'Taking damage erupts a fiery grease burst around you, scorching nearby enemies. 2s cooldown.', rarity: 'rare' },
]

function pickWeightedRarity(): PerkRarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [PerkRarity, number][]) {
    roll -= weight
    if (roll <= 0) return rarity as PerkRarity
  }
  return 'common'
}

export function drawPerksWithRarity(count: number): PerkDefinition[] {
  const available = [...PERK_POOL]
  const result: PerkDefinition[] = []
  for (let i = 0; i < count && available.length > 0; i++) {
    const rarity = pickWeightedRarity()
    const rarityPool = available.filter((p) => p.rarity === rarity)
    const pool = rarityPool.length > 0 ? rarityPool : available
    const picked = pool[Math.floor(Math.random() * pool.length)]
    result.push(picked)
    available.splice(available.findIndex((p) => p.id === picked.id), 1)
  }
  return result
}

export function getRandomPerks(count: number): PerkDefinition[] {
  const shuffled = [...PERK_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
