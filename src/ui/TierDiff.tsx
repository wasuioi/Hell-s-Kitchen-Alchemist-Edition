import type { PerkDefinition } from '../data/perks'
import { MAX_PERK_TIER } from '../data/perks'

// Body text for a perk reward card.
//
// Behaviour depends on whether the perk has structured `tiers` data:
//
// - No tiers     → falls back to the flat `description` string. Most of
//                  the legacy emoji perks land here.
// - currentTier 0 (first pick)
//                → shows the T1 stats and the human description, so the
//                  player learns what the perk does at base.
// - currentTier 1..MAX-1 (upgrade pick)
//                → shows numeric diffs `Damage: 15 → 25` with the new
//                  value highlighted in red, plus a `+ <effect>` line
//                  for the new gameplay effect introduced at that tier.
// - currentTier ≥ MAX
//                → shows a "max tier" hint so the player still knows
//                  picking again is doing something (extra stacks).
//
// The red colour for the new value is the same `#ef4444` used elsewhere
// in the UI for "high damage" feedback so it reads as an upgrade signal.

interface TierDiffProps {
  perk: PerkDefinition
  currentTier: number
}

const NEW_VALUE_COLOR = '#ef4444'
const ADDED_LINE_COLOR = '#fbbf24'

export default function TierDiff({ perk, currentTier }: TierDiffProps) {
  if (!perk.tiers) {
    return (
      <span style={{ fontSize: '13px', opacity: 0.75, textAlign: 'center', lineHeight: 1.45 }}>
        {perk.description}
      </span>
    )
  }

  if (currentTier >= MAX_PERK_TIER) {
    return (
      <span style={{ fontSize: '12px', color: ADDED_LINE_COLOR, textAlign: 'center', lineHeight: 1.4 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.4 }}>
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
        <div style={{ marginTop: 6, color: ADDED_LINE_COLOR, fontSize: 12, textAlign: 'left', lineHeight: 1.35 }}>
          + {next.added}
        </div>
      )}
      {currentTier === 0 && (
        <div style={{ marginTop: 8, opacity: 0.6, fontSize: 11, textAlign: 'center', lineHeight: 1.4, fontStyle: 'italic' }}>
          {perk.description}
        </div>
      )}
    </div>
  )
}
