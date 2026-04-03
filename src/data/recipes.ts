import { Ingredient, SpellType } from '../types'

const RECIPE_MATRIX: Record<string, SpellType> = {
  'CHILI+CHILI': 'INFERNO',
  'BOTTLE+BOTTLE': 'TIDAL_WAVE',
  'SALT+SALT': 'FORTRESS',
  'BOTTLE+CHILI': 'STEAM',
  'CHILI+SALT': 'METEOR',
  'BOTTLE+SALT': 'MUD',
}

export function getRecipe(a: Ingredient, b: Ingredient): SpellType {
  const key = [a, b].sort().join('+')
  return RECIPE_MATRIX[key]
}

export const SPELL_CONFIG: Record<SpellType, { damage: number; radius: number; duration: number; knockback: number; slow: number }> = {
  INFERNO:    { damage: 40, radius: 5,   duration: 0.5, knockback: 0,   slow: 0 },
  TIDAL_WAVE: { damage: 15, radius: 7,   duration: 0.8, knockback: 8,   slow: 0 },
  FORTRESS:   { damage: 0,  radius: 3,   duration: 4,   knockback: 0,   slow: 0 },
  STEAM:      { damage: 10, radius: 4.5, duration: 3,   knockback: 0,   slow: 0.5 },
  METEOR:     { damage: 80, radius: 2,   duration: 0.3, knockback: 0,   slow: 0 },
  MUD:        { damage: 0,  radius: 4,   duration: 5,   knockback: 0,   slow: 0.5 },
}
