import { lazy, Suspense, useEffect, useRef } from 'react'
import { useGameStore } from './stores/gameStore'
import { useDeckStore } from './stores/deckStore'
import { usePlayerStore } from './stores/playerStore'
import { castSpell } from './utils/castSpell'
import { preloadGameAssets } from './utils/preloadAssets'
import HUD from './ui/HUD'
import MainMenu from './ui/MainMenu'
import RewardScreen from './ui/RewardScreen'
import DeathScreen from './ui/DeathScreen'
import VictoryScreen from './ui/VictoryScreen'
import DebugPanel from './ui/DebugPanel'
import VfxPicker from './ui/VfxPicker'
import DevPanel from './ui/DevPanel'

// Scene pulls in Three.js + react-three-fiber + drei (~1 MB gzipped). Lazy-
// load it so the MainMenu — pure DOM UI — renders the instant React mounts,
// while the 3D engine downloads in the background. By the time the player
// clicks "Start" it's already cached.
const Scene = lazy(() => import('./components/Scene'))

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const cookCooldown = useRef(0)

  // Warm caches for icons + VFX sprites so the first reward/trigger doesn't
  // flicker. Runs once on mount.
  useEffect(() => {
    preloadGameAssets()
  }, [])

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
      else if (e.key === 'Shift') {
        const ps = usePlayerStore.getState()
        if (ps.isDashing || ps.status === 'stunned') return
        if (performance.now() < ps.dashCooldownUntil) return
        // Calculate dash direction: use current movement keys or fall back to rotation
        let dx = 0, dz = 0
        const playerKeys = (window as Window & { __playerKeys?: Record<string, boolean> }).__playerKeys
        if (playerKeys) {
          if (playerKeys['w'] || playerKeys['arrowup']) dz -= 1
          if (playerKeys['s'] || playerKeys['arrowdown']) dz += 1
          if (playerKeys['a'] || playerKeys['arrowleft']) dx -= 1
          if (playerKeys['d'] || playerKeys['arrowright']) dx += 1
        }
        if (dx === 0 && dz === 0) {
          // Fall back to rotation (Player.setRotation = atan2(dx, dz), so dz = cos)
          dx = Math.sin(ps.rotation)
          dz = Math.cos(ps.rotation)
        }
        const len = Math.sqrt(dx * dx + dz * dz)
        ps.startDash({ x: dx / len, z: dz / len })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>

      {phase === 'menu' && <MainMenu />}

      {(phase === 'combat' || phase === 'boss') && <HUD />}
      {phase === 'reward' && <RewardScreen />}
      {phase === 'death' && <DeathScreen />}
      {phase === 'victory' && <VictoryScreen />}
      <DebugPanel />
      <VfxPicker />
      {import.meta.env.DEV && <DevPanel />}
    </div>
  )
}
