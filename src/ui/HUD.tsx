import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import { MAX_PERK_TIER } from '../data/perks'
import { getRecipe, SPELL_LABELS, INGREDIENT_ICONS } from '../data/recipes'
import type { Ingredient } from '../types'
import CardHand from './CardHand'
import CauldronUI from './CauldronUI'
import ScreenFlash from './ScreenFlash'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'

function hpColor(ratio: number): string {
  if (ratio > 0.5) return '#22c55e'
  if (ratio > 0.2) return '#fcd34d'
  return '#ef4444'
}

const RECIPES: Array<[Ingredient, Ingredient]> = [
  ['CHILI', 'CHILI'],
  ['BOTTLE', 'BOTTLE'],
  ['SALT', 'SALT'],
  ['CHILI', 'BOTTLE'],
  ['CHILI', 'SALT'],
  ['BOTTLE', 'SALT'],
]

export default function HUD() {
  const currentWave = useGameStore((s) => s.currentWave)
  const stats = useGameStore((s) => s.stats)
  const activePerks = useDeckStore((s) => s.activePerks)
  const dashCooldownUntil = usePlayerStore((s) => s.dashCooldownUntil)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)
  const speedBuffUntil = usePlayerStore((s) => s.speedBuffUntil)

  // Update dash cooldown display on an interval (avoids performance.now() in render)
  const [dashReady, setDashReady] = useState(true)
  const [dashProgress, setDashProgress] = useState(100)
  const [speedBuffSecondsLeft, setSpeedBuffSecondsLeft] = useState(0)
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, dashCooldownUntil - performance.now())
      setDashProgress(Math.max(0, Math.min(100, (1 - remaining / 2500) * 100)))
      setDashReady(remaining <= 0)
      const buffMs = Math.max(0, speedBuffUntil - performance.now())
      setSpeedBuffSecondsLeft(buffMs / 1000)
    }
    update()
    const interval = setInterval(update, 50)
    return () => clearInterval(interval)
  }, [dashCooldownUntil, speedBuffUntil])

  return (
    <>
      {/* Top-left: wave info */}
      <div style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '10px 16px',
        color: 'white', fontWeight: 'bold',
      }}>
        <div style={{ fontSize: '14px', letterSpacing: '1px' }}>
          SHIFT 1 — WAVE {currentWave}/7
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
          Enemies defeated: {stats.enemiesDefeated}
        </div>
        <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>❤️ HP:</span>
          <span style={{ color: hpColor(hp / maxHp), fontWeight: 'bold' }}>
            {hp} / {maxHp}
          </span>
        </div>
      </div>

      {/* Left side: recipe book */}
      <div style={{
        position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
        zIndex: 10, padding: '12px 16px',
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px',
        border: '1px solid rgba(245, 158, 11, 0.25)',
      }}>
        <div style={{
          color: '#fbbf24', fontSize: '10px', fontWeight: 'bold',
          letterSpacing: '2px', textAlign: 'center', marginBottom: '8px',
        }}>
          RECIPES
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          color: '#d1d5db', fontSize: '11px',
        }}>
          {RECIPES.map(([a, b]) => (
            <div key={`${a}+${b}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <img src={INGREDIENT_ICONS[a]} alt={a} width={18} height={18} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>+</span>
              <img src={INGREDIENT_ICONS[b]} alt={b} width={18} height={18} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>=</span>
              <span style={{ color: '#fcd34d', fontWeight: 'bold' }}>
                {SPELL_LABELS[getRecipe(a, b)] ?? getRecipe(a, b)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top-right: active perks */}
      {activePerks.length > 0 && (
        <div style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 10,
          background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '10px 16px',
          color: 'white', display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {activePerks.map((perk) => (
            <div key={perk.id} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PerkIcon icon={perk.icon} size={16} />
              <span>{perk.name}</span>
              <TierDots current={Math.min(perk.stackCount, MAX_PERK_TIER)} size="small" />
              {perk.stackCount > MAX_PERK_TIER && (
                <span style={{ color: '#fcd34d', fontWeight: 'bold', fontSize: '10px' }}>+{perk.stackCount - MAX_PERK_TIER}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom: card hand + cauldron */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', alignItems: 'flex-end', gap: '24px',
        background: 'rgba(0,0,0,0.5)', borderRadius: '12px', padding: '16px',
      }}>
        <CardHand />
        <CauldronUI />
      </div>
      {/* Dash cooldown indicator */}
      <div style={{
        position: 'absolute', bottom: '24px', right: '24px', zIndex: 10,
        background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '8px 12px',
        color: 'white', fontSize: '12px', fontWeight: 'bold',
      }}>
        <div>DASH [Shift]</div>
        <div style={{
          width: '60px', height: '4px', background: '#333', borderRadius: '2px',
          marginTop: '4px', overflow: 'hidden',
        }}>
          <div style={{
            width: `${dashProgress}%`,
            height: '100%',
            background: dashReady ? '#22c55e' : '#6b7280',
            borderRadius: '2px',
            transition: 'width 0.1s',
          }} />
        </div>
      </div>
      {/* Speed buff indicator */}
      {speedBuffSecondsLeft > 0 && (
        <div style={{
          position: 'absolute', bottom: '70px', right: '24px', zIndex: 10,
          background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '6px 10px',
          color: 'white', fontSize: '18px', fontWeight: 'bold',
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 0 8px rgba(34,197,94,0.6)',
        }}>
          <span>👟</span>
          <span style={{ color: '#22c55e', fontSize: '16px' }}>↑</span>
          <span style={{ color: '#22c55e', fontSize: '13px', minWidth: '28px' }}>{speedBuffSecondsLeft.toFixed(1)}s</span>
        </div>
      )}
      <ScreenFlash />
    </>
  )
}
