import { useGameStore } from '../stores/gameStore'
import { TIER_MODIFIERS } from '../data/waves'
import type { WaveTier } from '../types'

interface TierCardData {
  tier: WaveTier
  emoji: string
  label: string
  blurb: string
  borderColor: string
  glow: string
}

const TIERS: TierCardData[] = [
  {
    tier: 'mild', emoji: '🥄', label: 'MILD',
    blurb: 'Standard wave. Pick 1 of 3 perks.',
    borderColor: '#9ca3af',
    glow: 'rgba(156,163,175,0.4)',
  },
  {
    tier: 'spicy', emoji: '🌶️', label: 'SPICY',
    blurb: '+25% enemy speed, +1 elite, faster hazards. Pick 1 of 4 perks.',
    borderColor: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
  },
  {
    tier: 'hellfire', emoji: '🔥', label: 'HELLFIRE',
    blurb: '+50% enemy speed, +2 elites, mid-wave reinforcement. Pick 2 of 4 perks.',
    borderColor: '#dc2626',
    glow: 'rgba(220,38,38,0.55)',
  },
]

export default function TierPanel() {
  const pendingTier = useGameStore((s) => s.pendingTier)
  const chooseTier = useGameStore((s) => s.chooseTier)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ color: '#fbbf24', fontSize: '14px', letterSpacing: '2px' }}>
        NEXT WAVE — CHOOSE YOUR HEAT
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        {TIERS.map((t) => {
          const selected = pendingTier === t.tier
          // Reference TIER_MODIFIERS so the tooltip stays in sync if numbers change.
          // (Not rendered yet — kept for future tooltip extension.)
          void TIER_MODIFIERS[t.tier]
          return (
            <button
              key={t.tier}
              onClick={() => chooseTier(t.tier)}
              style={{
                width: '180px', minHeight: '200px',
                padding: '16px 12px',
                borderRadius: '10px',
                border: `3px solid ${selected ? t.borderColor : 'rgba(255,255,255,0.15)'}`,
                background: 'rgba(20,10,10,0.85)',
                boxShadow: selected ? `0 0 24px ${t.glow}` : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                color: 'white', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '40px' }}>{t.emoji}</div>
              <div style={{ color: t.borderColor, fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>
                {t.label}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', textAlign: 'center' }}>
                {t.blurb}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
