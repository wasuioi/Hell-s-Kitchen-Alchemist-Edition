export type Ingredient = 'CHILI' | 'BOTTLE' | 'SALT'

export type SpellType = 'INFERNO' | 'TIDAL_WAVE' | 'SALT_SPEED' | 'STEAM' | 'METEOR' | 'MUD'

export type EnemyType = 'slow' | 'fast' | 'tanky' | 'boss' | 'exploder'

export type GamePhase = 'menu' | 'combat' | 'reward' | 'pre-boss-lull' | 'boss' | 'death' | 'victory'

export type StatusEffect = 'normal' | 'soaked' | 'stunned'

export interface Position {
  x: number
  z: number
}

export interface Knockback {
  vx: number
  vz: number
}

export type AiState =
  | { kind: 'chase' }
  | { kind: 'tanky_idle'; cooldownUntil?: number }
  | { kind: 'tanky_telegraph'; until: number }
  | { kind: 'tanky_charge'; until: number; vx: number; vz: number }

export interface Enemy {
  id: string
  position: Position
  hp: number
  maxHp: number
  type: EnemyType
  soakedUntil: number
  frozenUntil: number
  burningUntil: number
  poisonedUntil: number
  slowedUntil: number
  stunnedUntil: number
  knockback: Knockback | null
  hitFlashUntil: number
  /** Timestamp until which a "resisted knockback" aura should be visible.
   *  Used by the boss, which is immune to knockback but flashes a gray aura
   *  to telegraph the resist back to the player. Default 0 (no aura). */
  resistAuraUntil: number
  dying: boolean
  detonating: boolean
  detonationStartTime: number
  ai: AiState
}

export interface DamageNumber {
  id: string
  position: { x: number; y: number; z: number }
  amount: number
  color: string
  createdAt: number
}

export interface GameStats {
  enemiesDefeated: number
  ingredientsUsed: number
  wavesCleared: number
  spellsCast: Record<SpellType, number>
}

export interface Perk {
  id: string
  name: string
  icon: string
  description: string
  stackCount: number
}

export interface SpellEffect {
  id: string
  type: SpellType
  position: Position
  radius: number
  damage: number
  duration: number
  elapsed: number
}

// Environmental hazards (issue #71). Each type pulls its config (shape,
// damage, durations) from data/hazards.ts.
export type HazardType = 'grease_fire' | 'steam_vent' | 'falling_pot'

export interface Hazard {
  id: string
  type: HazardType
  position: Position
  /** Y-axis rotation in radians. Used by directional (rect-shape) hazards
   *  like steam vents — for disc hazards this is always 0. */
  rotation: number
  spawnedAt: number   // performance.now() at spawn — drives both telegraph and active timing
  lastDamageAt: number
}

/** Bonemeal Stock cube (perk #28). Dropped from killed non-boss enemies; the
 *  player walks over them to heal. Lives until lifetimeMs since spawnedAt or
 *  consumed by proximity. */
export interface StockCube {
  id: string
  position: Position
  spawnedAt: number
  lifetimeMs: number
}
