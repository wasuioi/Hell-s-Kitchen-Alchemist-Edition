import { useState } from 'react'
import { useDeckStore } from '../stores/deckStore'
import { drawPerksWithRarity } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import { useCardLayoutStore } from '../stores/cardLayoutStore'
import PerkCard from './PerkCard'
import CardLayoutTweaker from './CardLayoutTweaker'

// ── DevPanel ────────────────────────────────────────────────────────────────
// Cheat menu for fast iteration on perk-related work (VFX, balance, UI).
// Mounts only in dev mode (see App.tsx). Lets you grant any perk to the
// active deck without sitting through waves, reroll the picks an unlimited
// number of times, and clear the deck to start over. Cards reuse the
// shared <PerkCard> so visual changes only need to land in one file.
// ────────────────────────────────────────────────────────────────────────────

const CARD_GAP = 12
const PANEL_PADDING = 14

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(3))
  const activePerks = useDeckStore((s) => s.activePerks)
  // Container is sized to exactly fit 3 PerkCards + gaps + padding.
  // cardScale (CSS `zoom`) shrinks the card's visual+layout box, so
  // we account for that here as well.
  const cardWidth = useCardLayoutStore((s) => s.cardWidth)
  const cardScale = useCardLayoutStore((s) => s.cardScale)
  const panelInnerWidth = cardWidth * cardScale * 3 + CARD_GAP * 2

  function currentTierFor(perkId: string): number {
    return activePerks.find((p) => p.id === perkId)?.stackCount ?? 0
  }

  function pickPerk(perk: PerkDefinition) {
    useDeckStore.getState().addPerk({ ...perk, stackCount: 1 })
  }
  function reroll() { setPerks(drawPerksWithRarity(3)) }
  function clearPerks() { useDeckStore.setState({ activePerks: [] }) }

  return (
    <div style={{ position: 'absolute', top: '60px', left: '16px', zIndex: 999 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(0,0,0,0.7)', color: '#22c55e', border: '1px solid #22c55e',
          borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {open ? 'Close DEV' : 'DEV'}
      </button>

      {open && (
        <div style={{
          marginTop: '4px', background: 'rgba(0,0,0,0.92)', borderRadius: '10px',
          padding: `${PANEL_PADDING}px`, color: 'white', fontSize: '11px',
          display: 'flex', flexDirection: 'column', gap: '12px',
          width: `${panelInnerWidth + PANEL_PADDING * 2}px`,
          border: '1px solid #22c55e',
          // Constrain to the viewport and let the panel scroll internally —
          // when the cards are tall and the tweaker is expanded the panel
          // can otherwise spill past the bottom of the window with no way
          // for the user to reach the sliders.
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>DEV — Perk Picker</span>
            <span style={{ opacity: 0.5, fontSize: '10px' }}>
              Active: {activePerks.length === 0 ? '(none)' : activePerks.map((p) => `${p.name}×${p.stackCount}`).join(', ')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: `${CARD_GAP}px`, alignItems: 'stretch' }}>
            {perks.map((perk) => (
              <PerkCard
                key={perk.id}
                perk={perk}
                currentTier={currentTierFor(perk.id)}
                onPick={() => pickPerk(perk)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={reroll}
              style={{
                flex: 1, padding: '6px 12px', borderRadius: '6px',
                background: 'rgba(99,102,241,0.2)', border: '1px solid #6366f1',
                color: '#a5b4fc', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Reroll (unlimited)
            </button>
            <button
              onClick={clearPerks}
              style={{
                padding: '6px 12px', borderRadius: '6px',
                background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
                color: '#fca5a5', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Clear all perks
            </button>
          </div>

          <CardLayoutTweaker />
        </div>
      )}
    </div>
  )
}
