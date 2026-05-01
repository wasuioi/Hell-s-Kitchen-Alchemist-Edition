import { usePoseTesterStore, TESTABLE_BONES } from '../stores/poseTesterStore'
import type { TestableBone } from '../stores/poseTesterStore'

// Floating dev-only pose-tester panel. When enabled, freezes the boss
// (skips AI movement + skips animation) and applies the slider values
// as rotation offsets on top of the rig's rest pose. Use the Print button
// to dump the current values to the console for copy-pasting back into
// Boss.tsx.

const AXES = ['x', 'y', 'z'] as const

export default function PoseTester() {
  const enabled = usePoseTesterStore((s) => s.enabled)
  const overrides = usePoseTesterStore((s) => s.overrides)
  const setEnabled = usePoseTesterStore((s) => s.setEnabled)
  const setBoneAxis = usePoseTesterStore((s) => s.setBoneAxis)
  const reset = usePoseTesterStore((s) => s.reset)

  const printValues = () => {
    const lines = TESTABLE_BONES.map((n) => {
      const o = overrides[n]
      return `  ${n}: { x: ${o.x.toFixed(2)}, y: ${o.y.toFixed(2)}, z: ${o.z.toFixed(2)} },`
    }).join('\n')
    // eslint-disable-next-line no-console
    console.log(`Pose tester values:\n{\n${lines}\n}`)
  }

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
        {enabled ? 'Close POSE' : 'POSE'}
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
            width: '280px',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ color: '#a78bfa', fontWeight: 'bold', marginBottom: '4px' }}>
            Pose Tester
          </div>
          <div style={{ opacity: 0.6, fontSize: '10px', marginBottom: '10px' }}>
            Boss frozen. Sliders rotate bones around their rest pose (radians, ±π).
          </div>

          {TESTABLE_BONES.map((bone) => (
            <div key={bone} style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '2px' }}>
                {bone}
              </div>
              {AXES.map((axis) => (
                <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', opacity: 0.7 }}>{axis}</span>
                  <input
                    type="range"
                    min={-Math.PI}
                    max={Math.PI}
                    step={0.01}
                    value={overrides[bone][axis]}
                    onChange={(e) => setBoneAxis(bone as TestableBone, axis, parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ width: '40px', textAlign: 'right', opacity: 0.8 }}>
                    {overrides[bone][axis].toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
              onClick={reset}
              style={{
                flex: 1,
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
              Reset all
            </button>
            <button
              onClick={printValues}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '4px',
                background: 'rgba(34,197,94,0.2)',
                border: '1px solid #22c55e',
                color: '#86efac',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Print to console
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
