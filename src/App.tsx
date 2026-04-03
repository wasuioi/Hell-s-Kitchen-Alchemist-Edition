import { useEffect, useRef } from 'react'
import Scene from './components/Scene'
import { useGameStore } from './stores/gameStore'
import { useDeckStore } from './stores/deckStore'
import { castSpell } from './utils/castSpell'
import HUD from './ui/HUD'
import RewardScreen from './ui/RewardScreen'
import DeathScreen from './ui/DeathScreen'

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const prevPhase = useRef<string>('menu')

  // Init hand when entering combat phase
  useEffect(() => {
    if ((phase === 'combat' || phase === 'boss') && prevPhase.current === 'menu') {
      useDeckStore.getState().initHand()
    }
    prevPhase.current = phase
  }, [phase])

  // Keyboard controls
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const p = useGameStore.getState().phase
      if (p !== 'combat' && p !== 'boss') return
      if (e.key === '1') useDeckStore.getState().slotIngredient(0)
      else if (e.key === '2') useDeckStore.getState().slotIngredient(1)
      else if (e.key === '3') useDeckStore.getState().slotIngredient(2)
      else if (e.key === ' ') {
        e.preventDefault()
        const spell = useDeckStore.getState().cook()
        if (!spell) return
        useGameStore.getState().recordIngredientUsed()
        useGameStore.getState().recordIngredientUsed()
        useGameStore.getState().recordSpellCast(spell)
        castSpell(spell)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Scene />

      {phase === 'menu' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
          <button
            onClick={() => {
              useDeckStore.getState().initHand()
              useGameStore.getState().startShift()
            }}
            style={{ padding: '16px 32px', fontSize: '24px', background: '#f59e0b', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
          >
            START SHIFT
          </button>
        </div>
      )}

      {(phase === 'combat' || phase === 'boss') && <HUD />}
      {phase === 'reward' && <RewardScreen />}
      {phase === 'death' && <DeathScreen />}
    </div>
  )
}
