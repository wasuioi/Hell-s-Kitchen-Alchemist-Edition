import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useHazardStore } from '../stores/hazardStore'
import { usePlayerStore } from '../stores/playerStore'
import { HAZARD_POOL } from '../data/hazards'
import { rollHazardPlacement } from '../components/HazardManager'
import type { HazardType } from '../types'

const HAZARD_LABEL: Record<HazardType, string> = {
  grease_fire: 'Grease fire',
  steam_vent: 'Steam vent',
}

// Minimal dev panel — DEV-only (gated by `import.meta.env.DEV` at the App
// mount site). Built to feel-test the hazard system from #71: jump to
// wave 4+ instantly, manually trigger a hazard, refill HP. Sits in the
// bottom-left so it doesn't overlap the cauldron/cards in the bottom-right.
export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const phase = useGameStore((s) => s.phase)
  const currentWave = useGameStore((s) => s.currentWave)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)

  function skipToWave(targetWave: number) {
    useEnemyStore.getState().reset()
    useHazardStore.getState().reset()
    useGameStore.getState().endSurge()
    useGameStore.setState({ phase: 'combat', currentWave: targetWave })
  }

  function spawnHazard(type: HazardType) {
    const { position, rotation } = rollHazardPlacement(type)
    useHazardStore.getState().spawnHazard(type, position, rotation)
  }

  function healFull() {
    usePlayerStore.getState().heal(maxHp)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 100,
          padding: '6px 12px', borderRadius: 6,
          background: 'rgba(20,20,20,0.85)', color: '#fbbf24',
          border: '1px solid rgba(251,191,36,0.4)',
          font: '600 12px/1 system-ui, sans-serif', letterSpacing: 1,
          cursor: 'pointer',
        }}
      >
        DEV
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 100,
      width: 220, padding: 12, borderRadius: 8,
      background: 'rgba(15,15,15,0.92)',
      border: '1px solid rgba(251,191,36,0.4)',
      color: '#e5e5e5', font: '12px/1.4 system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fbbf24', fontWeight: 600, letterSpacing: 1 }}>DEV</span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent', border: 'none', color: '#888',
            cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
          }}
        >×</button>
      </div>

      <div style={{ color: '#888', fontSize: 11 }}>
        phase: {phase} · wave: {currentWave} · hp: {hp}/{maxHp}
      </div>

      <div>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Skip to wave</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((w) => (
            <button
              key={w}
              onClick={() => skipToWave(w)}
              style={{
                padding: '4px 0', borderRadius: 4,
                background: currentWave === w ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e5e5e5', cursor: 'pointer', font: 'inherit',
              }}
            >{w}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Spawn hazard</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {HAZARD_POOL.map((type) => (
            <button
              key={type}
              onClick={() => spawnHazard(type)}
              style={{
                padding: '6px 10px', borderRadius: 4,
                background: 'rgba(255,96,32,0.15)',
                border: '1px solid rgba(255,96,32,0.45)',
                color: '#ffae80', cursor: 'pointer', font: 'inherit',
                textAlign: 'left',
              }}
            >{HAZARD_LABEL[type]}</button>
          ))}
        </div>
      </div>

      <button
        onClick={healFull}
        style={{
          padding: '6px 10px', borderRadius: 4,
          background: 'rgba(74,222,128,0.15)',
          border: '1px solid rgba(74,222,128,0.45)',
          color: '#86efac', cursor: 'pointer', font: 'inherit',
        }}
      >Heal full</button>
    </div>
  )
}
