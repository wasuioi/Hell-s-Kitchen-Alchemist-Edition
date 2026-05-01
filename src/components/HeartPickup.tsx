import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { Position } from '../types'

interface Props {
  position: Position
}

// Single in-world heart pickup. Bobs up and down + slowly rotates so it
// reads as a "thing to grab" rather than scenery. The actual collision /
// pickup logic lives in HeartPickupManager.
export default function HeartPickup({ position }: Props) {
  const meshRef = useRef<Mesh>(null)

  useFrame((_state, dt) => {
    if (!meshRef.current) return
    const t = performance.now() / 1000
    meshRef.current.position.y = 0.6 + Math.sin(t * 3) * 0.15
    meshRef.current.rotation.y += dt * 1.2
  })

  return (
    <mesh
      ref={meshRef}
      position={[position.x, 0.6, position.z]}
      castShadow
    >
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshStandardMaterial
        color="#ff3355"
        emissive="#ff3355"
        emissiveIntensity={1.5}
      />
    </mesh>
  )
}
