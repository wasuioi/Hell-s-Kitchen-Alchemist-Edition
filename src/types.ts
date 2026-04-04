export type Ingredient = 'CHILI' | 'BOTTLE' | 'SALT'

export type SpellType = 'INFERNO' | 'TIDAL_WAVE' | 'FORTRESS' | 'STEAM' | 'METEOR' | 'MUD'

export type EnemyType = 'slow' | 'fast' | 'tanky' | 'boss'

export type GamePhase = 'menu' | 'combat' | 'reward' | 'boss' | 'death' | 'victory'

export type StatusEffect = 'normal' | 'soaked' | 'stunned'

export interface Position {
  x: number
  z: number
}

export interface Enemy {
  id: string
  position: Position
  hp: number
  maxHp: number
  type: EnemyType
  status: StatusEffect
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
