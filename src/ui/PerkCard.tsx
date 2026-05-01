import { useState } from 'react'
import { MAX_PERK_TIER, RARITY_COLOR } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'
import TierDiff from './TierDiff'

// Layout constants for the perk card. Tuned visually — change here if
// the card needs a different look across reward + hand previews.
const CARD_WIDTH = 400
const CARD_HEIGHT = 712
const BANNER_HEIGHT = 13
const BANNER_GAP = 0
const PAD_X = 82
const PAD_TOP = 30
const PAD_BOTTOM = 74
const ICON_SIZE = 136
const NAME_SIZE = 16
const BANNER_SIZE = 31
// CSS `zoom` shrinks the card's visual + layout box without changing
// its intrinsic proportions. RewardScreen reads CARD_SCALE to size
// the footer row that lines up with the cards.
export const CARD_SCALE = 0.9
export const CARD_WIDTH_PX = CARD_WIDTH

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
        transition: 'transform 0.2s',
        transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // CSS `zoom` scales BOTH visual + flex layout box, so parent
        // containers automatically reflow to the scaled size — unlike
        // `transform: scale()` which only scales pixels and leaves the
        // layout box at its original dimensions.
        zoom: CARD_SCALE,
      }}
    >
      {/* Name banner — sits ABOVE the frame, coloured by rarity. The
          rarity word itself is intentionally absent: the player learns
          rare/epic by the colour, the way Slay the Spire / Hades do it. */}
      <div
        style={{
          height: `${BANNER_HEIGHT}px`,
          marginBottom: `${BANNER_GAP}px`,
          fontSize: `${BANNER_SIZE}px`,
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
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
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
            padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px`,
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
            <PerkIcon icon={perk.icon} size={ICON_SIZE} />

            <div
              style={{
                fontSize: `${NAME_SIZE}px`,
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
