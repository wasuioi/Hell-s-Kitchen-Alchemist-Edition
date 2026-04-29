import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { drawPerksWithRarity } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import { useCardLayoutStore } from '../stores/cardLayoutStore'
import PerkCard from './PerkCard'

const CARD_GAP = 24

export default function RewardScreen() {
  const currentWave = useGameStore((s) => s.currentWave)
  const activePerks = useDeckStore((s) => s.activePerks)
  // Footer width tracks the card row above it — reactive so the dev
  // panel slider can resize the cards and the footer stays aligned.
  // cardScale (CSS `zoom`) shrinks the card's visual+layout box, so
  // the row's actual width is cardWidth × scale × 3 + gaps.
  const cardWidth = useCardLayoutStore((s) => s.cardWidth)
  const cardScale = useCardLayoutStore((s) => s.cardScale)
  const footerWidth = cardWidth * cardScale * 3 + CARD_GAP * 2
  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(3))
  const [rerollsLeft, setRerollsLeft] = useState(1)
  const [confirmingSkip, setConfirmingSkip] = useState(false)

  function currentTierFor(perkId: string): number {
    return activePerks.find((p) => p.id === perkId)?.stackCount ?? 0
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
      // Safety net for tall card scales: if the cards + header + footer
      // overflow the viewport, scroll inside the overlay rather than
      // hiding the reroll/skip buttons.
      overflowY: 'auto',
      padding: '24px 16px',
    }}>
      <h1 style={{ color: '#fcd34d', fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
        WAVE {currentWave} CLEARED!
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px', fontSize: '16px' }}>
        Choose a perk to upgrade your kitchen
      </p>

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

      <div style={{
        display: 'flex', gap: '12px', marginTop: '28px',
        width: `${footerWidth}px`, justifyContent: 'space-between', alignItems: 'center',
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
