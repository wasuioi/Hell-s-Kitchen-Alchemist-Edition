import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useEnemyStore } from '../stores/enemyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useDeckStore } from '../stores/deckStore'
import { PERK_POOL, type PerkDefinition } from '../data/perks'

export default function DebugPanel() {
  const [open, setOpen] = useState(false)
  const phase = useGameStore((s) => s.phase)
  const currentWave = useGameStore((s) => s.currentWave)
  const activePerks = useDeckStore((s) => s.activePerks)

  function skipToWave(wave: number) {
    useEnemyStore.getState().reset()
    usePlayerStore.getState().reset()
    useDeckStore.getState().initHand()
    if (wave > 7) {
      useGameStore.setState({ phase: 'boss', currentWave: 7, timeScale: 1 })
    } else {
      useGameStore.setState({ phase: 'combat', currentWave: wave, timeScale: 1 })
    }
  }

  function healFull() {
    const { maxHp } = usePlayerStore.getState()
    usePlayerStore.getState().heal(maxHp)
  }

  function grantPerk(def: PerkDefinition) {
    useDeckStore.getState().addPerk({ ...def, stackCount: 1 })
  }

  function clearPerks() {
    useDeckStore.getState().clearPerks()
  }

  return (
    <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 999 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(0,0,0,0.7)', color: '#fbbf24', border: '1px solid #fbbf24',
          borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
        }}
      >
        {open ? 'Close Debug' : 'Debug [~]'}
      </button>
      {open && (
        <div style={{
          marginTop: '4px', background: 'rgba(0,0,0,0.85)', borderRadius: '8px',
          padding: '10px', color: 'white', fontSize: '12px', display: 'flex',
          flexDirection: 'column', gap: '6px', minWidth: '200px',
        }}>
          <div style={{ opacity: 0.6 }}>Phase: {phase} | Wave: {currentWave}</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((w) => (
              <button
                key={w}
                onClick={() => skipToWave(w)}
                style={{
                  background: w === currentWave ? '#fbbf24' : '#333',
                  color: w === currentWave ? 'black' : 'white',
                  border: 'none', borderRadius: '4px', padding: '4px 8px',
                  fontSize: '11px', cursor: 'pointer',
                }}
              >
                W{w}
              </button>
            ))}
            <button
              onClick={() => skipToWave(8)}
              style={{
                background: phase === 'boss' ? '#ef4444' : '#333', color: 'white',
                border: 'none', borderRadius: '4px', padding: '4px 8px',
                fontSize: '11px', cursor: 'pointer',
              }}
            >
              Boss
            </button>
          </div>
          <button
            onClick={healFull}
            style={{
              background: '#22c55e', color: 'black', border: 'none',
              borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
            }}
          >
            Full Heal
          </button>
          <div style={{ opacity: 0.6, marginTop: '4px' }}>Perks (click to +1 stack)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {PERK_POOL.map((perk) => {
              const stack = activePerks.find((p) => p.id === perk.id)?.stackCount || 0
              return (
                <button
                  key={perk.id}
                  onClick={() => grantPerk(perk)}
                  title={perk.description}
                  style={{
                    background: stack > 0 ? '#7c3aed' : '#333', color: 'white', border: 'none',
                    borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {perk.icon} {perk.name}{stack > 0 && ` ×${stack}`}
                </button>
              )
            })}
          </div>
          <button
            onClick={clearPerks}
            disabled={activePerks.length === 0}
            style={{
              background: activePerks.length === 0 ? '#444' : '#ef4444',
              color: 'white', border: 'none', borderRadius: '4px',
              padding: '4px 8px', fontSize: '11px',
              cursor: activePerks.length === 0 ? 'default' : 'pointer',
              opacity: activePerks.length === 0 ? 0.5 : 1,
            }}
          >
            Clear Perks
          </button>
        </div>
      )}
    </div>
  )
}
