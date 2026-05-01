import { useState, useEffect } from 'react'
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
  const primedCastsRemaining = useDeckStore((s) => s.primedCastsRemaining)
  const { slotA, slotB } = cauldron
  const ready = slotA !== null && slotB !== null

  const [cooldownProgress, setCooldownProgress] = useState(0)

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

  const spellPreview = ready
    ? (SPELL_LABELS[getRecipe(slotA!, slotB!)] ?? getRecipe(slotA!, slotB!))
    : null

  function handleCook() {
    if (!ready) return
    const now = performance.now() / 1000
    const deckState = useDeckStore.getState()
    const fastPrepStacks = deckState.activePerks.find((p) => p.id === 'fast_prep')?.stackCount || 0
    const fc = deckState.activePerks.find((p) => p.id === 'first_course')
    const fcTier = fc ? Math.min(fc.stackCount, 3) : 0
    const fcReduction = fcTier >= 2 && deckState.primedCastsRemaining > 0 ? 0.3 : 0
    const baseCooldown = Math.max(0.2, 1.5 - fastPrepStacks * 0.5 - fcReduction)
    if (cookCooldown > 0 && now - cookCooldown < baseCooldown) return
    const spell = deckState.cook()
    if (!spell) return
    deckState.setCookCooldown(now, baseCooldown)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={slotStyle(slotA !== null)}>
          {slotA ? <img src={ICON[slotA]} alt={slotA} width={42} height={42} style={{ objectFit: 'contain' }} /> : 'A'}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>+</span>
        <div style={slotStyle(slotB !== null)}>
          {slotB ? <img src={ICON[slotB]} alt={slotB} width={42} height={42} style={{ objectFit: 'contain' }} /> : 'B'}
        </div>
      </div>

      {spellPreview && (
        <div style={{ fontSize: '12px', color: '#fcd34d', fontWeight: 'bold' }}>
          = {spellPreview}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
        {primedCastsRemaining > 0 && (
          <span style={{
            fontSize: '12px', fontWeight: 'bold', color: '#fbbf24',
            background: 'rgba(251,191,36,0.15)', borderRadius: '4px', padding: '2px 6px',
            border: '1px solid rgba(251,191,36,0.4)',
          }}>
            🔔 {primedCastsRemaining}
          </span>
        )}
      </div>

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
