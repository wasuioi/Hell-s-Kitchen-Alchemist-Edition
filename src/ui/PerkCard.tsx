import { useState } from 'react'
import { MAX_PERK_TIER, RARITY_COLOR } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import { useCardLayoutStore } from '../stores/cardLayoutStore'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'
import TierDiff from './TierDiff'

// ── PerkCard ────────────────────────────────────────────────────────────────
//
// Stripped-down "clean" pass: the banner above the frame is the perk's
// NAME tinted with the rarity colour, and the inside of the frame holds
// only the icon + a short description. No rarity word, no OWNED badge,
// no trigger pill, no tags, no stat-diff rows, no tier dots.
//
//   ┌─── name banner (outside frame, rarity-coloured) ───┐
//   │                    Grease Fire                     │
//   └────────────────────────────────────────────────────┘
//   ┌── stone frame (1024×1536, transparent center) ─────┐
//   │                                                    │
//   │                     [icon]                         │
//   │                                                    │
//   │       Taking damage erupts a fiery grease          │
//   │       burst around you, scorching nearby           │
//   │       enemies.                                     │
//   │                                                    │
//   └────────────────────────────────────────────────────┘
//
// Rarity is communicated by the banner's text colour (gray / blue /
// purple / gold). All sizing values come from cardLayoutStore so the
// dev can keep tweaking via the slider panel in DevPanel.
// ────────────────────────────────────────────────────────────────────────────

interface PerkCardProps {
  perk: PerkDefinition
  // Stack count the player currently has for this perk (0 = not yet picked).
  // Currently unused by the visual but kept in the API so the parent
  // doesn't have to special-case stacks if we re-introduce indicators
  // later (owned badge, tier dots, etc.).
  currentTier: number
  onPick: () => void
}

export default function PerkCard({ perk, currentTier, onPick }: PerkCardProps) {
  const [hovered, setHovered] = useState(false)
  const rarityColor = RARITY_COLOR[perk.rarity]
  const previewTier = Math.min(currentTier + 1, MAX_PERK_TIER)

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
        transition: 'transform 0.2s',
        transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Name banner — sits ABOVE the frame, coloured by rarity. The
          rarity word itself is intentionally absent: the player learns
          rare/epic by the colour, the way Slay the Spire / Hades do it. */}
      <div
        style={{
          height: `${bannerHeight}px`,
          marginBottom: `${bannerGap}px`,
          fontSize: `${bannerSize}px`,
          fontWeight: 'bold',
          color: rarityColor,
          textShadow: `0 0 12px ${rarityColor}88`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
        }}
      >
        {perk.name}
      </div>

      {/* Frame + content stack */}
      <div
        style={{
          position: 'relative',
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
        }}
      >
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

        {/* Inside the frame — icon and description grouped together
            in the middle of the safe area, TierDots pinned to the
            bottom as the upgrade-tier preview. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: `${padTop}px ${padX}px ${padBottom}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* icon + description + tier upgrade preview, all grouped
              centred vertically in the remaining space above the dots.
              TierDiff renders nothing for non-tiered perks, so the
              description carries all the info there. */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
            }}
          >
            <PerkIcon icon={perk.icon} size={iconSize} />

            <div
              style={{
                fontSize: `${nameSize}px`,
                opacity: 0.85,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {perk.description}
            </div>

            <TierDiff perk={perk} currentTier={currentTier} />
          </div>

          {/* Tier preview dots — bottom anchor. Hover blink shows the
              tier the player would advance to if they pick the card. */}
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
