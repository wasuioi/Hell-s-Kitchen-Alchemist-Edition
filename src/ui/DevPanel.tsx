import { useState } from 'react'
import { useDeckStore } from '../stores/deckStore'
import { drawPerksWithRarity, MAX_PERK_TIER } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'

// ── DevPanel ────────────────────────────────────────────────────────────────
// Cheat menu for fast iteration on perk-related work (VFX, balance, UI).
// Mounts only in dev mode (see App.tsx). Lets you grant any perk to the
// active deck without sitting through waves, reroll the picks an unlimited
// number of times, and clear the deck to start over.
// ────────────────────────────────────────────────────────────────────────────

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(3))
  const activePerks = useDeckStore((s) => s.activePerks)

  function tierAfterPick(perkId: string): number {
    const current = activePerks.find((p) => p.id === perkId)?.stackCount ?? 0
    return Math.min(current + 1, MAX_PERK_TIER)
  }

  function pickPerk(perk: PerkDefinition) {
    useDeckStore.getState().addPerk({ ...perk, stackCount: 1 })
  }

  function reroll() {
    setPerks(drawPerksWithRarity(3))
  }

  function clearPerks() {
    useDeckStore.setState({ activePerks: [] })
  }

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
          marginTop: '4px', background: 'rgba(0,0,0,0.92)', borderRadius: '8px',
          padding: '12px', color: 'white', fontSize: '11px',
          display: 'flex', flexDirection: 'column', gap: '10px',
          width: '560px',
          border: '1px solid #22c55e',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>DEV — Perk Picker</span>
            <span style={{ opacity: 0.5, fontSize: '10px' }}>
              Active: {activePerks.length === 0 ? '(none)' : activePerks.map((p) => `${p.name}×${p.stackCount}`).join(', ')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {perks.map((perk) => (
              <button
                key={perk.id}
                onClick={() => pickPerk(perk)}
                style={{
                  flex: 1, padding: '12px 10px',
                  background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px', color: 'white', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  fontFamily: 'inherit', minHeight: '170px',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = 'rgba(34,197,94,0.15)'
                  el.style.borderColor = '#22c55e'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = 'rgba(255,255,255,0.05)'
                  el.style.borderColor = 'rgba(255,255,255,0.2)'
                }}
              >
                <PerkIcon icon={perk.icon} size={32} />
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{perk.name}</span>
                <span style={{ fontSize: '10px', opacity: 0.7, textAlign: 'center', lineHeight: '1.4' }}>
                  {perk.description}
                </span>
                <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                  <TierDots tier={tierAfterPick(perk.id)} size="large" />
                </div>
              </button>
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
        </div>
      )}
    </div>
  )
}
