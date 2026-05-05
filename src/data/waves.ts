import type { WaveTier } from '../types'

/** The last regular wave; the next phase after this is the pre-boss lull → boss. */
export const BOSS_WAVE = 7

/** How long the arena stays empty between the last wave and the boss spawn. */
export const PRE_BOSS_LULL_MS = 3000

export interface TierModifier {
  /** Multiply enemy movement speed by this value. 1 = no change. */
  speedMultiplier: number
  /** Forced extra tanky/exploder spawns at the start of each wave. */
  extraEliteCount: number
  /** Multiply HazardManager's spawn interval by this value. <1 = faster. */
  hazardIntervalMultiplier: number
  /** Number of perk options shown in the PerkPanel for this tier. */
  perkPoolSize: number
  /** Number of perks the player can pick before advancing. */
  perkPickCount: number
}

export const TIER_MODIFIERS: Record<WaveTier, TierModifier> = {
  mild: {
    speedMultiplier: 1.0,
    extraEliteCount: 0,
    hazardIntervalMultiplier: 1.0,
    perkPoolSize: 3,
    perkPickCount: 1,
  },
  spicy: {
    speedMultiplier: 1.25,
    extraEliteCount: 1,
    hazardIntervalMultiplier: 0.75,  // 25% faster hazard cadence
    perkPoolSize: 4,
    perkPickCount: 1,
  },
  hellfire: {
    speedMultiplier: 1.5,
    extraEliteCount: 2,
    hazardIntervalMultiplier: 0.6,   // 40% faster hazard cadence
    perkPoolSize: 4,
    perkPickCount: 2,
  },
}
