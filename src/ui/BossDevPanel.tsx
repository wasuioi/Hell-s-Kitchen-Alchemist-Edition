import { useBossDevStore, DEFAULT_BOSS_HEIGHT } from '../stores/bossDevStore'
import { ARENA_SIZE } from '../components/Arena'

// Floating dev-only panel for tweaking the boss's position (X / Z) and visual
// size in real time. When enabled, Enemy.tsx skips the boss's AI useFrame so
// the slider values stick instead of being overridden each frame by chase
// movement. Boss.tsx reads `size` from this store every render, and a
// useEffect snaps the boss to (posX, posZ) whenever the sliders move.

const ARENA_HALF = ARENA_SIZE / 2 - 1

export default function BossDevPanel() {
  const enabled = useBossDevStore((s) => s.enabled)
  const posX = useBossDevStore((s) => s.posX)
  const posZ = useBossDevStore((s) => s.posZ)
  const size = useBossDevStore((s) => s.size)
  const setEnabled = useBossDevStore((s) => s.setEnabled)
  const setPosX = useBossDevStore((s) => s.setPosX)
  const setPosZ = useBossDevStore((s) => s.setPosZ)
  const setSize = useBossDevStore((s) => s.setSize)
  const reset = useBossDevStore((s) => s.reset)

  return (
    <div style={{ position: 'absolute', top: '60px', right: '16px', zIndex: 999 }}>
      <button
        onClick={() => setEnabled(!enabled)}
        style={{
          background: 'rgba(0,0,0,0.7)',
          color: enabled ? '#f59e0b' : '#a78bfa',
          border: `1px solid ${enabled ? '#f59e0b' : '#a78bfa'}`,
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '11px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {enabled ? 'Close BOSS' : 'BOSS'}
      </button>

      {enabled && (
        <div
          style={{
            marginTop: '4px',
            background: 'rgba(0,0,0,0.92)',
            borderRadius: '10px',
            padding: '12px',
            color: 'white',
            fontSize: '11px',
            border: '1px solid #a78bfa',
            width: '260px',
          }}
        >
          <div style={{ color: '#a78bfa', fontWeight: 'bold', marginBottom: '4px' }}>
            BOSS
          </div>
          <div style={{ opacity: 0.6, fontSize: '10px', marginBottom: '10px' }}>
            Boss AI is frozen. Sliders set position and visual size.
          </div>

          <SliderRow
            label="pos X"
            value={posX}
            min={-ARENA_HALF}
            max={ARENA_HALF}
            step={0.1}
            onChange={setPosX}
          />
          <SliderRow
            label="pos Z"
            value={posZ}
            min={-ARENA_HALF}
            max={ARENA_HALF}
            step={0.1}
            onChange={setPosZ}
          />
          <SliderRow
            label="size"
            value={size}
            min={1}
            max={15}
            step={0.1}
            onChange={setSize}
          />

          <button
            onClick={reset}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '6px',
              borderRadius: '4px',
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid #6366f1',
              color: '#a5b4fc',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reset to defaults (0, 0, {DEFAULT_BOSS_HEIGHT})
          </button>
        </div>
      )}
    </div>
  )
}

function SliderRow({
  label, value, min, max, step, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
      <span style={{ width: '40px', opacity: 0.8, color: '#fbbf24' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ width: '44px', textAlign: 'right', opacity: 0.85 }}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}
