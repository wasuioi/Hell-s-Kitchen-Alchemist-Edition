import { useState, useEffect } from 'react'
import { useDeckStore } from '../stores/deckStore'
import { useGameStore } from '../stores/gameStore'
import { getRecipe } from '../data/recipes'
import { castSpell } from '../utils/castSpell'
import type { Ingredient } from '../types'

const ICON: Record<Ingredient, string> = { CHILI: '🌶️', BOTTLE: '🧴', SALT: '🧂' }

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={slotStyle(slotA !== null)}>
          {slotA ? ICON[slotA] : 'A'}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>+</span>
        <div style={slotStyle(slotB !== null)}>
          {slotB ? ICON[slotB] : 'B'}
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
