import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import { drawPerksWithRarity, type PerkDefinition } from '../data/perks'
import { TIER_MODIFIERS } from '../data/waves'
import PerkCard, { CARD_SCALE, CARD_WIDTH_PX } from './PerkCard'

const CARD_GAP = 24
const PERK_CARD_SCALE = 0.85
const HEAL_CARD_SCALE = 0.55
const HEAL_PERK_GAP = 56

export default function PerkPanel() {
  const currentTier = useGameStore((s) => s.currentTier) ?? 'mild'
  const mods = TIER_MODIFIERS[currentTier]
  const activePerks = useDeckStore((s) => s.activePerks)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)

  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(mods.perkPoolSize))
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())
  const [rerollsLeft, setRerollsLeft] = useState(1)
  const picksRemaining = mods.perkPickCount - pickedIds.size

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
    if (picksRemaining <= 0 || pickedIds.has(perk.id)) return
    useDeckStore.getState().addPerk({ ...perk, stackCount: 1 })
    useDeckStore.getState().initHand()
    setPickedIds((s) => new Set(s).add(perk.id))
    // Note: no auto-advance — BeginWaveButton handles wave start.
  }

  function handleReroll() {
    if (rerollsLeft <= 0 || pickedIds.size > 0) return
    setPerks(drawPerksWithRarity(mods.perkPoolSize))
    setRerollsLeft(0)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
        Picks remaining: {picksRemaining} / {mods.perkPickCount}
      </div>

      <div style={{
        display: 'flex', gap: `${HEAL_PERK_GAP}px`,
        alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <div style={{ zoom: HEAL_CARD_SCALE }}>
          <HealCard hp={hp} maxHp={maxHp} onPick={pickHeal} />
        </div>

        <div style={{ display: 'flex', gap: `${CARD_GAP}px`, alignItems: 'stretch' }}>
          {perks.map((perk) => {
            const isPicked = pickedIds.has(perk.id)
            return (
              <div key={perk.id} style={{ zoom: PERK_CARD_SCALE, opacity: isPicked ? 0.4 : 1 }}>
                <PerkCard
                  perk={perk}
                  currentTier={currentTierFor(perk.id) + (isPicked ? 1 : 0)}
                  onPick={() => pickPerk(perk)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleReroll}
        disabled={rerollsLeft === 0 || pickedIds.size > 0}
        style={{
          padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
          cursor: rerollsLeft > 0 && pickedIds.size === 0 ? 'pointer' : 'not-allowed',
          background: rerollsLeft > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
          border: `2px solid ${rerollsLeft > 0 ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
          color: rerollsLeft > 0 ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
        }}
      >
        {rerollsLeft > 0 ? 'Reroll (1)' : 'Reroll (0 — used)'}
      </button>
    </div>
  )
}

function HealCard({ hp, maxHp, onPick }: { hp: number; maxHp: number; onPick: () => void }) {
  const disabled = hp >= maxHp
  return (
    <div
      onClick={disabled ? undefined : onPick}
      style={{
        zoom: CARD_SCALE, width: `${CARD_WIDTH_PX}px`, minHeight: '420px',
        borderRadius: '12px',
        border: `3px solid ${disabled ? 'rgba(255,255,255,0.2)' : '#ef4444'}`,
        background: disabled
          ? 'linear-gradient(180deg, rgba(60,20,20,0.6), rgba(30,10,10,0.6))'
          : 'linear-gradient(180deg, #4a1313, #1a0606)',
        boxShadow: disabled ? 'none' : '0 0 24px rgba(239,68,68,0.45)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px 16px', gap: '16px',
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
