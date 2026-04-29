import { useState } from 'react'
import { useDeckStore } from '../stores/deckStore'
import { drawPerksWithRarity, MAX_PERK_TIER, RARITY_COLOR } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'
import TierDiff from './TierDiff'

// ── DevPanel ────────────────────────────────────────────────────────────────
// Cheat menu for fast iteration on perk-related work (VFX, balance, UI).
// Mounts only in dev mode (see App.tsx). Lets you grant any perk to the
// active deck without sitting through waves, reroll the picks an unlimited
// number of times, and clear the deck to start over. The cards mirror
// RewardScreen's layout so visual changes (rarity colour, hover blink,
// tier diff text) match between the real reward flow and dev iteration.
// ────────────────────────────────────────────────────────────────────────────

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(3))
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const activePerks = useDeckStore((s) => s.activePerks)

  function currentTierFor(perkId: string): number {
    return activePerks.find((p) => p.id === perkId)?.stackCount ?? 0
  }
  function tierAfterPick(perkId: string): number {
    return Math.min(currentTierFor(perkId) + 1, MAX_PERK_TIER)
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
          padding: '14px', color: 'white', fontSize: '11px',
          display: 'flex', flexDirection: 'column', gap: '12px',
          width: '820px',
          border: '1px solid #22c55e',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>DEV — Perk Picker</span>
            <span style={{ opacity: 0.5, fontSize: '10px' }}>
              Active: {activePerks.length === 0 ? '(none)' : activePerks.map((p) => `${p.name}×${p.stackCount}`).join(', ')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
            {perks.map((perk) => {
              const rarityColor = RARITY_COLOR[perk.rarity]
              const isHovered = hoveredId === perk.id
              return (
                <button
                  key={perk.id}
                  onClick={() => pickPerk(perk)}
                  onMouseEnter={() => setHoveredId(perk.id)}
                  onMouseLeave={() => setHoveredId((id) => (id === perk.id ? null : id))}
                  style={{
                    flex: 1, padding: '20px 16px',
                    background: isHovered ? withAlpha(rarityColor, 0.18) : withAlpha(rarityColor, 0.06),
                    border: `2px solid ${isHovered ? rarityColor : withAlpha(rarityColor, 0.45)}`,
                    borderRadius: '10px', color: 'white', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                    fontFamily: 'inherit', minHeight: '230px',
                    transition: 'all 0.2s',
                    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: isHovered ? `0 0 20px ${withAlpha(rarityColor, 0.4)}` : 'none',
                  }}
                >
                  <span style={{
                    fontSize: '17px', fontWeight: 'bold', color: rarityColor,
                    textShadow: `0 0 10px ${withAlpha(rarityColor, 0.4)}`,
                  }}>
                    {perk.name}
                  </span>
                  <PerkIcon icon={perk.icon} size={56} />
                  <div style={{ width: '100%' }}>
                    <TierDiff perk={perk} currentTier={currentTierFor(perk.id)} />
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                    <TierDots
                      current={currentTierFor(perk.id)}
                      preview={tierAfterPick(perk.id)}
                      hovered={isHovered}
                      size="large"
                    />
                  </div>
                </button>
              )
            })}
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
        </div>
      )}
    </div>
  )
}
