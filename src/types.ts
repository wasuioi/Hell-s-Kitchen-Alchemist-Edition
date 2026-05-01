export type Ingredient = 'CHILI' | 'BOTTLE' | 'SALT'

export type SpellType = 'INFERNO' | 'TIDAL_WAVE' | 'SALT_SPEED' | 'STEAM' | 'METEOR' | 'MUD'

export type EnemyType = 'slow' | 'fast' | 'tanky' | 'boss' | 'exploder'

export type GamePhase = 'menu' | 'combat' | 'reward' | 'boss' | 'death' | 'victory'

export type StatusEffect = 'normal' | 'soaked' | 'stunned'

export interface Position {
  x: number
  z: number
}

export interface Knockback {
  vx: number
  vz: number
}

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
