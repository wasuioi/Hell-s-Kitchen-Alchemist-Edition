// Renders the upgrade-tier indicator as a row of dashes:
//   default → first `current` dashes lit (the player's current tier)
//   on hover → preview dashes (between current and `preview`) blink to
//              tease "this is where picking would put you"
//
// Both `current` and `preview` are clamped to [0, MAX_TIER]. If
// `preview` is omitted (e.g. on the HUD) the dots are static.
//
// The blink animation is defined in src/index.css as @keyframes
// `tier-dot-blink`.

const MAX_TIER = 3

interface TierDotsProps {
  current: number
  preview?: number
  hovered?: boolean
  size?: 'small' | 'large'
}

export default function TierDots({ current, preview, hovered = false, size = 'large' }: TierDotsProps) {
  const cur = Math.max(0, Math.min(MAX_TIER, current))
  const prev = Math.max(cur, Math.min(MAX_TIER, preview ?? cur))
  const dashWidth = size === 'large' ? 22 : 10
  const dashHeight = size === 'large' ? 4 : 3
  const gap = size === 'large' ? 6 : 3

  return (
    <div style={{ display: 'flex', gap: `${gap}px` }}>
      {Array.from({ length: MAX_TIER }, (_, i) => {
        const isCurrent = i < cur
        const isPreview = !isCurrent && i < prev
        const showLit = isCurrent || (hovered && isPreview)
        const blinking = hovered && isPreview
        return (
          <div
            key={i}
            style={{
              width: `${dashWidth}px`,
              height: `${dashHeight}px`,
              borderRadius: `${dashHeight}px`,
              background: showLit ? '#fcd34d' : 'rgba(255,255,255,0.18)',
              boxShadow: showLit ? '0 0 6px rgba(252,211,77,0.6)' : 'none',
              animation: blinking ? 'tier-dot-blink 0.7s ease-in-out infinite' : 'none',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          />
        )
      })}
    </div>
  )
}
