import { useState, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { drawPerksWithRarity, MAX_PERK_TIER, RARITY_COLOR } from '../data/perks'
import type { PerkDefinition } from '../data/perks'
import PerkIcon from './PerkIcon'
import TierDots from './TierDots'
import TierDiff from './TierDiff'

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

type Corner = { v: 'top' | 'bottom'; h: 'left' | 'right' }
const CORNERS: Corner[] = [
  { v: 'top', h: 'left' },
  { v: 'top', h: 'right' },
  { v: 'bottom', h: 'left' },
  { v: 'bottom', h: 'right' },
]

export default function RewardScreen() {
  const currentWave = useGameStore((s) => s.currentWave)
  const activePerks = useDeckStore((s) => s.activePerks)
  const [perks, setPerks] = useState<PerkDefinition[]>(() => drawPerksWithRarity(3))
  const [rerollsLeft, setRerollsLeft] = useState(1)
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 })
  const dragState = useRef<{ startMx: number; startMy: number; startPx: number; startPy: number } | null>(null)

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

  function handleHeaderMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragState.current = {
      startMx: e.clientX, startMy: e.clientY,
      startPx: panelPos.x, startPy: panelPos.y,
    }
  }

  function handleOverlayMouseMove(e: React.MouseEvent) {
    if (!dragState.current) return
    setPanelPos({
      x: dragState.current.startPx + e.clientX - dragState.current.startMx,
      y: dragState.current.startPy + e.clientY - dragState.current.startMy,
    })
  }

  function stopDrag() { dragState.current = null }

  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex',
        background: 'rgba(0,0,0,0.78)', zIndex: 20,
        alignItems: 'center', justifyContent: 'center',
      }}
      onMouseMove={handleOverlayMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transform: `translate(${panelPos.x}px, ${panelPos.y}px)`,
          userSelect: 'none',
        }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleHeaderMouseDown}
          style={{ cursor: 'grab', textAlign: 'center', marginBottom: '32px', width: '100%' }}
        >
          <h1 style={{ color: '#fcd34d', fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
            WAVE {currentWave} CLEARED!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px' }}>
            Choose a perk to upgrade your kitchen
          </p>
        </div>

        <div style={{ display: 'flex', gap: '24px' }}>
          {perks.map((perk) => {
            const rarityColor = RARITY_COLOR[perk.rarity]
            const isHovered = hoveredId === perk.id
            const curTier = currentTierFor(perk.id)

            return (
              <button
                key={perk.id}
                onClick={() => pickPerk(perk)}
                onMouseEnter={() => setHoveredId(perk.id)}
                onMouseLeave={() => setHoveredId((id) => (id === perk.id ? null : id))}
                style={{
                  position: 'relative',
                  width: '200px', height: '340px',
                  background: 'linear-gradient(175deg, #1e1510 0%, #0d0905 100%)',
                  border: `2px solid ${isHovered ? rarityColor : withAlpha(rarityColor, 0.5)}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: isHovered
                    ? `0 0 40px ${withAlpha(rarityColor, 0.5)}, 0 20px 40px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.4)`
                    : '0 8px 24px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.4)',
                  transform: isHovered ? 'translateY(-10px) scale(1.03)' : 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                  padding: 0,
                  color: 'white',
                  textAlign: 'left',
                }}
              >
                {/* Inner frame border */}
                <div style={{
                  position: 'absolute', inset: '5px',
                  border: `1px solid ${withAlpha(rarityColor, 0.25)}`,
                  borderRadius: '8px',
                  pointerEvents: 'none', zIndex: 3,
                }} />

                {/* Corner ornaments */}
                {CORNERS.map(({ v, h }) => (
                  <div
                    key={`${v}-${h}`}
                    style={{
                      position: 'absolute',
                      top: v === 'top' ? '3px' : undefined,
                      bottom: v === 'bottom' ? '3px' : undefined,
                      left: h === 'left' ? '3px' : undefined,
                      right: h === 'right' ? '3px' : undefined,
                      width: '14px', height: '14px',
                      borderTop: v === 'top' ? `2px solid ${rarityColor}` : 'none',
                      borderBottom: v === 'bottom' ? `2px solid ${rarityColor}` : 'none',
                      borderLeft: h === 'left' ? `2px solid ${rarityColor}` : 'none',
                      borderRight: h === 'right' ? `2px solid ${rarityColor}` : 'none',
                      borderRadius: v === 'top'
                        ? (h === 'left' ? '4px 0 0 0' : '0 4px 0 0')
                        : (h === 'left' ? '0 0 0 4px' : '0 0 4px 0'),
                      pointerEvents: 'none', zIndex: 4,
                      opacity: isHovered ? 1 : 0.7,
                      transition: 'opacity 0.2s',
                    }}
                  />
                ))}

                {/* Rarity header */}
                <div style={{
                  background: `linear-gradient(135deg, ${withAlpha(rarityColor, 0.45)}, ${withAlpha(rarityColor, 0.12)})`,
                  borderBottom: `1px solid ${withAlpha(rarityColor, 0.45)}`,
                  padding: '10px 16px',
                  textAlign: 'center', flexShrink: 0,
                  position: 'relative', zIndex: 2,
                }}>
                  <span style={{
                    fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase',
                    color: rarityColor, fontWeight: 'bold',
                  }}>
                    {perk.rarity}
                  </span>
                </div>

                {/* Art window */}
                <div style={{
                  background: `radial-gradient(ellipse at 50% 40%, ${withAlpha(rarityColor, 0.18)} 0%, rgba(0,0,0,0.55) 70%)`,
                  borderBottom: `1px solid ${withAlpha(rarityColor, 0.2)}`,
                  padding: '22px 16px',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  flexShrink: 0, position: 'relative', zIndex: 2,
                }}>
                  <PerkIcon icon={perk.icon} size={72} />
                </div>

                {/* Name bar */}
                <div style={{
                  padding: '10px 14px 8px',
                  borderBottom: `1px solid ${withAlpha(rarityColor, 0.18)}`,
                  textAlign: 'center', flexShrink: 0, position: 'relative', zIndex: 2,
                }}>
                  <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{perk.name}</span>
                </div>

                {/* Description */}
                <div style={{
                  flex: 1, padding: '10px 14px 6px',
                  display: 'flex', flexDirection: 'column',
                  position: 'relative', zIndex: 2,
                  overflow: 'hidden', fontSize: '12px',
                }}>
                  <TierDiff perk={perk} currentTier={curTier} />
                </div>

                {/* Tier footer */}
                <div style={{
                  borderTop: `1px solid ${withAlpha(rarityColor, 0.22)}`,
                  background: withAlpha(rarityColor, 0.08),
                  padding: '10px 14px',
                  display: 'flex', justifyContent: 'center',
                  flexShrink: 0, position: 'relative', zIndex: 2,
                }}>
                  <TierDots
                    current={curTier}
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
          width: '100%', justifyContent: 'space-between', alignItems: 'center',
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
    </div>
  )
}
