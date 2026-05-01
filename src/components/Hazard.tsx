import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HAZARD_DEFS } from '../data/hazards'
import type { Hazard as HazardType } from '../types'

// Renders a single environmental hazard. Two visual phases:
// - Telegraph (first telegraphMs): pulsing colored ring on the floor; no damage.
// - Active (next activeMs): flat emissive disc with flicker + lava-style
//   bubbles bursting out of the surface. Damage handled in HazardManager so
//   the visual stays decoupled from the collision logic.
//
// Procedural Three.js geometry only — no PNG/MP4 assets.

const BUBBLE_COUNT = 6
const BUBBLE_LIFETIME_MS = 700

interface BubbleSlot {
  meshRef: React.RefObject<THREE.Mesh | null>
  matRef: React.RefObject<THREE.MeshStandardMaterial | null>
  x: number
  z: number
  birthAt: number
}

function pickBubblePosition(maxRadius: number) {
  const angle = Math.random() * Math.PI * 2
  // sqrt for uniform area distribution. 0.85 keeps bubbles inside the visible disc.
  const r = Math.sqrt(Math.random()) * maxRadius * 0.85
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r }
}

export default function Hazard({ hazard }: { hazard: HazardType }) {
  const def = HAZARD_DEFS[hazard.type]
  const telegraphRingRef = useRef<THREE.Mesh>(null!)
  const activeDiscRef = useRef<THREE.Mesh>(null!)
  const activeMatRef = useRef<THREE.MeshStandardMaterial>(null!)

  // Pool of bubble slots. Each slot has its own mesh ref so we can mutate
  // transform/material every frame without re-rendering React. Initial
  // birthAt is staggered across the lifetime so the first frame doesn't
  // bloom them all together.
  const bubbles = useMemo<BubbleSlot[]>(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, i) => {
        const pos = pickBubblePosition(def.radius)
        return {
          meshRef: { current: null },
          matRef: { current: null },
          x: pos.x,
          z: pos.z,
          birthAt: -((i / BUBBLE_COUNT) * BUBBLE_LIFETIME_MS),
        }
      }),
    [def.radius],
  )

  // Bubble color = brighter, more yellow than the disc base — reads as hot.
  const bubbleColor = useMemo(() => {
    const c = new THREE.Color(def.color)
    c.lerp(new THREE.Color('#ffd060'), 0.45)
    return c
  }, [def.color])

  useFrame(() => {
    const now = performance.now()
    const elapsed = now - hazard.spawnedAt
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
    let baseAlpha = 0
    if (activeDiscRef.current && activeMatRef.current) {
      activeDiscRef.current.visible = !inTelegraph
      if (!inTelegraph) {
        const fadeIn = Math.min(1, activeElapsed / 200)
        const fadeOut = activeProgress > 0.9 ? (1 - activeProgress) / 0.1 : 1
        baseAlpha = fadeIn * fadeOut
        const flicker = 0.85 + 0.15 * Math.sin(elapsed * 0.04)
        activeMatRef.current.opacity = baseAlpha * flicker
        activeMatRef.current.emissiveIntensity = 1.6 * flicker * baseAlpha
      }
    }

    // Bubbles only animate during the active phase. While telegraphing, force them invisible.
    for (const slot of bubbles) {
      const mesh = slot.meshRef.current
      const mat = slot.matRef.current
      if (!mesh || !mat) continue
      if (inTelegraph) {
        mesh.visible = false
        // Reset birth so the first cycle starts fresh when active begins.
        slot.birthAt = now + Math.random() * 200
        continue
      }
      const ageMs = now - slot.birthAt
      if (ageMs < 0 || ageMs > BUBBLE_LIFETIME_MS) {
        // Recycle: pick a new spot inside the disc, restart the cycle.
        const pos = pickBubblePosition(def.radius)
        slot.x = pos.x
        slot.z = pos.z
        slot.birthAt = now
        mesh.visible = false
        continue
      }
      const t = ageMs / BUBBLE_LIFETIME_MS // 0..1
      // Sine bell so the bubble grows then shrinks; peaks ~0.22 world units.
      const scale = Math.sin(t * Math.PI) * 0.22
      // Slight Y rise so bubbles read as rising out of the surface.
      const y = 0.05 + t * 0.35
      mesh.visible = true
      mesh.position.set(slot.x, y, slot.z)
      mesh.scale.setScalar(scale)
      // Fade with the parent disc so bubbles don't outlive the active phase.
      mat.opacity = baseAlpha
      mat.emissiveIntensity = 2.6 * baseAlpha * (1 - t * 0.4)
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
      {/* Lava-style bubbles — small emissive spheres that bloom and rise out
          of the disc on a staggered cycle. Pure procedural, no asset files. */}
      {bubbles.map((slot, i) => (
        <mesh key={i} ref={slot.meshRef} visible={false}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial
            ref={slot.matRef}
            color={bubbleColor}
            emissive={bubbleColor}
            emissiveIntensity={2.6}
            transparent
            opacity={0}
            depthWrite={false}
            roughness={0.4}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  )
}
