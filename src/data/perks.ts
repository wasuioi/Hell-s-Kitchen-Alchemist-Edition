export type PerkRarity = 'common' | 'rare' | 'epic' | 'legendary'

// Stats shown on the reward card per tier. Numeric stats are diffed
// against the previous tier so the player sees "Damage 15 → 25" with
// the new value highlighted. `added` is a one-line note describing the
// new gameplay effect that shows up at this tier, prefixed with "+".
export interface PerkTierStats {
  stats?: Record<string, number | string>
  added?: string
}

// `icon` may be either an emoji string ("🔥") or an absolute public path to an
// image ("/icons/grease_fire.png"). The <PerkIcon> component picks the right
// renderer based on whether the value starts with "/".
//
// `vfxSprite` (optional) — slug of a sprite-sheet VFX in `public/vfx/<slug>.png`.
// When set, on-trigger perks play this sprite instead of the generic explosion
// variant. See SpriteVfxEffect.tsx for the expected sheet format.
//
// `tiers` (optional) — three-tier stat data for the reward-card diff display.
// Perks without tiers fall back to the flat `description` string regardless
// of stack count.
export interface PerkDefinition {
  id: string; name: string; icon: string; description: string; rarity: PerkRarity
  vfxSprite?: string
  tiers?: [PerkTierStats, PerkTierStats, PerkTierStats]
}

export const MAX_PERK_TIER = 3

// Card / glow color per rarity — used by RewardScreen and DevPanel to
// tint the card border based on perk.rarity.
export const RARITY_COLOR: Record<PerkRarity, string> = {
  common: '#9ca3af',     // gray
  rare: '#3b82f6',       // blue
  epic: '#a855f7',       // purple
  legendary: '#f59e0b',  // gold
}

export const RARITY_WEIGHTS: Record<PerkRarity, number> = {
  common: 60, rare: 25, epic: 12, legendary: 3,
}

export const PERK_POOL: PerkDefinition[] = [
  {
    id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️',
    description: 'Chili spells +20% damage, smaller AOE; ignites enemies (Burn 🔥)',
    rarity: 'common',
  },
  {
    id: 'deep_freeze', name: 'Deep Freeze', icon: '🧊',
    description: 'Bottle spells Freeze enemies for 2s (immobilized)',
    rarity: 'rare',
  },
  {
    id: 'fast_prep', name: 'Fast Prep', icon: '⚡',
    description: 'Cook cooldown reduced by 0.5s',
    rarity: 'rare',
  },
  {
    id: 'double_batch', name: 'Double Batch', icon: '🧪',
    description: '10% chance spell triggers twice',
    rarity: 'epic',
  },
  {
    id: 'caramelize', name: 'Caramelize', icon: '/icons/caramelize.png',
    description: 'Killed enemies leave burning caramel pools that damage and slow.',
    rarity: 'epic', vfxSprite: 'caramelize_pool_idle',
    tiers: [
      { stats: { DropChance: '50%', Radius: '2.0', Lifetime: '3.0s', DmgPerSec: 5, Slow: '-30%' } },
      { stats: { DropChance: '70%', Radius: '2.5', Lifetime: '4.0s', DmgPerSec: 8, Slow: '-40%' }, added: 'Pools also apply Soaked while enemies stand in them' },
      { stats: { DropChance: '100%', Radius: '2.5+', Lifetime: '5.0s', DmgPerSec: 12, Slow: '-50%' }, added: 'Killing an enemy inside a pool grows it +0.5u (cap 5.0) and refreshes lifetime' },
    ],
  },
  {
    id: 'grease_fire', name: 'Grease Fire', icon: '/icons/grease_fire.png',
    description: 'Taking damage erupts a fiery grease burst around you, scorching nearby enemies. 2s cooldown.',
    rarity: 'rare', vfxSprite: 'grease_fire',
    tiers: [
      { stats: { Damage: 15, Radius: 2.5, Cooldown: '3.0s' } },
      { stats: { Damage: 25, Radius: 3.5, Cooldown: '2.5s' } },
      { stats: { Damage: 40, Radius: 4.5, Cooldown: '2.0s' }, added: 'Doubles damage on heavy hits, ignites enemies (Burn 3s DOT)' },
    ],
  },
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
