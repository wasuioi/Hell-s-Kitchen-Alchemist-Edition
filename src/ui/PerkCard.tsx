import { useState } from 'react'
import { MAX_PERK_TIER, RARITY_COLOR, TRIGGER_LABEL } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import { useCardLayoutStore } from '../stores/cardLayoutStore'
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
//   │              [icon]                             │
//   │              Perk Name                          │
//   │           [ON DAMAGE TAKEN]                     │
//   │              #fire #defense                     │
//   │           Damage 15 → 25                        │
//   │           + Soaks enemies                       │
//   │              ─ ─ ─                              │  ← TierDots
//   └─────────────────────────────────────────────────┘
//
// All padding / sizing values come from `cardLayoutStore` so the dev
// can iterate at runtime via the slider tweaker in DevPanel without
// rebuilding. CARD_LAYOUT_DEFAULTS in that store is the single source
// of truth for the baked-in numbers.
// ────────────────────────────────────────────────────────────────────────────

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

  // Pull each value individually so React only re-renders when the
  // value actually changes (vs subscribing to the whole object).
  const cardWidth = useCardLayoutStore((s) => s.cardWidth)
  const cardHeight = useCardLayoutStore((s) => s.cardHeight)
  const bannerHeight = useCardLayoutStore((s) => s.bannerHeight)
  const bannerGap = useCardLayoutStore((s) => s.bannerGap)
  const padX = useCardLayoutStore((s) => s.padX)
  const padTop = useCardLayoutStore((s) => s.padTop)
  const padBottom = useCardLayoutStore((s) => s.padBottom)
  const iconSize = useCardLayoutStore((s) => s.iconSize)
  const nameSize = useCardLayoutStore((s) => s.nameSize)
  const bannerSize = useCardLayoutStore((s) => s.bannerSize)

  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: `${cardWidth}px`,
        height: `${cardHeight + bannerHeight + bannerGap}px`,
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
          announces its tier the moment the player looks at it. */}
      <div
        style={{
          height: `${bannerHeight}px`,
          marginBottom: `${bannerGap}px`,
          fontSize: `${bannerSize}px`,
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
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
        }}
      >
        {/* Stone-tablet frame as the bottom layer. brightness goes up on
            hover so the lava rim "heats up". */}
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
            padding: `${padTop}px ${padX}px ${padBottom}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          {/* HEADER GROUP — OWNED badge (top-right) + icon + name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
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

            <PerkIcon icon={perk.icon} size={iconSize} />

            <div style={{ fontSize: `${nameSize}px`, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>
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

