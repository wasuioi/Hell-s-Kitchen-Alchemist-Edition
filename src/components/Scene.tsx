import { Suspense } from 'react'
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

export default function Scene() {
  const phase = useGameStore((s) => s.phase)
  const isDead = phase === 'death'

  return (
    <div style={{ width: '100%', height: '100%', filter: isDead ? 'grayscale(100%)' : 'none', transition: 'filter 1s ease' }}>
      <Canvas shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
        <Camera />
        <Arena />
        <GroundCracks />
        <Player />
        <EnemyManager />
        <SpellManager />
        <DamageNumbers />
        {/* Pre-load drei Text font to prevent black flash on first damage number */}
        <Suspense fallback={null}>
          <Text position={[0, -100, 0]} fontSize={0.1}>.</Text>
        </Suspense>
        <Boss />
      </Canvas>
    </div>
  )
}
