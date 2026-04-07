import { useRef, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVfxStore } from '../stores/vfxStore'
import { useGameStore } from '../stores/gameStore'
import { spawnGroundCrack } from './GroundCracks'

// ── Types ──

interface Explosion {
  id: string
  position: { x: number; z: number }
  createdAt: number
  chainDepth: number
}

declare global {
  interface Window {
    __spawnExplosion?: (x: number, z: number, chainDepth?: number) => void
  }
}

let nextExplosionId = 0

export function spawnExplosion(x: number, z: number, chainDepth = 0) {
  window.__spawnExplosion?.({ x, z, chainDepth } as any)
}

const EXPLOSION_LIFETIME = 1.2

// ────────────────────────────────────────────────────────────────
// V1: FIREBURST — classic particle explosion with gravity
//     Lots of sparks flying outward and falling down
// ────────────────────────────────────────────────────────────────

function FireburstExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 200
  const init = useRef(false)
  const vel = useRef(new Float32Array(count * 3))
  const pAge = useRef(new Float32Array(count))
  const life = useRef(new Float32Array(count))
  const pPos = useRef(new Float32Array(count * 3))
  const pCol = useRef(new Float32Array(count * 3))
  const pSize = useRef(new Float32Array(count))

  if (!init.current) {
    init.current = true
    for (let i = 0; i < count; i++) {
      pPos.current[i * 3] = 0
      pPos.current[i * 3 + 1] = 0.5
      pPos.current[i * 3 + 2] = 0
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.5 // hemisphere up
      const speed = 5 + Math.random() * 12
      vel.current[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
      vel.current[i * 3 + 1] = Math.cos(phi) * speed + 3
      vel.current[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed
      life.current[i] = 0.4 + Math.random() * 0.5
      pSize.current[i] = 0.3 + Math.random() * 0.5
    }
  }

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const posA = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const colA = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute
    const sizeA = pointsRef.current.geometry.attributes.size as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      pAge.current[i] += delta
      const t = pAge.current[i] / life.current[i]
      if (t > 1) { sizeA.array[i] = 0; continue }
      vel.current[i * 3 + 1] -= 12 * delta // gravity
      pPos.current[i * 3] += vel.current[i * 3] * delta
      pPos.current[i * 3 + 1] += vel.current[i * 3 + 1] * delta
      pPos.current[i * 3 + 2] += vel.current[i * 3 + 2] * delta
      vel.current[i * 3] *= 0.96
      vel.current[i * 3 + 2] *= 0.96
      posA.array[i * 3] = pPos.current[i * 3]
      posA.array[i * 3 + 1] = Math.max(0, pPos.current[i * 3 + 1])
      posA.array[i * 3 + 2] = pPos.current[i * 3 + 2]
      // White → yellow → orange → dark
      const flicker = 0.85 + Math.sin(pAge.current[i] * 35 + i) * 0.15
      colA.array[i * 3] = flicker
      colA.array[i * 3 + 1] = Math.max(0.1, (1 - t * 1.2)) * flicker
      colA.array[i * 3 + 2] = Math.max(0, (0.4 - t)) * flicker
      sizeA.array[i] = pSize.current[i] * (1 - t * 0.7) * flicker
    }
    posA.needsUpdate = true; colA.needsUpdate = true; sizeA.needsUpdate = true
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={pPos.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={count} array={pCol.current} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={count} array={pSize.current} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial vertexColors sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {/* Brief flash light */}
      <pointLight position={[0, 1, 0]} color="#ff8800" intensity={Math.max(0, 6 * (1 - age / 0.15))} distance={6} />
    </group>
  )
}

// ────────────────────────────────────────────────────────────────
// V2: SHOCKWAVE — pure geometric, no particles
//     Big expanding filled disc + shockwave ring edge
// ────────────────────────────────────────────────────────────────

function ShockwaveExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const discRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const triggered = useRef(false)

  if (!triggered.current) {
    triggered.current = true
    useGameStore.getState().triggerScreenFlash()
  }

  useFrame(() => {
    // Filled disc: fast expand, fades from center
    if (discRef.current) {
      const t = Math.min(1, age / 0.35)
      const scale = t * 7
      discRef.current.scale.set(scale, scale, 1)
      const mat = discRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.6 * Math.max(0, 1 - t * 1.5)
    }
    // Outer ring: expands slightly slower, stays visible longer
    if (ringRef.current) {
      const t = Math.min(1, age / 0.5)
      const scale = 0.5 + t * 8
      ringRef.current.scale.set(scale, scale, 1)
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.9 * (1 - t)
    }
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, 8 * (1 - age / 0.2))
    }
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Filled blast disc */}
      <mesh ref={discRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#ff6b00" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Sharp shockwave ring edge */}
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Intense flash */}
      <pointLight ref={lightRef} position={[0, 2, 0]} color="#ffaa44" intensity={8} distance={12} />
    </group>
  )
}

// ────────────────────────────────────────────────────────────────
// V3: HELLFIRE — ground-level fire carpet that spreads outward
//     Burning circle expanding on the floor + rising smoke
// ────────────────────────────────────────────────────────────────

function HellfireExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const fireRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const scorchSpawned = useRef(false)

  // Smoke particles rising slowly
  const smokeCount = 40
  const smokeRef = useRef<THREE.Points>(null)
  const smokePos = useRef(new Float32Array(smokeCount * 3))
  const smokeVel = useRef(new Float32Array(smokeCount * 3))
  const smokeSize = useRef(new Float32Array(smokeCount))
  const smokeCol = useRef(new Float32Array(smokeCount * 3))
  const smokeAge = useRef(new Float32Array(smokeCount))
  const smokeInit = useRef(false)

  if (!smokeInit.current) {
    smokeInit.current = true
    for (let i = 0; i < smokeCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * 2
      smokePos.current[i * 3] = Math.cos(angle) * r
      smokePos.current[i * 3 + 1] = 0.2
      smokePos.current[i * 3 + 2] = Math.sin(angle) * r
      smokeVel.current[i * 3] = (Math.random() - 0.5) * 0.3
      smokeVel.current[i * 3 + 1] = 0.5 + Math.random() * 1.5
      smokeVel.current[i * 3 + 2] = (Math.random() - 0.5) * 0.3
      smokeSize.current[i] = 0.4 + Math.random() * 0.4
      // Dark gray smoke
      const gray = 0.2 + Math.random() * 0.15
      smokeCol.current[i * 3] = gray
      smokeCol.current[i * 3 + 1] = gray * 0.8
      smokeCol.current[i * 3 + 2] = gray * 0.5
    }
  }

  if (!scorchSpawned.current) {
    scorchSpawned.current = true
    spawnGroundCrack(pos.x, pos.z)
  }

  useFrame((_, delta) => {
    // Expanding fire carpet on ground
    if (fireRef.current) {
      const t = Math.min(1, age / 0.4)
      const scale = t * 6
      fireRef.current.scale.set(scale, scale, 1)
      const mat = fireRef.current.material as THREE.MeshBasicMaterial
      // Fire fades but slowly — lingers on the ground
      mat.opacity = 0.7 * Math.max(0, 1 - Math.pow(age / 0.9, 2))
    }
    // Bright inner core
    if (innerRef.current) {
      const t = Math.min(1, age / 0.2)
      const scale = t * 3
      innerRef.current.scale.set(scale, scale, 1)
      const mat = innerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.9 * Math.max(0, 1 - age / 0.4)
    }
    // Smoke rising
    if (smokeRef.current) {
      const posA = smokeRef.current.geometry.attributes.position as THREE.BufferAttribute
      const sizeA = smokeRef.current.geometry.attributes.size as THREE.BufferAttribute
      for (let i = 0; i < smokeCount; i++) {
        smokeAge.current[i] += delta
        const t = Math.min(1, smokeAge.current[i] / 1.0)
        smokePos.current[i * 3] += smokeVel.current[i * 3] * delta
        smokePos.current[i * 3 + 1] += smokeVel.current[i * 3 + 1] * delta
        smokePos.current[i * 3 + 2] += smokeVel.current[i * 3 + 2] * delta
        posA.array[i * 3] = smokePos.current[i * 3]
        posA.array[i * 3 + 1] = smokePos.current[i * 3 + 1]
        posA.array[i * 3 + 2] = smokePos.current[i * 3 + 2]
        // Smoke grows bigger as it rises, then fades
        sizeA.array[i] = smokeSize.current[i] * (0.5 + t * 0.8) * Math.max(0, 1 - t)
      }
      posA.needsUpdate = true
      sizeA.needsUpdate = true
    }
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Fire carpet on ground */}
      <mesh ref={fireRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.7} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Bright inner core */}
      <mesh ref={innerRef} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#ffee88" transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Rising smoke */}
      <points ref={smokeRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={smokeCount} array={smokePos.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={smokeCount} array={smokeCol.current} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={smokeCount} array={smokeSize.current} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial vertexColors sizeAttenuation transparent depthWrite={false} opacity={0.6} />
      </points>
      {/* Warm ground light */}
      <pointLight position={[0, 0.5, 0]} color="#ff4400" intensity={Math.max(0, 4 * (1 - age / 0.6))} distance={8} />
    </group>
  )
}

// ────────────────────────────────────────────────────────────────
// V4: PILLAR — vertical fire column shooting upward
//     Tall flame pillar + ring at base + falling embers
// ────────────────────────────────────────────────────────────────

function PillarExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const pillarRef = useRef<THREE.Mesh>(null)
  const baseRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const triggered = useRef(false)

  // Falling ember particles
  const emberCount = 50
  const emberRef = useRef<THREE.Points>(null)
  const ePos = useRef(new Float32Array(emberCount * 3))
  const eVel = useRef(new Float32Array(emberCount * 3))
  const eSize = useRef(new Float32Array(emberCount))
  const eCol = useRef(new Float32Array(emberCount * 3))
  const eAge = useRef(new Float32Array(emberCount))
  const eInit = useRef(false)

  if (!eInit.current) {
    eInit.current = true
    for (let i = 0; i < emberCount; i++) {
      // Start high, fall down with spread
      ePos.current[i * 3] = (Math.random() - 0.5) * 1.5
      ePos.current[i * 3 + 1] = 2 + Math.random() * 4
      ePos.current[i * 3 + 2] = (Math.random() - 0.5) * 1.5
      eVel.current[i * 3] = (Math.random() - 0.5) * 3
      eVel.current[i * 3 + 1] = 2 + Math.random() * 3 // initial upward then gravity
      eVel.current[i * 3 + 2] = (Math.random() - 0.5) * 3
      eSize.current[i] = 0.15 + Math.random() * 0.15
      eCol.current[i * 3] = 1
      eCol.current[i * 3 + 1] = 0.3 + Math.random() * 0.5
      eCol.current[i * 3 + 2] = 0
    }
  }

  if (!triggered.current) {
    triggered.current = true
    useGameStore.getState().triggerScreenShake(0.8, 250)
  }

  useFrame((_, delta) => {
    // Fire pillar: cylinder that shoots up then fades
    if (pillarRef.current) {
      const riseT = Math.min(1, age / 0.15)
      const fadeT = Math.max(0, (age - 0.15) / 0.4)
      const height = riseT * 6
      const width = 0.8 * (1 - fadeT * 0.5)
      pillarRef.current.scale.set(width, height, width)
      pillarRef.current.position.y = height / 2
      const mat = pillarRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * Math.max(0, 1 - fadeT)
    }
    // Base ring
    if (baseRef.current) {
      const t = Math.min(1, age / 0.3)
      baseRef.current.scale.set(1 + t * 3, 1 + t * 3, 1)
      const mat = baseRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.7 * (1 - t)
    }
    // Light
    if (lightRef.current) {
      const t = Math.min(1, age / 0.1)
      lightRef.current.position.y = t * 4
      lightRef.current.intensity = Math.max(0, 6 * (1 - age / 0.4))
    }
    // Falling embers
    if (emberRef.current) {
      const posA = emberRef.current.geometry.attributes.position as THREE.BufferAttribute
      const sizeA = emberRef.current.geometry.attributes.size as THREE.BufferAttribute
      for (let i = 0; i < emberCount; i++) {
        eAge.current[i] += delta
        const t = Math.min(1, eAge.current[i] / 0.8)
        eVel.current[i * 3 + 1] -= 10 * delta // gravity
        ePos.current[i * 3] += eVel.current[i * 3] * delta
        ePos.current[i * 3 + 1] += eVel.current[i * 3 + 1] * delta
        ePos.current[i * 3 + 2] += eVel.current[i * 3 + 2] * delta
        posA.array[i * 3] = ePos.current[i * 3]
        posA.array[i * 3 + 1] = Math.max(0, ePos.current[i * 3 + 1])
        posA.array[i * 3 + 2] = ePos.current[i * 3 + 2]
        sizeA.array[i] = eSize.current[i] * Math.max(0, 1 - t)
      }
      posA.needsUpdate = true
      sizeA.needsUpdate = true
    }
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Fire pillar */}
      <mesh ref={pillarRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.8, 1, 12]} />
        <meshBasicMaterial color="#ff6622" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Base ring */}
      <mesh ref={baseRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.2, 32]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.7} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Dynamic light */}
      <pointLight ref={lightRef} position={[0, 2, 0]} color="#ff6600" intensity={6} distance={10} />
      {/* Falling embers */}
      <points ref={emberRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={emberCount} array={ePos.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={emberCount} array={eCol.current} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={emberCount} array={eSize.current} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial vertexColors sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

// ────────────────────────────────────────────────────────────────
// V5: SUPERNOVA — maximum impact with chain scaling
//     Bright fireball core + double rings + sparks + scorch
//     Chain explosions get progressively bigger and louder
// ────────────────────────────────────────────────────────────────

function SupernovaExplosion({ pos, age, chainDepth }: { pos: { x: number; z: number }; age: number; chainDepth: number }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const triggered = useRef(false)

  const chainScale = 1 + chainDepth * 0.35

  // Spark particles — outward burst + upward drift
  const sparkCount = 80
  const sparkRef = useRef<THREE.Points>(null)
  const sPos = useRef(new Float32Array(sparkCount * 3))
  const sVel = useRef(new Float32Array(sparkCount * 3))
  const sSize = useRef(new Float32Array(sparkCount))
  const sCol = useRef(new Float32Array(sparkCount * 3))
  const sAge = useRef(new Float32Array(sparkCount))
  const sInit = useRef(false)

  if (!sInit.current) {
    sInit.current = true
    for (let i = 0; i < sparkCount; i++) {
      sPos.current[i * 3] = 0
      sPos.current[i * 3 + 1] = 0.8
      sPos.current[i * 3 + 2] = 0
      const angle = Math.random() * Math.PI * 2
      const speed = 3 + Math.random() * 6
      sVel.current[i * 3] = Math.cos(angle) * speed * chainScale
      sVel.current[i * 3 + 1] = 1 + Math.random() * 4
      sVel.current[i * 3 + 2] = Math.sin(angle) * speed * chainScale
      sSize.current[i] = 0.2 + Math.random() * 0.3
      // White-yellow sparks
      sCol.current[i * 3] = 1
      sCol.current[i * 3 + 1] = 0.8 + Math.random() * 0.2
      sCol.current[i * 3 + 2] = 0.4 + Math.random() * 0.3
    }
  }

  if (!triggered.current) {
    triggered.current = true
    useGameStore.getState().triggerScreenFlash()
    useGameStore.getState().triggerScreenShake(Math.min(1.5, 0.8 + chainDepth * 0.3), 350)
    spawnGroundCrack(pos.x, pos.z)
  }

  useFrame((_, delta) => {
    // Fireball core: bright sphere that expands then implodes
    if (coreRef.current) {
      const expandT = Math.min(1, age / 0.12)
      const fadeT = Math.max(0, (age - 0.12) / 0.25)
      const scale = (0.3 + expandT * 2.5 - fadeT * 1.5) * chainScale
      coreRef.current.scale.set(Math.max(0, scale), Math.max(0, scale), Math.max(0, scale))
      const mat = coreRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - fadeT)
    }
    // Ring 1: white, fast, tight
    if (ring1Ref.current) {
      const t = Math.min(1, age / 0.25)
      const scale = t * 5 * chainScale
      ring1Ref.current.scale.set(scale, scale, 1)
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 1 - t)
    }
    // Ring 2: orange, slower, wider
    if (ring2Ref.current) {
      const t = Math.min(1, age / 0.45)
      const scale = 0.5 + t * 8 * chainScale
      ring2Ref.current.scale.set(scale, scale, 1)
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.6 * Math.max(0, 1 - t)
    }
    // Light
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, (8 + chainDepth * 3) * (1 - age / 0.3))
    }
    // Sparks
    if (sparkRef.current) {
      const posA = sparkRef.current.geometry.attributes.position as THREE.BufferAttribute
      const sizeA = sparkRef.current.geometry.attributes.size as THREE.BufferAttribute
      const colA = sparkRef.current.geometry.attributes.color as THREE.BufferAttribute
      for (let i = 0; i < sparkCount; i++) {
        sAge.current[i] += delta
        const t = Math.min(1, sAge.current[i] / 0.7)
        sVel.current[i * 3 + 1] -= 3 * delta // light gravity
        sPos.current[i * 3] += sVel.current[i * 3] * delta
        sPos.current[i * 3 + 1] += sVel.current[i * 3 + 1] * delta
        sPos.current[i * 3 + 2] += sVel.current[i * 3 + 2] * delta
        sVel.current[i * 3] *= 0.95
        sVel.current[i * 3 + 2] *= 0.95
        posA.array[i * 3] = sPos.current[i * 3]
        posA.array[i * 3 + 1] = Math.max(0, sPos.current[i * 3 + 1])
        posA.array[i * 3 + 2] = sPos.current[i * 3 + 2]
        // Fade from white-yellow to orange to dark
        colA.array[i * 3] = Math.max(0.2, 1 - t * 0.5)
        colA.array[i * 3 + 1] = Math.max(0, sCol.current[i * 3 + 1] * (1 - t))
        colA.array[i * 3 + 2] = Math.max(0, sCol.current[i * 3 + 2] * (1 - t * 2))
        sizeA.array[i] = sSize.current[i] * Math.max(0, 1 - t) * chainScale
      }
      posA.needsUpdate = true; sizeA.needsUpdate = true; colA.needsUpdate = true
    }
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Fireball core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#ffffcc" transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Inner ring: white, fast */}
      <mesh ref={ring1Ref} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Outer ring: orange, slower */}
      <mesh ref={ring2Ref} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color="#ff5500" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Intense light */}
      <pointLight ref={lightRef} position={[0, 2, 0]} color="#ffcc66" intensity={8} distance={14} />
      {/* Sparks */}
      <points ref={sparkRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={sparkCount} array={sPos.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={sparkCount} array={sCol.current} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={sparkCount} array={sSize.current} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial vertexColors sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

// ── Main component ──

export default function ExplosionEffects() {
  const [explosions, setExplosions] = useState<Explosion[]>([])
  const explosionsRef = useRef<Explosion[]>([])

  const addExplosion = useCallback((data: { x: number; z: number; chainDepth: number }) => {
    const explosion: Explosion = {
      id: `exp_${nextExplosionId++}`,
      position: { x: data.x, z: data.z },
      createdAt: performance.now(),
      chainDepth: data.chainDepth,
    }
    explosionsRef.current = [...explosionsRef.current, explosion]
    setExplosions([...explosionsRef.current])
  }, [])

  useFrame(() => {
    if (!window.__spawnExplosion) {
      window.__spawnExplosion = (arg: any) => addExplosion(arg)
    }
    const now = performance.now()
    const before = explosionsRef.current.length
    explosionsRef.current = explosionsRef.current.filter((e) => (now - e.createdAt) / 1000 < EXPLOSION_LIFETIME)
    if (explosionsRef.current.length !== before) {
      setExplosions([...explosionsRef.current])
    }
  })

  const activeId = useVfxStore((s) => s.activeExplosionId)

  return (
    <>
      {explosions.map((exp) => {
        const age = (performance.now() - exp.createdAt) / 1000
        const pos = exp.position
        switch (activeId) {
          case 'fireburst':
            return <FireburstExplosion key={exp.id} pos={pos} age={age} />
          case 'shockwave':
            return <ShockwaveExplosion key={exp.id} pos={pos} age={age} />
          case 'hellfire':
            return <HellfireExplosion key={exp.id} pos={pos} age={age} />
          case 'double_ring':
            return <PillarExplosion key={exp.id} pos={pos} age={age} />
          case 'supernova':
            return <SupernovaExplosion key={exp.id} pos={pos} age={age} chainDepth={exp.chainDepth} />
          default:
            return <FireburstExplosion key={exp.id} pos={pos} age={age} />
        }
      })}
    </>
  )
}
