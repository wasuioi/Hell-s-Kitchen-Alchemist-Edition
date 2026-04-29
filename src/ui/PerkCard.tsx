import { useState } from 'react'
import { MAX_PERK_TIER, RARITY_COLOR, TRIGGER_LABEL } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'
import TierDiff from './TierDiff'

// ── PerkCard ────────────────────────────────────────────────────────────────
//
// One reward / dev-pick card. Renders the stone-tablet frame from
// /ui/card_frame.png as a background layer and stacks the perk metadata
// on top inside a safe inner area. Used by both RewardScreen.tsx and
// DevPanel.tsx — keeping it in one place so visual changes (frame
// asset, rarity tint, trigger badge layout) only need to land once.
//
// Layout reference (260×304, matching the frame's 0.855 aspect ratio):
//
//   ┌── stone frame (background image) ──┐
//   │  COMMON                  OWNED·T1  │  ← rarity label + owned badge
//   │                                    │
//   │              [icon 64]             │
//   │                                    │
//   │             Perk Name              │
//   │                                    │
//   │         [ON DAMAGE TAKEN]          │  ← trigger pill
//   │           #fire #defense           │  ← tags chips
//   │                                    │
//   │           Damage 15 → 25           │  ← TierDiff
//   │           + Soaks enemies          │
//   │                                    │
//   │              ─ ─ ─                 │  ← TierDots
//   └────────────────────────────────────┘
//
// The frame image's interior fades to dark at the edges, so its dark
// "window" doubles as the card's background — no extra fill needed.
// ────────────────────────────────────────────────────────────────────────────

// Bumped up from 260×304 once we measured the stone-tablet frame's
// actual inner safe area. The frame's stone border + lava-glow rim
// eat ~55px of every side at the source resolution (544×636), so we
// need a card big enough that the safe area can still comfortably
// hold rarity label + icon + name + trigger + tags + diff + dots.
const CARD_WIDTH = 320
const CARD_HEIGHT = 374 // preserves the 544×636 frame aspect (0.855)

// Padding inside the card to keep content off the stone border.
// Measured against the cropped frame: at 320×374 the inner dark area
// starts ~36px in from each side and ~38px from top/bottom.
const PAD_X = 38
const PAD_TOP = 38
const PAD_BOTTOM = 38

interface PerkCardProps {
  perk: PerkDefinition
  // Stack count the player currently has for this perk (0 = not yet picked).
  // Used to drive the OWNED badge and the tier-diff "from → to" display.
  currentTier: number
  onPick: () => void
}

export default function PerkCard({ perk, currentTier, onPick }: PerkCardProps) {
  const [hovered, setHovered] = useState(false)
  const rarityColor = RARITY_COLOR[perk.rarity]
  const previewTier = Math.min(currentTier + 1, MAX_PERK_TIER)
  const owned = currentTier > 0
  const triggerLabel = perk.trigger ? TRIGGER_LABEL[perk.trigger] : null

  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        padding: 0,
        background: 'transparent',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'transform 0.2s, filter 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        // Tint the rarity color through the frame on hover so the player
        // sees which card they're focusing on without changing the frame
        // image itself.
        filter: hovered
          ? `drop-shadow(0 0 24px ${rarityColor}aa)`
          : `drop-shadow(0 0 8px ${rarityColor}55)`,
      }}
    >
      {/* Stone-tablet frame as the bottom layer. The frame's interior
          fades to dark — content placed on top reads cleanly without
          needing a separate dark fill. */}
      <img
        src="/ui/card_frame.png"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          // pointerEvents off so clicks pass to the button
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* Content layer — flex column inside the safe inner area.
          space-between distributes the three logical groups (header,
          body, dots) so non-tiered perks (short description) don't
          leave a big void at the bottom of the frame. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        {/* HEADER GROUP — rarity row + icon + name. Stacked tight. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
          {/* Rarity label (left) + OWNED badge (right) */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontWeight: 'bold',
            }}
          >
            <span style={{ color: rarityColor, opacity: 0.95 }}>{perk.rarity}</span>
            {owned && (
              <span
                style={{
                  background: 'rgba(252,211,77,0.18)',
                  border: '1px solid #fcd34d',
                  color: '#fcd34d',
                  padding: '3px 9px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  letterSpacing: '1.5px',
                }}
              >
                OWNED · T{Math.min(currentTier, MAX_PERK_TIER)}
              </span>
            )}
          </div>

          {/* Icon — bumped up to better fill the larger frame */}
          <div style={{ marginTop: '2px' }}>
            <PerkIcon icon={perk.icon} size={92} />
          </div>

          {/* Name */}
          <div style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2, marginTop: '2px' }}>
            {perk.name}
          </div>
        </div>

        {/* BODY GROUP — trigger badge, tags, diff/description.
            Centered in the leftover middle space so the card balances
            top→bottom regardless of how much content is in the diff. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
          {triggerLabel && (
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '1.5px',
                fontWeight: 'bold',
                padding: '4px 12px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${rarityColor}80`,
                color: rarityColor,
                textTransform: 'uppercase',
              }}
            >
              {triggerLabel}
            </div>
          )}

          {perk.tags && perk.tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {perk.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)',
                    color: 'rgba(255,255,255,0.7)',
                    letterSpacing: '0.3px',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ width: '100%' }}>
            <TierDiff perk={perk} currentTier={currentTier} />
          </div>
        </div>

        {/* DOTS GROUP — bottom anchor */}
        <TierDots
          current={currentTier}
          preview={previewTier}
          hovered={hovered}
          size="large"
        />
      </div>
    </button>
  )
}

// Re-export the canonical card width so RewardScreen / DevPanel can size
// their containers (gap math, footer alignment) without recomputing.
export { CARD_WIDTH, CARD_HEIGHT }
