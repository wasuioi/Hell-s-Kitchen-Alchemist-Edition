import { useDeckStore } from '../stores/deckStore'
import type { Ingredient } from '../types'

const ICON: Record<Ingredient, string> = {
  CHILI: '/icons/chili.png',
  BOTTLE: '/icons/bottle.png',
  SALT: '/icons/salt.png',
}
const LABEL: Record<Ingredient, string> = { CHILI: 'Chili', BOTTLE: 'Bottle', SALT: 'Salt' }
const GRADIENT: Record<Ingredient, string> = {
  CHILI: 'linear-gradient(135deg, #7f1d1d, #ef4444)',
  BOTTLE: 'linear-gradient(135deg, #1e3a5f, #3b82f6)',
  SALT: 'linear-gradient(135deg, #374151, #9ca3af)',
}

export default function CardHand() {
  const hand = useDeckStore((s) => s.hand)

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {hand.map((ingredient, i) => (
        <button
          key={i}
          onClick={() => useDeckStore.getState().slotIngredient(i)}
          style={{
            width: '80px', height: '110px', border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '10px', background: GRADIENT[ingredient], color: 'white',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '6px', transition: 'transform 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
        >
          <img src={ICON[ingredient]} alt={LABEL[ingredient]} width={48} height={48} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{LABEL[ingredient]}</span>
          <span style={{ fontSize: '11px', opacity: 0.7 }}>[{i + 1}/{['J','K','L'][i]}]</span>
        </button>
      ))}
    </div>
  )
}
