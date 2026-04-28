// Renders the upgrade-tier indicator as a row of dashes:
//   T1 → first dash bright
//   T2 → first two dashes bright
//   T3 → all three dashes bright
//
// `tier` is clamped to [0, MAX_TIER]. tier=0 means "not yet picked" (all dim).
// Used on the RewardScreen pick cards (showing the tier-after-pick) and on
// the HUD active perks (showing the current tier).

const MAX_TIER = 3

interface TierDotsProps {
  tier: number
  size?: 'small' | 'large'
}

export default function TierDots({ tier, size = 'large' }: TierDotsProps) {
  const filled = Math.max(0, Math.min(MAX_TIER, tier))
  const dashWidth = size === 'large' ? 22 : 10
  const dashHeight = size === 'large' ? 4 : 3
  const gap = size === 'large' ? 6 : 3

  return (
    <div style={{ display: 'flex', gap: `${gap}px` }}>
      {Array.from({ length: MAX_TIER }, (_, i) => {
        const on = i < filled
        return (
          <div
            key={i}
            style={{
              width: `${dashWidth}px`,
              height: `${dashHeight}px`,
              borderRadius: `${dashHeight}px`,
              background: on ? '#fcd34d' : 'rgba(255,255,255,0.18)',
              boxShadow: on ? '0 0 6px rgba(252,211,77,0.6)' : 'none',
              transition: 'all 0.2s',
            }}
          />
        )
      })}
    </div>
  )
}
