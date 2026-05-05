import { getRecipe, SPELL_LABELS, INGREDIENT_ICONS } from '../data/recipes'
import type { Ingredient } from '../types'

const RECIPES: Array<[Ingredient, Ingredient]> = [
  ['CHILI', 'CHILI'],
  ['BOTTLE', 'BOTTLE'],
  ['SALT', 'SALT'],
  ['CHILI', 'BOTTLE'],
  ['CHILI', 'SALT'],
  ['BOTTLE', 'SALT'],
]

interface Props {
  /** Visual variant — `hud` is the small left-panel style; `rest-room` is
   *  the larger version embedded in the Rest Room hub. */
  variant: 'hud' | 'rest-room'
}

export default function RecipeBookPanel({ variant }: Props) {
  const isHud = variant === 'hud'
  return (
    <div style={{
      padding: isHud ? '12px 16px' : '16px 24px',
      background: 'rgba(0,0,0,0.6)',
      borderRadius: '8px',
      border: '1px solid rgba(245, 158, 11, 0.25)',
    }}>
      <div style={{
        color: '#fbbf24',
        fontSize: isHud ? '10px' : '14px',
        fontWeight: 'bold',
        letterSpacing: '2px',
        textAlign: 'center',
        marginBottom: '8px',
      }}>
        RECIPES
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: isHud ? '6px' : '10px',
        color: '#d1d5db', fontSize: isHud ? '11px' : '14px',
      }}>
        {RECIPES.map(([a, b]) => {
          const iconSize = isHud ? 18 : 24
          return (
            <div key={`${a}+${b}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src={INGREDIENT_ICONS[a]} alt={a} width={iconSize} height={iconSize} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>+</span>
              <img src={INGREDIENT_ICONS[b]} alt={b} width={iconSize} height={iconSize} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>=</span>
              <span style={{ color: '#fcd34d', fontWeight: 'bold' }}>
                {SPELL_LABELS[getRecipe(a, b)] ?? getRecipe(a, b)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
