import { useState } from 'react'
import { MAX_PERK_TIER, RARITY_COLOR, TRIGGER_LABEL } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'
import TierDiff from './TierDiff'

// ── PerkCard ────────────────────────────────────────────────────────────────
//
// One reward / dev-pick card. The visual is the stone-tablet frame from
// /ui/card_frame.png plus a rarity banner that sits ABOVE the frame as
// a header. Used by both RewardScreen.tsx and DevPanel.tsx so visual
// changes only need to land in one file.
//
//   ┌───── rarity banner (outside frame) ─────┐
//   │                  RARE                   │
//   └─────────────────────────────────────────┘
//   ┌── stone frame (1024×1536, transparent center) ──┐
//   │                              OWNED · T1         │  ← only if owned
//   │              [icon 92]                          │
//   │              Perk Name                          │
//   │           [ON DAMAGE TAKEN]                     │
//   │              #fire #defense                     │
//   │           Damage 15 → 25                        │
//   │           + Soaks enemies                       │
//   │              ─ ─ ─                              │  ← TierDots
//   └─────────────────────────────────────────────────┘
//
// The frame PNG has a real transparent centre, so content placed inside
// shows through cleanly without needing a separate dark fill.
// ────────────────────────────────────────────────────────────────────────────

// Frame at 1024×1536 (2:3 aspect). Card width 320 → height 480.
const CARD_WIDTH = 320
const CARD_HEIGHT = 480

// Rarity banner sits above the frame, ~28px tall plus a small gap.
const BANNER_HEIGHT = 28
const BANNER_GAP = 4

// Inner safe area is generous on this frame — the stone border is thin
// and the corner symbols are recessed into their own cutouts so they
// don't intrude into the content area.
const PAD_X = 30
const PAD_TOP = 30
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
        height: `${CARD_HEIGHT + BANNER_HEIGHT + BANNER_GAP}px`,
        padding: 0,
        background: 'transparent',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        fontFamily: 'inherit',
        // Hover juice is just a subtle lift + scale. The stone frame's
        // built-in lava glow already reads as "this card is alive" — no
        // extra coloured halo around the rectangle.
        transition: 'transform 0.2s',
        transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Rarity banner — sits OUTSIDE the frame as a header so the card
          announces its tier the moment the player looks at it. The
          colour is the rarity tint from RARITY_COLOR. */}
      <div
        style={{
          height: `${BANNER_HEIGHT}px`,
          marginBottom: `${BANNER_GAP}px`,
          fontSize: '14px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          fontWeight: 'bold',
          color: rarityColor,
          textShadow: `0 0 12px ${rarityColor}88`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {perk.rarity}
      </div>

      {/* Frame + content stack */}
      <div
        style={{
          position: 'relative',
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
        }}
      >
        {/* Stone-tablet frame as the bottom layer. The frame has a real
            transparent centre, so content placed inside reads cleanly.
            brightness goes up on hover so the lava rim "heats up". */}
        <img
          src="/ui/card_frame.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            pointerEvents: 'none',
            userSelect: 'none',
            filter: hovered ? 'brightness(1.18)' : 'brightness(1)',
            transition: 'filter 0.2s',
          }}
        />

        {/* Content layer — flex column inside the safe inner area.
            space-between distributes the three logical groups (header,
            body, dots) so non-tiered perks don't leave a big void. */}
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
          {/* HEADER GROUP — OWNED badge (top-right) + icon + name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
            {/* OWNED badge — pinned to top-right of the safe area;
                hidden when the perk has 0 stacks. */}
            <div style={{ width: '100%', minHeight: '20px', display: 'flex', justifyContent: 'flex-end' }}>
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
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}
                >
                  OWNED · T{Math.min(currentTier, MAX_PERK_TIER)}
                </span>
              )}
            </div>

            <PerkIcon icon={perk.icon} size={96} />

            <div style={{ fontSize: '21px', fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>
              {perk.name}
            </div>
          </div>

          {/* BODY GROUP — trigger badge, tags, diff/description */}
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
      </div>
    </button>
  )
}

// Total height includes banner + gap + frame so RewardScreen / DevPanel
// can lay out their containers correctly.
export { CARD_WIDTH, CARD_HEIGHT, BANNER_HEIGHT, BANNER_GAP }
