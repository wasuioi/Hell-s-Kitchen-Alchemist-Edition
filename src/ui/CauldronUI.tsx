import { useState, useEffect, useRef } from 'react'
import { useDeckStore } from '../stores/deckStore'
import { useGameStore } from '../stores/gameStore'
import { getRecipe } from '../data/recipes'
import { castSpell } from '../utils/castSpell'
import type { Ingredient } from '../types'

const ICON: Record<Ingredient, string> = {
  CHILI: '/icons/chili.png',
  BOTTLE: '/icons/bottle.png',
  SALT: '/icons/salt.png',
}

const SPELL_LABELS: Record<string, string> = {
  INFERNO: 'Inferno 🔥', TIDAL_WAVE: 'Tidal Wave 🌊', SALT_SPEED: 'Salt Speed 👟',
  STEAM: 'Steam 💨', METEOR: 'Meteor ☄️', MUD: 'Mud 🟫',
}

export default function CauldronUI() {
  const cauldron = useDeckStore((s) => s.cauldron)
  const cookCooldown = useDeckStore((s) => s.cookCooldown)
  const cookCooldownDuration = useDeckStore((s) => s.cookCooldownDuration)
  const { slotA, slotB } = cauldron
  const ready = slotA !== null && slotB !== null

  const [cooldownProgress, setCooldownProgress] = useState(0)
  const [consumeSnapshot, setConsumeSnapshot] = useState<{
    slotA: Ingredient
    slotB: Ingredient
    startedAt: number
  } | null>(null)
  const [consumeProgress, setConsumeProgress] = useState(0)

  useEffect(() => {
    if (cookCooldown === 0) { setCooldownProgress(0); return }
    const interval = setInterval(() => {
      const now = performance.now() / 1000
      const elapsed = now - cookCooldown
      const progress = Math.min(1, elapsed / cookCooldownDuration)
      setCooldownProgress(progress)
      if (progress >= 1) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [cookCooldown, cookCooldownDuration])

  const prevCauldron = useRef(cauldron)
  useEffect(() => {
    const prev = prevCauldron.current
    const wasFull = prev.slotA !== null && prev.slotB !== null
    const nowEmpty = cauldron.slotA === null && cauldron.slotB === null
    if (wasFull && nowEmpty) {
      setConsumeSnapshot({
        slotA: prev.slotA!.ingredient,
        slotB: prev.slotB!.ingredient,
        startedAt: performance.now(),
      })
      setConsumeProgress(0)
    }
    prevCauldron.current = cauldron
  }, [cauldron])

  useEffect(() => {
    if (!consumeSnapshot) return
    const id = setInterval(() => {
      const elapsed = (performance.now() - consumeSnapshot.startedAt) / 1000
      const progress = Math.min(1, elapsed / 0.5)
      setConsumeProgress(progress)
      if (progress >= 1) {
        setConsumeSnapshot(null)
        setConsumeProgress(0)
        clearInterval(id)
      }
    }, 16)
    return () => clearInterval(id)
  }, [consumeSnapshot])

  const spellPreview = ready
    ? (SPELL_LABELS[getRecipe(slotA!.ingredient, slotB!.ingredient)] ?? getRecipe(slotA!.ingredient, slotB!.ingredient))
    : null

  function handleCook() {
    if (!ready) return
    const now = performance.now() / 1000
    const fastPrepStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'fast_prep')?.stackCount || 0
    const baseCooldown = Math.max(0.2, 1.5 - fastPrepStacks * 0.5)
    if (cookCooldown > 0 && now - cookCooldown < baseCooldown) return
    const spell = useDeckStore.getState().cook()
    if (!spell) return
    useDeckStore.getState().setCookCooldown(now, baseCooldown)
    useGameStore.getState().recordIngredientUsed()
    useGameStore.getState().recordIngredientUsed()
    useGameStore.getState().recordSpellCast(spell)
    castSpell(spell)
  }

  const slotStyle = (filled: boolean): React.CSSProperties => ({
    width: '54px', height: '54px', borderRadius: '50%',
    border: `2px solid ${filled ? '#f59e0b' : 'rgba(255,255,255,0.4)'}`,
    background: filled ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: filled ? '24px' : '16px', color: 'rgba(255,255,255,0.6)',
    fontWeight: 'bold',
  })

  const renderSlotContent = (
    slot: { ingredient: Ingredient } | null,
    snapshotIngredient: Ingredient | undefined,
    label: 'A' | 'B',
  ) => {
    if (slot) {
      return <img src={ICON[slot.ingredient]} alt={slot.ingredient} width={42} height={42} style={{ objectFit: 'contain' }} />
    }
    if (snapshotIngredient) {
      const wedgeDeg = (1 - consumeProgress) * 360
      return (
        <div style={{ position: 'relative', width: 42, height: 42 }}>
          <img src={ICON[snapshotIngredient]} alt={snapshotIngredient} width={42} height={42} style={{ objectFit: 'contain' }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `conic-gradient(from 0deg, rgba(0,0,0,0.85) 0deg, rgba(0,0,0,0.85) ${wedgeDeg}deg, transparent ${wedgeDeg}deg)`,
            pointerEvents: 'none',
          }} />
        </div>
      )
    }
    return label
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={slotStyle(slotA !== null || consumeSnapshot !== null)}>
          {renderSlotContent(slotA, consumeSnapshot?.slotA, 'A')}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>+</span>
        <div style={slotStyle(slotB !== null || consumeSnapshot !== null)}>
          {renderSlotContent(slotB, consumeSnapshot?.slotB, 'B')}
        </div>
      </div>

      {spellPreview && (
        <div style={{ fontSize: '12px', color: '#fcd34d', fontWeight: 'bold' }}>
          = {spellPreview}
        </div>
      )}

      <button
        onClick={handleCook}
        disabled={!ready}
        style={{
          padding: '8px 20px', border: 'none', borderRadius: '6px', fontWeight: 'bold',
          fontSize: '13px', cursor: ready ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
          background: ready ? '#f59e0b' : 'rgba(255,255,255,0.1)',
          color: ready ? 'white' : 'rgba(255,255,255,0.3)',
          boxShadow: ready ? '0 0 12px rgba(245,158,11,0.6)' : 'none',
          fontFamily: 'inherit',
        }}
      >
        COOK [Space]
      </button>

      {/* Cooldown bar */}
      {cooldownProgress < 1 && cookCooldown > 0 && (
        <div style={{
          width: '100px', height: '4px', background: 'rgba(255,255,255,0.1)',
          borderRadius: '2px', overflow: 'hidden',
        }}>
          <div style={{
            width: `${cooldownProgress * 100}%`, height: '100%',
            background: '#f59e0b', borderRadius: '2px',
            transition: 'width 0.03s linear',
          }} />
        </div>
      )}
    </div>
  )
}
