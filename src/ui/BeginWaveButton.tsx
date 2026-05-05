import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import type { WaveTier } from '../types'
import { BOSS_WAVE, PRE_BOSS_LULL_MS } from '../data/waves'

const TIER_LABEL: Record<WaveTier, string> = {
  mild: 'Mild',
  spicy: 'Spicy',
  hellfire: 'Hellfire',
}

export default function BeginWaveButton() {
  const currentWave = useGameStore((s) => s.currentWave)
  const pendingTier = useGameStore((s) => s.pendingTier)
  const isPreBoss = currentWave >= BOSS_WAVE

  const enabled = isPreBoss || pendingTier !== null
  const label = isPreBoss
    ? '▶ Begin Boss Fight'
    : pendingTier
      ? `▶ Begin Wave ${currentWave + 1} (${TIER_LABEL[pendingTier]})`
      : '▶ Begin Wave — choose a tier first'

  function onClick() {
    if (!enabled) return
    useDeckStore.getState().initHand()
    if (isPreBoss) {
      useGameStore.getState().triggerPreBossLull(PRE_BOSS_LULL_MS)
    } else {
      useGameStore.getState().nextWave()
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        padding: '14px 32px', borderRadius: '10px', fontSize: '18px', fontWeight: 'bold',
        fontFamily: 'inherit', letterSpacing: '1px',
        cursor: enabled ? 'pointer' : 'not-allowed',
        background: enabled ? 'linear-gradient(180deg, #f59e0b, #b45309)' : 'rgba(255,255,255,0.08)',
        border: `2px solid ${enabled ? '#fcd34d' : 'rgba(255,255,255,0.15)'}`,
        color: enabled ? '#1a0606' : 'rgba(255,255,255,0.4)',
        boxShadow: enabled ? '0 0 20px rgba(245,158,11,0.5)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}
