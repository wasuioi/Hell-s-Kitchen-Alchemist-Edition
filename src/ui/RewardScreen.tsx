import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import { drawPerksWithRarity } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkCard, { CARD_SCALE, CARD_WIDTH_PX } from './PerkCard'

const CARD_GAP = 24
// Extra zoom applied on top of CARD_SCALE just for the reward screen,
// so all 4 cards (heal + 3 perks) fit on a single page without scrolling
// even on 1280-wide laptops. Effective card scale = 0.9 × 0.7 = 0.63.
const REWARD_SCALE = 0.7
// Wider gap between heal card and perk row to visually separate the two
// types of choice ("recover" vs "upgrade").
const HEAL_PERK_GAP = 56
const FOOTER_WIDTH =
  CARD_WIDTH_PX * CARD_SCALE * REWARD_SCALE * 4 +
  CARD_GAP * 2 +
  HEAL_PERK_GAP

export default function RewardScreen() {
  const currentWave = useGameStore((s) => s.currentWave)
  const activePerks = useDeckStore((s) => s.activePerks)
  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(3))
  const [rerollsLeft, setRerollsLeft] = useState(1)
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)

  function pickHeal() {
    if (hp >= maxHp) return
    usePlayerStore.getState().heal(30)
    useDeckStore.getState().initHand()
    useGameStore.getState().nextWave()
  }

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
        Heal or pick a perk
      </p>

      <div style={{
        display: 'flex',
        gap: `${HEAL_PERK_GAP}px`,
        alignItems: 'stretch',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {/* Heal card stands alone on the left so the player reads it as
            a separate "recover" choice, not a 4th perk option. */}
        <div style={{ zoom: REWARD_SCALE }}>
          <HealCard hp={hp} maxHp={maxHp} onPick={pickHeal} />
        </div>

        {/* Perk row on the right. */}
        <div style={{ display: 'flex', gap: `${CARD_GAP}px`, alignItems: 'stretch' }}>
          {perks.map((perk) => (
            <div key={perk.id} style={{ zoom: REWARD_SCALE }}>
              <PerkCard
                perk={perk}
                currentTier={currentTierFor(perk.id)}
                onPick={() => pickPerk(perk)}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '12px', marginTop: '28px',
        width: `${FOOTER_WIDTH}px`, justifyContent: 'space-between', alignItems: 'center',
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

function HealCard({ hp, maxHp, onPick }: { hp: number; maxHp: number; onPick: () => void }) {
  const disabled = hp >= maxHp
  return (
    <div
      onClick={disabled ? undefined : onPick}
      style={{
        zoom: CARD_SCALE,
        width: `${CARD_WIDTH_PX}px`,
        minHeight: '420px',
        borderRadius: '12px',
        border: `3px solid ${disabled ? 'rgba(255,255,255,0.2)' : '#ef4444'}`,
        background: disabled
          ? 'linear-gradient(180deg, rgba(60,20,20,0.6), rgba(30,10,10,0.6))'
          : 'linear-gradient(180deg, #4a1313, #1a0606)',
        boxShadow: disabled ? 'none' : '0 0 24px rgba(239,68,68,0.45)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        gap: '16px',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 0 32px rgba(239,68,68,0.7)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = disabled ? 'none' : '0 0 24px rgba(239,68,68,0.45)'
      }}
    >
      <img src="/icons/heart_pickup.png" alt="Heart" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
      <div style={{ color: '#fca5a5', fontSize: '24px', fontWeight: 'bold' }}>HEAL</div>
      <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>+30 HP</div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', textAlign: 'center' }}>
        {disabled ? 'Already at full HP' : 'Skip the perk and recover health.'}
      </div>
    </div>
  )
}
