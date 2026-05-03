import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
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
import DevPanel from './ui/DevPanel'

// Scene pulls in Three.js + react-three-fiber + drei (~310 KB gzipped). Lazy-
// load it so the MainMenu — pure DOM UI — renders the instant React mounts,
// while the 3D engine downloads in the background. By the time the player
// clicks "Start" it's already cached.
const Scene = lazy(() => import('./components/Scene'))

function MapLoadingOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fbbf24',
        font: '600 18px/1 system-ui, -apple-system, sans-serif',
        letterSpacing: '2px',
        background: '#0a0a0a',
        zIndex: 5,
      }}
    >
      Loading map…
    </div>
  )
}

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const cookCooldown = useRef(0)
  // Flips true the moment the lazy Scene chunk has loaded and Scene's tree
  // has mounted. Gates the HUD + rest-room screen so the cauldron and cards
  // don't show up over a still-blank canvas while the player waits for
  // models to come in on a slow link.
  const [sceneReady, setSceneReady] = useState(false)
  const handleSceneReady = useCallback(() => setSceneReady(true), [])

  // Warm caches for icons + VFX sprites the first time the player enters
  // combat. Deferred from app mount because on slow connections the
  // 14-asset parallel preload was saturating bandwidth and stalling the
  // initial menu paint. By the time the player chooses to start, they
  // can spare a few hundred ms of background fetches.
  const preloadFiredRef = useRef(false)
  useEffect(() => {
    if (preloadFiredRef.current) return
    if (phase === 'combat' || phase === 'rest') {
      preloadFiredRef.current = true
      preloadGameAssets()
    }
  }, [phase])

  // While the menu is up, eagerly start downloading the heavy Scene chunk
  // (Three.js / R3F / drei) and the player + slime model so that when the
  // user finally clicks Start, those bytes are mostly cached. Boss model
  // is intentionally NOT prefetched here — players take 5+ minutes to
  // reach wave 7, plenty of time to fetch it later.
  useEffect(() => {
    import('./components/Scene')
    const opts = { priority: 'low' } as RequestInit
    fetch('/models/wizard/Wizard.glb', opts).catch(() => undefined)
    fetch('/models/slime/scene.glb', opts).catch(() => undefined)
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
        <Scene onReady={handleSceneReady} />
      </Suspense>

      {/* Loading overlay only shows AFTER the user clicks Start and the
          map / models still aren't in. Stays hidden on the menu. */}
      {phase !== 'menu' && !sceneReady && <MapLoadingOverlay />}

      {phase === 'menu' && <MainMenu />}

      {/* Cauldron + ingredient cards (HUD) and rest-room screen wait for
          sceneReady so they don't appear over a blank world. */}
      {(phase === 'combat' || phase === 'boss' || phase === 'pre-boss-lull') && sceneReady && <HUD />}
      {phase === 'rest' && sceneReady && <RewardScreen />}
      {phase === 'death' && <DeathScreen />}
      {phase === 'victory' && <VictoryScreen />}
      {import.meta.env.DEV && <DevPanel />}
    </div>
  )
}
