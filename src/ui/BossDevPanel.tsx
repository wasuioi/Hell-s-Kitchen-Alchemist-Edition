import {
  useBossDevStore,
  DEFAULT_LABEL_OFFSET_X,
  DEFAULT_LABEL_OFFSET_Y,
  DEFAULT_LABEL_FONT_SIZE,
} from '../stores/bossDevStore'

// Floating dev-only panel for tweaking the "BOSS" label that floats above
// the golem's head. Sliders control horizontal/vertical offset (relative
// to the default head-top anchor) and the label's font size in pixels.
// The panel does not change the boss model itself.

export default function BossDevPanel() {
  const enabled = useBossDevStore((s) => s.enabled)
  const offsetX = useBossDevStore((s) => s.labelOffsetX)
  const offsetY = useBossDevStore((s) => s.labelOffsetY)
  const fontSize = useBossDevStore((s) => s.labelFontSize)
  const setEnabled = useBossDevStore((s) => s.setEnabled)
  const setOffsetX = useBossDevStore((s) => s.setLabelOffsetX)
  const setOffsetY = useBossDevStore((s) => s.setLabelOffsetY)
  const setFontSize = useBossDevStore((s) => s.setLabelFontSize)
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
            BOSS label
          </div>
          <div style={{ opacity: 0.6, fontSize: '10px', marginBottom: '10px' }}>
            Position the &quot;BOSS&quot; text floating above the golem&apos;s head.
          </div>

          <SliderRow
            label="off X"
            value={offsetX}
            min={-5}
            max={5}
            step={0.05}
            onChange={setOffsetX}
            unit=""
          />
          <SliderRow
            label="off Y"
            value={offsetY}
            min={-3}
            max={3}
            step={0.05}
            onChange={setOffsetY}
            unit=""
          />
          <SliderRow
            label="size"
            value={fontSize}
            min={10}
            max={64}
            step={1}
            onChange={setFontSize}
            unit="px"
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
            Reset to defaults ({DEFAULT_LABEL_OFFSET_X}, {DEFAULT_LABEL_OFFSET_Y}, {DEFAULT_LABEL_FONT_SIZE}px)
          </button>
        </div>
      )}
    </div>
  )
}

function SliderRow({
  label, value, min, max, step, onChange, unit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
  unit: string
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
      <span style={{ width: '52px', textAlign: 'right', opacity: 0.85 }}>
        {step >= 1 ? value.toFixed(0) : value.toFixed(2)}{unit}
      </span>
    </div>
  )
}
