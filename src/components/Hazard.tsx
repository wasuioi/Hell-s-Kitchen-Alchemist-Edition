import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HAZARD_DEFS, type DiscHazardDef, type FallingHazardDef, type RectHazardDef } from '../data/hazards'
import { useGameStore } from '../stores/gameStore'
import type { Hazard as HazardType } from '../types'
import SaltSigilEffect from './SaltSigilEffect'

// Renders a single environmental hazard. Three visual flavors:
// - Disc (grease fire): pulsing ring → flickering emissive disc with bubbles.
// - Rect (steam vent): wall-anchored rectangle → emissive heat trail with rising puffs.
// - Falling (falling pot): shadow grows on floor while a pot mesh drops from above.
// - SaltSigil: looping sprite-sheet VFX via SaltSigilEffect.
//
// Procedural Three.js geometry only — no PNG/MP4 assets (except SaltSigil).
export default function Hazard({ hazard }: { hazard: HazardType }) {
  // SaltSigil hazards are player-planted and use a dedicated looping VFX component.
  if (hazard.type === 'salt_sigil') {
    return <SaltSigilEffect hazard={hazard} />
  }

  const def = HAZARD_DEFS[hazard.type]
  if (def.shape === 'disc') {
    return (
      <group position={[hazard.position.x, 0.015, hazard.position.z]}>
        <DiscHazard hazard={hazard} def={def} />
      </group>
    )
  }
  if (def.shape === 'falling') {
    return (
      <group position={[hazard.position.x, 0, hazard.position.z]}>
        <FallingHazard hazard={hazard} def={def} />
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

// ──────────────────────────────────────────────────────────────────────────────
// Falling hazard — falling pot. Shadow on the floor grows during telegraph
// while a cast-iron pot mesh drops in from y≈8 over the last ~33% of the
// telegraph window. Active phase = pot resting on the ground, fading out.
// Damage tick fires once at impact (def.damageInterval > activeMs).
// ──────────────────────────────────────────────────────────────────────────────

const POT_DROP_FRACTION = 0.33   // last 33% of telegraph is the visible drop
const POT_START_Y = 8
const POT_REST_Y = 0.45

const IMPACT_PARTICLE_COUNT = 12
const IMPACT_PARTICLE_LIFETIME_S = 0.9
const IMPACT_GRAVITY = 13         // u/s² — pulls particles back to floor
const IMPACT_SHAKE_INTENSITY = 0.5
const IMPACT_SHAKE_MS = 280

interface ImpactParticle {
  meshRef: RefObject<THREE.Mesh | null>
  matRef: RefObject<THREE.MeshStandardMaterial | null>
  vx: number          // u/s, horizontal x velocity
  vz: number          // u/s, horizontal z velocity
  vy: number          // u/s, initial upward velocity
  spinSpeed: number   // rad/s, tumble around y axis
  isRock: boolean     // rock (icosahedron, gray) vs dirt (sphere, brown)
  baseScale: number
}

function FallingHazard({ hazard, def }: { hazard: HazardType; def: FallingHazardDef }) {
  const shadowRef = useRef<THREE.Mesh>(null!)
  const shadowMatRef = useRef<THREE.MeshBasicMaterial>(null!)
  const potGroupRef = useRef<THREE.Group>(null!)
  const potBodyMatRef = useRef<THREE.MeshStandardMaterial>(null!)
  const potRimMatRef = useRef<THREE.MeshStandardMaterial>(null!)
  const impactFiredRef = useRef(false)

  // Pot rim accent — darker shade of the body, sells the cast-iron silhouette.
  const rimColor = useMemo(() => {
    const c = new THREE.Color(def.color)
    c.lerp(new THREE.Color('#0a0a0a'), 0.55)
    return c
  }, [def.color])

  // Impact debris pool — rocks + dirt clods erupting from the impact point.
  // Pre-allocated with random per-particle velocities; physics is parametric
  // so we don't need per-frame integration.
  const particles = useMemo<ImpactParticle[]>(
    () =>
      Array.from({ length: IMPACT_PARTICLE_COUNT }, () => {
        const angle = Math.random() * Math.PI * 2
        const horizSpeed = 2.4 + Math.random() * 3.2        // 2.4–5.6 u/s outward
        const upSpeed = 3.0 + Math.random() * 3.0           // 3.0–6.0 u/s up
        const isRock = Math.random() < 0.5
        return {
          meshRef: { current: null },
          matRef: { current: null },
          vx: Math.cos(angle) * horizSpeed,
          vz: Math.sin(angle) * horizSpeed,
          vy: upSpeed,
          spinSpeed: (Math.random() - 0.5) * 6,
          isRock,
          baseScale: isRock ? 0.18 + Math.random() * 0.14 : 0.10 + Math.random() * 0.07,
        }
      }),
    [],
  )

  useFrame(() => {
    const now = performance.now()
    const elapsed = now - hazard.spawnedAt
    const inTelegraph = elapsed < def.telegraphMs
    const telegraphProgress = Math.min(1, elapsed / def.telegraphMs)
    const activeElapsed = Math.max(0, elapsed - def.telegraphMs)
    const activeProgress = Math.min(1, activeElapsed / def.activeMs)

    // Shadow grows + darkens while telegraphing, then fades during active.
    if (shadowRef.current && shadowMatRef.current) {
      let scale: number
      let opacity: number
      if (inTelegraph) {
        scale = (0.35 + 0.65 * telegraphProgress) * def.radius
        opacity = 0.35 + 0.45 * telegraphProgress
      } else {
        scale = def.radius
        opacity = 0.8 * (1 - activeProgress)
      }
      shadowRef.current.scale.set(scale, scale, scale)
      shadowMatRef.current.opacity = Math.max(0, opacity)
    }

    // Pot drop: hidden until POT_DROP_FRACTION of telegraph, then linearly drops.
    // During active it lies on the ground and fades out.
    if (potGroupRef.current) {
      const dropStart = 1 - POT_DROP_FRACTION
      if (inTelegraph && telegraphProgress < dropStart) {
        potGroupRef.current.visible = false
      } else if (inTelegraph) {
        potGroupRef.current.visible = true
        const dropT = (telegraphProgress - dropStart) / POT_DROP_FRACTION
        potGroupRef.current.position.y = POT_START_Y + (POT_REST_Y - POT_START_Y) * dropT
        if (potBodyMatRef.current) potBodyMatRef.current.opacity = 1
        if (potRimMatRef.current) potRimMatRef.current.opacity = 1
      } else {
        potGroupRef.current.visible = true
        potGroupRef.current.position.y = POT_REST_Y
        const fade = 1 - activeProgress
        if (potBodyMatRef.current) potBodyMatRef.current.opacity = fade
        if (potRimMatRef.current) potRimMatRef.current.opacity = fade
      }
    }

    // Impact beat — fires once at the telegraph→active transition.
    // Triggers a soft screenshake; debris animation is parametric below.
    if (!inTelegraph && !impactFiredRef.current) {
      impactFiredRef.current = true
      useGameStore.getState().triggerScreenShake(IMPACT_SHAKE_INTENSITY, IMPACT_SHAKE_MS)
    }

    // Impact debris — only animate after impact has fired. Position + rotation
    // are pure functions of (now − impactTime) so we never mutate the slot.
    if (impactFiredRef.current) {
      const t = activeElapsed / 1000  // seconds since impact
      for (const p of particles) {
        const mesh = p.meshRef.current
        const mat = p.matRef.current
        if (!mesh) continue
        if (t < 0 || t > IMPACT_PARTICLE_LIFETIME_S) {
          mesh.visible = false
          continue
        }
        const x = p.vx * t
        const z = p.vz * t
        const y = Math.max(0.05, p.vy * t - 0.5 * IMPACT_GRAVITY * t * t)
        const fadeT = t / IMPACT_PARTICLE_LIFETIME_S
        mesh.visible = true
        mesh.position.set(x, y, z)
        mesh.rotation.y = p.spinSpeed * t
        mesh.rotation.x = p.spinSpeed * t * 0.6
        mesh.scale.setScalar(p.baseScale * (1 - fadeT * 0.35))
        if (mat) mat.opacity = Math.max(0, 1 - fadeT)
      }
    }
  })

  return (
    <>
      {/* Floor shadow — dark unit-circle scaled in useFrame to track the
          telegraph progress + impact radius. */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial
          ref={shadowMatRef}
          color="#000000"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      {/* Pot mesh — cylinder body + thin torus rim. Visibility + Y position
          mutate in useFrame so React doesn't re-render every drop frame. */}
      <group ref={potGroupRef} visible={false} position={[0, POT_START_Y, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.55, 0.65, 0.8, 18]} />
          <meshStandardMaterial
            ref={potBodyMatRef}
            color={def.color}
            roughness={0.85}
            metalness={0.25}
            transparent
            opacity={1}
          />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <torusGeometry args={[0.55, 0.06, 8, 24]} />
          <meshStandardMaterial
            ref={potRimMatRef}
            color={rimColor}
            roughness={0.7}
            metalness={0.4}
            transparent
            opacity={1}
          />
        </mesh>
      </group>
      {/* Impact debris — rocks (gray icosahedrons) + dirt (small dark spheres).
          Hidden until impactFired flips on at telegraph→active transition. */}
      {particles.map((p, i) => (
        <mesh key={i} ref={p.meshRef} visible={false}>
          {p.isRock ? (
            <icosahedronGeometry args={[1, 0]} />
          ) : (
            <sphereGeometry args={[1, 8, 6]} />
          )}
          <meshStandardMaterial
            ref={p.matRef}
            color={p.isRock ? '#5a5a5a' : '#3a2a18'}
            roughness={p.isRock ? 0.95 : 1}
            metalness={0}
            transparent
            opacity={1}
          />
        </mesh>
      ))}
    </>
  )
}
