import { useState, useEffect, useRef } from 'react'
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

const CONSUME_DURATION = 0.75

export default function CardHand() {
  const hand = useDeckStore((s) => s.hand)
  const cauldron = useDeckStore((s) => s.cauldron)

  const [consumeAnim, setConsumeAnim] = useState<{ indices: number[]; startedAt: number } | null>(null)
  const [consumeProgress, setConsumeProgress] = useState(0)

  const prevCauldron = useRef(cauldron)
  useEffect(() => {
    const prev = prevCauldron.current
    const wasFull = prev.slotA !== null && prev.slotB !== null
    const nowEmpty = cauldron.slotA === null && cauldron.slotB === null
    if (wasFull && nowEmpty) {
      setConsumeAnim({
        indices: [prev.slotA!.fromHandIndex, prev.slotB!.fromHandIndex],
        startedAt: performance.now(),
      })
      setConsumeProgress(0)
    }
    prevCauldron.current = cauldron
  }, [cauldron])

  useEffect(() => {
    if (!consumeAnim) return
    const id = setInterval(() => {
      const elapsed = (performance.now() - consumeAnim.startedAt) / 1000
      const progress = Math.min(1, elapsed / CONSUME_DURATION)
      setConsumeProgress(progress)
      if (progress >= 1) {
        setConsumeAnim(null)
        setConsumeProgress(0)
        clearInterval(id)
      }
    }, 16)
    return () => clearInterval(id)
  }, [consumeAnim])

  const isSelected = (i: number) =>
    cauldron.slotA?.fromHandIndex === i || cauldron.slotB?.fromHandIndex === i

  const isConsuming = (i: number) => consumeAnim?.indices.includes(i) ?? false

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {hand.map((ingredient, i) => {
        const selected = isSelected(i)
        const consuming = isConsuming(i)
        const wedgeDeg = (1 - consumeProgress) * 360
        return (
          <button
            key={i}
            onClick={() => useDeckStore.getState().slotIngredient(i)}
            style={{
              width: '80px', height: '110px',
              border: selected ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.3)',
              borderRadius: '10px', background: GRADIENT[ingredient], color: 'white',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '6px',
              transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
              fontFamily: 'inherit',
              transform: selected ? 'translateY(-6px)' : 'translateY(0)',
              boxShadow: selected ? '0 0 16px rgba(251, 191, 36, 0.7)' : 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (!selected) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={(e) => {
              if (!selected) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            }}
          >
            <img src={ICON[ingredient]} alt={LABEL[ingredient]} width={48} height={48} style={{ objectFit: 'contain' }} />
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{LABEL[ingredient]}</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>[{i + 1}/{['J','K','L'][i]}]</span>
            {consuming && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '8px',
                background: `conic-gradient(from 0deg, rgba(0,0,0,0.85) 0deg, rgba(0,0,0,0.85) ${wedgeDeg}deg, transparent ${wedgeDeg}deg)`,
                pointerEvents: 'none',
              }} />
            )}
          </button>
        )
      })}
    </div>
  )
}
