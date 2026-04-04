import { useEffect, useRef } from 'react'
import Scene from './components/Scene'
import { useGameStore } from './stores/gameStore'
import { useDeckStore } from './stores/deckStore'
import { castSpell } from './utils/castSpell'
import HUD from './ui/HUD'
import MainMenu from './ui/MainMenu'
import RewardScreen from './ui/RewardScreen'
import DeathScreen from './ui/DeathScreen'
import VictoryScreen from './ui/VictoryScreen'

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const cookCooldown = useRef(0)

  // Keyboard controls
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const p = useGameStore.getState().phase
      if (p !== 'combat' && p !== 'boss') return
      if (e.key === '1' || e.key === 'j') useDeckStore.getState().slotIngredient(0)
      else if (e.key === '2' || e.key === 'k') useDeckStore.getState().slotIngredient(1)
      else if (e.key === '3' || e.key === 'l') useDeckStore.getState().slotIngredient(2)
      else if (e.key === ' ') {
        e.preventDefault()
        const now = performance.now() / 1000
        const fastPrepStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'fast_prep')?.stackCount || 0
        const baseCooldown = Math.max(0.2, 1.5 - fastPrepStacks * 0.5)
        if (now - cookCooldown.current < baseCooldown) return
        const spell = useDeckStore.getState().cook()
        if (!spell) return
        cookCooldown.current = now
        useDeckStore.getState().setCookCooldown(now, baseCooldown)
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
      {phase === 'victory' && <VictoryScreen />}
    </div>
  )
}
