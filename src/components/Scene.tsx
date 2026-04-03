import { Canvas } from '@react-three/fiber'
import Arena from './Arena'
import Camera from './Camera'
import Player from './Player'
import EnemyManager from './EnemyManager'

export default function Scene() {
  return (
    <Canvas shadows>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <Camera />
      <Arena />
      <Player />
      <EnemyManager />
    </Canvas>
  )
}
