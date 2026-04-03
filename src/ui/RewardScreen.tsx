import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { getRandomPerks } from '../data/perks'
import type { PerkDefinition } from '../data/perks'

export default function RewardScreen() {
  const currentWave = useGameStore((s) => s.currentWave)
  // Compute fresh perks once when this component mounts
  const [perks] = useState<PerkDefinition[]>(() => getRandomPerks(3))

  function pickPerk(perk: PerkDefinition) {
    useDeckStore.getState().addPerk({ ...perk, stackCount: 1 })
    useDeckStore.getState().initHand()
    useGameStore.getState().nextWave()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', zIndex: 20,
    }}>
      <h1 style={{ color: '#fcd34d', fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
        WAVE {currentWave} CLEARED!
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px', fontSize: '16px' }}>
        Choose a perk to upgrade your kitchen
      </p>

      <div style={{ display: 'flex', gap: '20px' }}>
        {perks.map((perk) => (
          <button
            key={perk.id}
            onClick={() => pickPerk(perk)}
            style={{
              width: '180px', padding: '24px 16px',
              background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: '12px', color: 'white', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              transition: 'all 0.2s', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(245,158,11,0.15)'
              el.style.borderColor = '#f59e0b'
              el.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(255,255,255,0.05)'
              el.style.borderColor = 'rgba(255,255,255,0.2)'
              el.style.transform = 'translateY(0)'
            }}
          >
            <span style={{ fontSize: '40px' }}>{perk.icon}</span>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{perk.name}</span>
            <span style={{ fontSize: '12px', opacity: 0.7, textAlign: 'center', lineHeight: '1.4' }}>
              {perk.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
