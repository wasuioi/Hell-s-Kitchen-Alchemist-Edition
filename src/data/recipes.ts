import type { Ingredient, SpellType } from '../types'

const RECIPE_MATRIX: Record<string, SpellType> = {
  'CHILI+CHILI': 'INFERNO',
  'BOTTLE+BOTTLE': 'TIDAL_WAVE',
  'SALT+SALT': 'SALT_SPEED',
  'BOTTLE+CHILI': 'STEAM',
  'CHILI+SALT': 'METEOR',
  'BOTTLE+SALT': 'MUD',
}

export function getRecipe(a: Ingredient, b: Ingredient): SpellType {
  const key = [a, b].sort().join('+')
  return RECIPE_MATRIX[key]
}

export const SPELL_CONFIG: Record<SpellType, { damage: number; radius: number; duration: number }> = {
  INFERNO:    { damage: 40, radius: 5,   duration: 0.5 },
  TIDAL_WAVE: { damage: 15, radius: 7,   duration: 0.8 },
  SALT_SPEED: { damage: 0,  radius: 1.5, duration: 0.5 },
  STEAM:      { damage: 0,  radius: 5,   duration: 1.0 },
  METEOR:     { damage: 80, radius: 2,   duration: 0.3 },
  MUD:        { damage: 0,  radius: 4,   duration: 5   },
}

export const SPEED_BUFF_DURATION_MS = 3000
export const SPEED_BUFF_MULTIPLIER = 1.2
