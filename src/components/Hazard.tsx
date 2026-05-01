import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HAZARD_DEFS, type DiscHazardDef, type RectHazardDef } from '../data/hazards'
import type { Hazard as HazardType } from '../types'

// Renders a single environmental hazard. Two visual phases per shape:
// - Telegraph: pulsing color ring/footprint on the floor; no damage.
// - Active: emissive surface + procedural particles (lava bubbles for disc,
//   rising steam puffs for rect). Damage handled in HazardManager.
//
// Procedural Three.js geometry only — no PNG/MP4 assets.
export default function Hazard({ hazard }: { hazard: HazardType }) {
  const def = HAZARD_DEFS[hazard.type]
  if (def.shape === 'disc') {
    return (
      <group position={[hazard.position.x, 0.015, hazard.position.z]}>
        <DiscHazard hazard={hazard} def={def} />
      </group>
    )
  }
  return (
    <group position={[hazard.position.x, 0.015, hazard.position.z]} rotation={[0, hazard.rotation, 0]}>
      <RectHazard hazard={hazard} def={def} />
    </group>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Disc hazard — grease fire. Pulsing ring telegraph → flickering emissive disc
// with a pool of lava-style bubbles bursting out of the surface.
// ──────────────────────────────────────────────────────────────────────────────

const BUBBLE_COUNT = 6
const BUBBLE_LIFETIME_MS = 700

interface ParticleSlot {
  meshRef: RefObject<THREE.Mesh | null>
  matRef: RefObject<THREE.MeshStandardMaterial | null>
  x: number
  z: number
  birthAt: number
}

function pickInDisc(maxRadius: number) {
  const angle = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * maxRadius * 0.85
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r }
}

function DiscHazard({ hazard, def }: { hazard: HazardType; def: DiscHazardDef }) {
  const telegraphRingRef = useRef<THREE.Mesh>(null!)
  const activeDiscRef = useRef<THREE.Mesh>(null!)
  const activeMatRef = useRef<THREE.MeshStandardMaterial>(null!)

  const bubbles = useMemo<ParticleSlot[]>(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, i) => {
        const pos = pickInDisc(def.radius)
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

  // Bubble color = brighter/more yellow than the disc base — reads as hot.
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

    if (telegraphRingRef.current) {
      const mat = telegraphRingRef.current.material as THREE.MeshBasicMaterial
      if (inTelegraph) {
        telegraphRingRef.current.visible = true
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(elapsed * 0.012))
        mat.opacity = pulse * (0.5 + 0.5 * telegraphProgress)
      } else {
        telegraphRingRef.current.visible = false
      }
    }

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

    for (const slot of bubbles) {
      const mesh = slot.meshRef.current
      const mat = slot.matRef.current
      if (!mesh || !mat) continue
      if (inTelegraph) {
        mesh.visible = false
        slot.birthAt = now + Math.random() * 200
        continue
      }
      const ageMs = now - slot.birthAt
      if (ageMs < 0 || ageMs > BUBBLE_LIFETIME_MS) {
        const pos = pickInDisc(def.radius)
        slot.x = pos.x
        slot.z = pos.z
        slot.birthAt = now
        mesh.visible = false
        continue
      }
      const t = ageMs / BUBBLE_LIFETIME_MS
      const scale = Math.sin(t * Math.PI) * 0.22
      const y = 0.05 + t * 0.35
      mesh.visible = true
      mesh.position.set(slot.x, y, slot.z)
      mesh.scale.setScalar(scale)
      mat.opacity = baseAlpha
      mat.emissiveIntensity = 2.6 * baseAlpha * (1 - t * 0.4)
    }
  })

  return (
    <>
      <mesh ref={telegraphRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[def.radius * 0.85, def.radius, 48]} />
        <meshBasicMaterial color={def.color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
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
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Rect hazard — steam vent. The inner content is rendered in the parent's
// rotated frame, so locally the vent extends along +z from origin (the wall
// anchor) toward (0, 0, length) (into the arena).
// ──────────────────────────────────────────────────────────────────────────────

const PUFF_COUNT = 8
const PUFF_LIFETIME_MS = 900

function RectHazard({ hazard, def }: { hazard: HazardType; def: RectHazardDef }) {
  const telegraphPlaneRef = useRef<THREE.Mesh>(null!)
  const telegraphMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const activePlaneRef = useRef<THREE.Mesh>(null!)
  const activeMatRef = useRef<THREE.MeshStandardMaterial>(null!)

  const puffs = useMemo<ParticleSlot[]>(
    () =>
      Array.from({ length: PUFF_COUNT }, (_, i) => ({
        meshRef: { current: null },
        matRef: { current: null },
        x: (Math.random() - 0.5) * def.width * 0.7,
        z: Math.random() * def.length,
        birthAt: -((i / PUFF_COUNT) * PUFF_LIFETIME_MS),
      })),
    [def.width, def.length],
  )

  useFrame(() => {
    const now = performance.now()
    const elapsed = now - hazard.spawnedAt
    const inTelegraph = elapsed < def.telegraphMs
    const telegraphProgress = Math.min(1, elapsed / def.telegraphMs)
    const activeElapsed = Math.max(0, elapsed - def.telegraphMs)
    const activeProgress = Math.min(1, activeElapsed / def.activeMs)

    if (telegraphPlaneRef.current && telegraphMatRef.current) {
      if (inTelegraph) {
        telegraphPlaneRef.current.visible = true
        const pulse = 0.3 + 0.5 * Math.abs(Math.sin(elapsed * 0.012))
        telegraphMatRef.current.opacity = pulse * (0.4 + 0.6 * telegraphProgress)
      } else {
        telegraphPlaneRef.current.visible = false
      }
    }

    let baseAlpha = 0
    if (activePlaneRef.current && activeMatRef.current) {
      activePlaneRef.current.visible = !inTelegraph
      if (!inTelegraph) {
        const fadeIn = Math.min(1, activeElapsed / 150)
        const fadeOut = activeProgress > 0.85 ? (1 - activeProgress) / 0.15 : 1
        baseAlpha = fadeIn * fadeOut
        const flicker = 0.9 + 0.1 * Math.sin(elapsed * 0.05)
        activeMatRef.current.opacity = baseAlpha * 0.6 * flicker
        activeMatRef.current.emissiveIntensity = 1.0 * flicker * baseAlpha
      }
    }

    for (const slot of puffs) {
      const mesh = slot.meshRef.current
      const mat = slot.matRef.current
      if (!mesh || !mat) continue
      if (inTelegraph) {
        mesh.visible = false
        slot.birthAt = now + Math.random() * 300
        continue
      }
      const ageMs = now - slot.birthAt
      if (ageMs < 0 || ageMs > PUFF_LIFETIME_MS) {
        slot.x = (Math.random() - 0.5) * def.width * 0.7
        slot.z = Math.random() * def.length
        slot.birthAt = now
        mesh.visible = false
        continue
      }
      const t = ageMs / PUFF_LIFETIME_MS
      // Puffs grow wider and rise higher than disc bubbles — feels gaseous.
      const scale = Math.sin(t * Math.PI) * 0.6
      const y = 0.1 + t * 1.6
      mesh.visible = true
      mesh.position.set(slot.x, y, slot.z)
      mesh.scale.setScalar(scale)
      mat.opacity = baseAlpha * 0.8 * (1 - t * 0.6)
      mat.emissiveIntensity = 1.4 * baseAlpha * (1 - t * 0.5)
    }
  })

  // Parent group is rotated, so positioning along +z lays the rect into the arena.
  // Plane is centered along its length, so offset by length/2 along +z.
  return (
    <>
      <mesh
        ref={telegraphPlaneRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, def.length / 2]}
      >
        <planeGeometry args={[def.width, def.length]} />
        <meshBasicMaterial
          ref={telegraphMatRef}
          color={def.color}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={activePlaneRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, def.length / 2]}
        visible={false}
      >
        <planeGeometry args={[def.width, def.length]} />
        <meshStandardMaterial
          ref={activeMatRef}
          color={def.color}
          emissive={def.color}
          emissiveIntensity={1.0}
          transparent
          opacity={0.6}
          depthWrite={false}
          roughness={1}
          metalness={0}
        />
      </mesh>
      {puffs.map((slot, i) => (
        <mesh key={i} ref={slot.meshRef} visible={false}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial
            ref={slot.matRef}
            color={def.color}
            emissive={def.color}
            emissiveIntensity={1.4}
            transparent
            opacity={0}
            depthWrite={false}
            roughness={0.6}
            metalness={0}
          />
        </mesh>
      ))}
    </>
  )
}
