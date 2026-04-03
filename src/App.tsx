import { useEffect } from 'react'
import Scene from './components/Scene'
import { useGameStore } from './stores/gameStore'
import { useDeckStore } from './stores/deckStore'
import { castSpell } from './utils/castSpell'
import HUD from './ui/HUD'
import MainMenu from './ui/MainMenu'
import RewardScreen from './ui/RewardScreen'
import DeathScreen from './ui/DeathScreen'

export default function App() {
  const phase = useGameStore((s) => s.phase)

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

      {phase === 'menu' && <MainMenu />}

      {(phase === 'combat' || phase === 'boss') && <HUD />}
      {phase === 'reward' && <RewardScreen />}
      {phase === 'death' && <DeathScreen />}
    </div>
  )
}
