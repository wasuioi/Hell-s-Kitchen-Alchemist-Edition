import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useGameStore } from '../stores/gameStore'
import Arena from './Arena'
import Camera from './Camera'
import Player from './Player'
import EnemyManager from './EnemyManager'
import SpellManager from './Spell'
import Boss from './Boss'
import DamageNumbers from './DamageNumbers'
import GroundCracks from './GroundCracks'
import ExplosionEffects from './ExplosionEffect'
import SpriteVfxEffects from './SpriteVfxEffect'

export default function Scene({ onReady }: { onReady?: () => void }) {
  const phase = useGameStore((s) => s.phase)
  const isDead = phase === 'death'

  // Fire once Scene's React tree has mounted — i.e. the lazy chunk finished
  // downloading and React rendered the canvas root. Used by App.tsx to flip
  // a `sceneReady` flag that gates HUD visibility behind the loading overlay.
  useEffect(() => { onReady?.() }, [onReady])

  return (
    <div style={{ width: '100%', height: '100%', background: '#1a1612', filter: isDead ? 'grayscale(100%)' : 'none', transition: 'filter 1s ease' }}>
      <Canvas shadows>
        {/* Scene clear color — keeps the canvas from flashing pure black on
            first frame / between renders before lighting kicks in. */}
        <color attach="background" args={['#1a1612']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
        <Camera />
        <Arena />
        <GroundCracks />
        <Player />
        <EnemyManager />
        <SpellManager />
        <DamageNumbers />
        <ExplosionEffects />
        <SpriteVfxEffects />
        {/* Pre-load drei Text font to prevent black flash on first damage number */}
        <Suspense fallback={null}>
          <Text position={[0, -100, 0]} fontSize={0.1}>.</Text>
        </Suspense>
        <Boss />
      </Canvas>
    </div>
  )
}
