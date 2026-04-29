import { useState } from 'react'
import { useCardLayoutStore, CARD_LAYOUT_DEFAULTS } from '../stores/cardLayoutStore'
import type { CardLayoutValues } from '../stores/cardLayoutStore'

// ── CardLayoutTweaker ──────────────────────────────────────────────────────
//
// Slider panel that lives inside DevPanel. Each row is one tweakable
// PerkCard layout value, with min/max ranges chosen to cover every
// reasonable layout without exposing nonsense values.
//
// Workflow once values look right:
//   1. Click "Copy values" → TS snippet on clipboard
//   2. Paste into chat with Claude → Claude updates
//      `CARD_LAYOUT_DEFAULTS` in cardLayoutStore.ts
//   3. Other devs / production builds pick up the new defaults
//
// Persistence (localStorage) is wired in cardLayoutStore — reload
// during iteration won't reset in-progress tweaks.
// ───────────────────────────────────────────────────────────────────────────

interface SliderConfig {
  key: keyof CardLayoutValues
  label: string
  min: number
  max: number
  step?: number
}

const SLIDERS: SliderConfig[] = [
  { key: 'cardWidth',    label: 'Card width',     min: 220, max: 480, step: 4 },
  { key: 'cardHeight',   label: 'Card height',    min: 320, max: 700, step: 4 },
  { key: 'bannerHeight', label: 'Banner height',  min: 16,  max: 60,  step: 1 },
  { key: 'bannerGap',    label: 'Banner ↔ frame', min: 0,   max: 24,  step: 1 },
  { key: 'padX',         label: 'Padding X',      min: 0,   max: 80,  step: 1 },
  { key: 'padTop',       label: 'Padding top',    min: 0,   max: 80,  step: 1 },
  { key: 'padBottom',    label: 'Padding bottom', min: 0,   max: 80,  step: 1 },
  { key: 'iconSize',     label: 'Icon size',      min: 32,  max: 160, step: 2 },
  { key: 'nameSize',     label: 'Name font',      min: 12,  max: 32,  step: 1 },
  { key: 'bannerSize',   label: 'Banner font',    min: 8,   max: 24,  step: 1 },
]

export default function CardLayoutTweaker() {
  const [open, setOpen] = useState(false)
  const [copyHint, setCopyHint] = useState<string | null>(null)
  const values = useCardLayoutStore((s) => ({
    cardWidth: s.cardWidth,
    cardHeight: s.cardHeight,
    bannerHeight: s.bannerHeight,
    bannerGap: s.bannerGap,
    padX: s.padX,
    padTop: s.padTop,
    padBottom: s.padBottom,
    iconSize: s.iconSize,
    nameSize: s.nameSize,
    bannerSize: s.bannerSize,
  }))
  const setValue = useCardLayoutStore((s) => s.setValue)
  const reset = useCardLayoutStore((s) => s.reset)

  const dirty = SLIDERS.some((s) => values[s.key] !== CARD_LAYOUT_DEFAULTS[s.key])

  async function handleCopy() {
    const lines = SLIDERS.map((s) => `  ${s.key}: ${values[s.key]},`).join('\n')
    const snippet =
      `export const CARD_LAYOUT_DEFAULTS: CardLayoutValues = {\n${lines}\n}\n`
    try {
      await navigator.clipboard.writeText(snippet)
      setCopyHint('Copied!')
    } catch {
      setCopyHint('Copy failed — see console')
      console.log(snippet)
    }
    setTimeout(() => setCopyHint(null), 1800)
  }

  return (
    <div
      style={{
        border: '1px solid #6366f1',
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#a5b4fc',
          fontWeight: 'bold',
          fontSize: '12px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          padding: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{open ? '▾' : '▸'} Card Layout Tweaker {dirty && <span style={{ color: '#fbbf24' }}>· modified</span>}</span>
        <span style={{ fontSize: '10px', opacity: 0.5 }}>(saved in localStorage)</span>
      </button>

      {open && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 50px',
              gap: '6px 10px',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            {SLIDERS.map((cfg) => {
              const v = values[cfg.key]
              const isDefault = v === CARD_LAYOUT_DEFAULTS[cfg.key]
              return (
                <div key={cfg.key} style={{ display: 'contents' }}>
                  <label style={{ opacity: isDefault ? 0.65 : 1, color: isDefault ? 'white' : '#fbbf24' }}>
                    {cfg.label}
                  </label>
                  <input
                    type="range"
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step ?? 1}
                    value={v}
                    onChange={(e) => setValue(cfg.key, Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366f1' }}
                  />
                  <span
                    style={{
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      color: isDefault ? 'rgba(255,255,255,0.7)' : '#fbbf24',
                    }}
                  >
                    {v}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1, padding: '6px 12px', borderRadius: '6px',
                background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e',
                color: '#86efac', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {copyHint ?? 'Copy values (TS snippet)'}
            </button>
            <button
              onClick={reset}
              disabled={!dirty}
              style={{
                padding: '6px 12px', borderRadius: '6px',
                background: dirty ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${dirty ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                color: dirty ? '#fca5a5' : 'rgba(255,255,255,0.3)',
                fontSize: '11px',
                cursor: dirty ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Reset to defaults
            </button>
          </div>
        </>
      )}
    </div>
  )
}
