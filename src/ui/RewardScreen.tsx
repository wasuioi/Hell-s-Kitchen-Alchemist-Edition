import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { drawPerksWithRarity, MAX_PERK_TIER, RARITY_COLOR } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'
import TierDiff from './TierDiff'

// Hex color → rgba(r,g,b,a) — used to tint card backgrounds with the
// rarity colour without losing the dark base.
function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function RewardScreen() {
  const currentWave = useGameStore((s) => s.currentWave)
  const activePerks = useDeckStore((s) => s.activePerks)
  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(3))
  const [rerollsLeft, setRerollsLeft] = useState(1)
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function currentTierFor(perkId: string): number {
    return activePerks.find((p) => p.id === perkId)?.stackCount ?? 0
  }

  function tierAfterPick(perkId: string): number {
    return Math.min(currentTierFor(perkId) + 1, MAX_PERK_TIER)
  }

  function pickPerk(perk: PerkDefinition) {
    useDeckStore.getState().addPerk({ ...perk, stackCount: 1 })
    useDeckStore.getState().initHand()
    useGameStore.getState().nextWave()
  }

  function handleReroll() {
    if (rerollsLeft <= 0) return
    setPerks(drawPerksWithRarity(3))
    setRerollsLeft(0)
  }

  function handleSkipClick() {
    if (!confirmingSkip) { setConfirmingSkip(true); return }
    useDeckStore.getState().initHand()
    useGameStore.getState().skipReward()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', zIndex: 20,
    }}>
      <h1 style={{ color: '#fcd34d', fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
        WAVE {currentWave} CLEARED!
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px', fontSize: '16px' }}>
        Choose a perk to upgrade your kitchen
      </p>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
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
                width: '260px', padding: '28px 22px',
                background: isHovered ? withAlpha(rarityColor, 0.18) : withAlpha(rarityColor, 0.06),
                border: `2px solid ${isHovered ? rarityColor : withAlpha(rarityColor, 0.45)}`,
                borderRadius: '14px', color: 'white', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
                transition: 'all 0.2s', fontFamily: 'inherit',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: isHovered ? `0 0 28px ${withAlpha(rarityColor, 0.45)}` : 'none',
              }}
            >
              <span style={{
                fontSize: '22px', fontWeight: 'bold', color: rarityColor,
                textShadow: `0 0 12px ${withAlpha(rarityColor, 0.4)}`,
              }}>
                {perk.name}
              </span>
              <PerkIcon icon={perk.icon} size={72} />

              <div style={{ width: '100%' }}>
                <TierDiff perk={perk} currentTier={currentTierFor(perk.id)} />
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
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

      <div style={{
        display: 'flex', gap: '12px', marginTop: '28px',
        width: '820px', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button
          onClick={handleReroll}
          disabled={rerollsLeft === 0}
          style={{
            padding: '10px 20px', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px',
            cursor: rerollsLeft > 0 ? 'pointer' : 'not-allowed',
            background: rerollsLeft > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
            border: `2px solid ${rerollsLeft > 0 ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
            color: rerollsLeft > 0 ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {rerollsLeft > 0 ? 'Reroll (1)' : 'Reroll (0 — used)'}
        </button>

        {!confirmingSkip ? (
          <button
            onClick={handleSkipClick}
            style={{
              padding: '10px 20px', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px',
              cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
              border: '2px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.color = 'rgba(255,255,255,0.7)'
              el.style.borderColor = 'rgba(255,255,255,0.3)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.color = 'rgba(255,255,255,0.45)'
              el.style.borderColor = 'rgba(255,255,255,0.15)'
            }}
          >
            Skip
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>Skip this reward?</span>
            <button
              onClick={handleSkipClick}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px',
                cursor: 'pointer', background: 'rgba(239,68,68,0.15)',
                border: '2px solid #ef4444', color: '#fca5a5',
              }}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmingSkip(false)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px',
                cursor: 'pointer', background: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)',
              }}
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
