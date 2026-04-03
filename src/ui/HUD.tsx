import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import CardHand from './CardHand'
import CauldronUI from './CauldronUI'

export default function HUD() {
  const currentWave = useGameStore((s) => s.currentWave)
  const stats = useGameStore((s) => s.stats)
  const activePerks = useDeckStore((s) => s.activePerks)

  return (
    <>
      {/* Top-left: wave info */}
      <div style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '10px 16px',
        color: 'white', fontWeight: 'bold',
      }}>
        <div style={{ fontSize: '14px', letterSpacing: '1px' }}>
          SHIFT 1 — WAVE {currentWave}/7
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
          Enemies defeated: {stats.enemiesDefeated}
        </div>
      </div>

      {/* Top-right: active perks */}
      {activePerks.length > 0 && (
        <div style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 10,
          background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '10px 16px',
          color: 'white', display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {activePerks.map((perk) => (
            <div key={perk.id} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{perk.icon}</span>
              <span>{perk.name}</span>
              {perk.stackCount > 1 && (
                <span style={{ color: '#fcd34d', fontWeight: 'bold' }}>x{perk.stackCount}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom: card hand + cauldron */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', alignItems: 'flex-end', gap: '24px',
        background: 'rgba(0,0,0,0.5)', borderRadius: '12px', padding: '16px',
      }}>
        <CardHand />
        <CauldronUI />
      </div>
    </>
  )
}
