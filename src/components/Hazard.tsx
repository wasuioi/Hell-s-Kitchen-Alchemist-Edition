import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HAZARD_DEFS } from '../data/hazards'
import type { Hazard as HazardType } from '../types'

// Renders a single environmental hazard. Two visual phases:
// - Telegraph (first telegraphMs): pulsing colored ring on the floor; no damage.
// - Active (next activeMs): flat emissive disc with flicker; damage handled in
//   HazardManager so the visual stays decoupled from the collision logic.
//
// Procedural Three.js geometry only — no PNG/MP4 assets.
export default function Hazard({ hazard }: { hazard: HazardType }) {
  const def = HAZARD_DEFS[hazard.type]
  const telegraphRingRef = useRef<THREE.Mesh>(null!)
  const activeDiscRef = useRef<THREE.Mesh>(null!)
  const activeMatRef = useRef<THREE.MeshStandardMaterial>(null!)

  useFrame(() => {
    const elapsed = performance.now() - hazard.spawnedAt
    const inTelegraph = elapsed < def.telegraphMs
    const telegraphProgress = Math.min(1, elapsed / def.telegraphMs)
    const activeElapsed = Math.max(0, elapsed - def.telegraphMs)
    const activeProgress = Math.min(1, activeElapsed / def.activeMs)

    // Telegraph: ring scales from 1.1 → 1.0 of radius, pulses opacity. Hidden once active starts.
    if (telegraphRingRef.current) {
      const mat = telegraphRingRef.current.material as THREE.MeshBasicMaterial
      if (inTelegraph) {
        telegraphRingRef.current.visible = true
        // Pulse 2x per second, plus a global "ramp toward live" so the warning intensifies.
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(elapsed * 0.012))
        mat.opacity = pulse * (0.5 + 0.5 * telegraphProgress)
      } else {
        telegraphRingRef.current.visible = false
      }
    }

    // Active: disc fades in over first 200ms, holds, fades out over last 400ms.
    // Emissive intensity flickers so the floor-fire reads as a live flame.
    if (activeDiscRef.current && activeMatRef.current) {
      activeDiscRef.current.visible = !inTelegraph
      if (!inTelegraph) {
        const fadeIn = Math.min(1, activeElapsed / 200)
        const fadeOut = activeProgress > 0.9 ? (1 - activeProgress) / 0.1 : 1
        const baseAlpha = fadeIn * fadeOut
        const flicker = 0.85 + 0.15 * Math.sin(elapsed * 0.04)
        activeMatRef.current.opacity = baseAlpha * flicker
        activeMatRef.current.emissiveIntensity = 1.6 * flicker * baseAlpha
      }
    }
  })

  return (
    <group position={[hazard.position.x, 0.015, hazard.position.z]}>
      {/* Telegraph ring (annulus) — drawn in additive colored mode so it
          reads as a warning glow on the dark floor without lighting the world. */}
      <mesh ref={telegraphRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[def.radius * 0.85, def.radius, 48]} />
        <meshBasicMaterial
          color={def.color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Active fire disc — slightly above floor to avoid z-fight, emissive
          so it glows + faintly lights nearby ground via the floor's normal. */}
      <mesh ref={activeDiscRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[def.radius, 48]} />
        <meshStandardMaterial
          ref={activeMatRef}
          color={def.color}
          emissive={def.color}
          emissiveIntensity={1.6}
          transparent
          opacity={0.9}
          depthWrite={false}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  )
}
