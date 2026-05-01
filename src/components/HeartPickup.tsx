import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Group } from 'three'
import type { Position } from '../types'

const HEART_MODEL_PATH = '/models/heart/heart.glb'

interface Props {
  position: Position
}

// Single in-world heart pickup. Bobs up and down + slowly rotates so it
// reads as a "thing to grab" rather than scenery. The actual collision /
// pickup logic lives in HeartPickupManager.
export default function HeartPickup({ position }: Props) {
  const groupRef = useRef<Group>(null)
  const { scene } = useGLTF(HEART_MODEL_PATH)
  // Clone per-instance so multiple hearts on screen don't share / fight
  // over the same Object3D transform.
  const heartModel = useMemo(() => scene.clone(true), [scene])

  useFrame((_state, dt) => {
    if (!groupRef.current) return
    const t = performance.now() / 1000
    groupRef.current.position.y = 0.6 + Math.sin(t * 3) * 0.15
    groupRef.current.rotation.y += dt * 1.2
  })

  return (
    <group ref={groupRef} position={[position.x, 0.6, position.z]}>
      <primitive object={heartModel} scale={0.6} />
      <pointLight color="#ff3355" intensity={4} distance={3} position={[0, 0.4, 0]} />
    </group>
  )
}

useGLTF.preload(HEART_MODEL_PATH)
