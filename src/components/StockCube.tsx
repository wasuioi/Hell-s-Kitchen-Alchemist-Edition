import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { StockCube as StockCubeType } from '../types'

const STOCK_CUBE_MODEL_PATH = '/models/stock_cube/scene.glb'
const HOVER_HEIGHT = 0.85
const BOB_AMPLITUDE = 0.12
const BOB_FREQUENCY = 1.6   // Hz
const SPIN_SPEED = 0.7      // rad/s

// Single Bonemeal Stock cube — loads the .glb once (drei caches), clones
// per-instance so each cube gets its own scene graph for transform, then
// idles with a slow Y bob + Y spin to draw the eye.
export default function StockCube({ cube }: { cube: StockCubeType }) {
  const { scene } = useGLTF(STOCK_CUBE_MODEL_PATH)
  // Clone so multiple cubes don't share transforms.
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    if (!groupRef.current) return
    const t = (performance.now() - cube.spawnedAt) / 1000
    groupRef.current.position.y = HOVER_HEIGHT + Math.sin(t * BOB_FREQUENCY * Math.PI * 2) * BOB_AMPLITUDE
    groupRef.current.rotation.y = t * SPIN_SPEED
  })

  return (
    <group position={[cube.position.x, 0, cube.position.z]}>
      {/* Floor glow disc — draws the eye downward to the cube even if the
          model is small. Pure additive yellow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="#ffd060" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <group ref={groupRef} position={[0, HOVER_HEIGHT, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  )
}

useGLTF.preload(STOCK_CUBE_MODEL_PATH)
