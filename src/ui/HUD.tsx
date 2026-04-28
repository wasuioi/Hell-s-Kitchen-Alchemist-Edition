import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import CardHand from './CardHand'
import CauldronUI from './CauldronUI'
import ScreenFlash from './ScreenFlash'

export default function HUD() {
  const currentWave = useGameStore((s) => s.currentWave)
  const stats = useGameStore((s) => s.stats)
  const activePerks = useDeckStore((s) => s.activePerks)
  const dashCooldownUntil = usePlayerStore((s) => s.dashCooldownUntil)

  // Update dash cooldown display on an interval (avoids performance.now() in render)
  const [dashReady, setDashReady] = useState(true)
  const [dashProgress, setDashProgress] = useState(100)
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, dashCooldownUntil - performance.now())
      setDashProgress(Math.max(0, Math.min(100, (1 - remaining / 2500) * 100)))
      setDashReady(remaining <= 0)
    }
    update()
    const interval = setInterval(update, 50)
    return () => clearInterval(interval)
  }, [dashCooldownUntil])

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
      {/* Dash cooldown indicator */}
      <div style={{
        position: 'absolute', bottom: '24px', right: '24px', zIndex: 10,
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '8px 12px',
        color: 'white', fontSize: '12px', fontWeight: 'bold',
      }}>
        <div>DASH [Shift]</div>
        <div style={{
          width: '60px', height: '4px', background: '#333', borderRadius: '2px',
          marginTop: '4px', overflow: 'hidden',
        }}>
          <div style={{
            width: `${dashProgress}%`,
            height: '100%',
            background: dashReady ? '#22c55e' : '#6b7280',
            borderRadius: '2px',
            transition: 'width 0.1s',
          }} />
        </div>
      </div>
      <ScreenFlash />
    </>
  )
}
