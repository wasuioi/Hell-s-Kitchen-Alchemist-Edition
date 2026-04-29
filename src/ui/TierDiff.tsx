import type { PerkDefinition } from '../data/perks'
import { MAX_PERK_TIER } from '../data/perks'

// Upgrade preview text for a perk reward card. Renders only when the
// perk has structured `tiers` data — non-tiered perks (the legacy
// emoji ones) render nothing here, since their flat `description`
// is already shown above by PerkCard.
//
// - currentTier 0 (first pick)
//                → shows the T1 base stats so the player learns what
//                  numbers they're committing to. Plus the "+added"
//                  effect line for T1 if the perk has one.
// - currentTier 1..MAX-1 (upgrade pick)
//                → shows numeric diffs `Damage: 15 → 25` with the
//                  new value highlighted in red, plus a `+ <effect>`
//                  line for the gameplay added at that tier.
// - currentTier ≥ MAX
//                → "Max tier" hint so the player still knows picking
//                  again is doing something (extra stacks).
//
// The red colour for the new value is the same `#ef4444` used
// elsewhere in the UI for "high damage" feedback.

interface TierDiffProps {
  perk: PerkDefinition
  currentTier: number
}

const NEW_VALUE_COLOR = '#ef4444'
const ADDED_LINE_COLOR = '#fbbf24'

export default function TierDiff({ perk, currentTier }: TierDiffProps) {
  // Non-tiered perks: PerkCard already renders the description, so
  // there's nothing additional to show here.
  if (!perk.tiers) return null

  if (currentTier >= MAX_PERK_TIER) {
    return (
      <span style={{ fontSize: '13px', color: ADDED_LINE_COLOR, textAlign: 'center', lineHeight: 1.4, display: 'block' }}>
        Max tier — extra stacks add a small bonus
      </span>
    )
  }

  const nextTier = Math.min(currentTier + 1, MAX_PERK_TIER)
  const next = perk.tiers[nextTier - 1]
  const prev = currentTier > 0 ? perk.tiers[currentTier - 1] : null
  const newStats = next.stats ?? {}
  const oldStats = prev?.stats ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.4, width: '100%' }}>
      {Object.entries(newStats).map(([label, newVal]) => {
        const oldVal = oldStats?.[label]
        const changed = oldVal !== undefined && oldVal !== newVal
        return (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ opacity: 0.65 }}>{label}</span>
            {changed ? (
              <span>
                <span style={{ opacity: 0.55 }}>{String(oldVal)}</span>
                <span style={{ opacity: 0.45, margin: '0 6px' }}>→</span>
                <span style={{ color: NEW_VALUE_COLOR, fontWeight: 700 }}>{String(newVal)}</span>
              </span>
            ) : (
              <span style={{ color: oldStats ? undefined : NEW_VALUE_COLOR, fontWeight: oldStats ? undefined : 700 }}>
                {String(newVal)}
              </span>
            )}
          </div>
        )
      })}
      {next.added && (
        <div style={{ marginTop: 4, color: ADDED_LINE_COLOR, fontSize: 12, textAlign: 'left', lineHeight: 1.35 }}>
          + {next.added}
        </div>
      )}
    </div>
  )
}
