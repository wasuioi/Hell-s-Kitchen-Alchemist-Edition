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
  chainDepth: number // for V5: chain scaling
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

// ── Shared constants ──

const EXPLOSION_RADIUS = 3
const EXPLOSION_LIFETIME = 0.8 // seconds

// ── V1: Fireburst — particle burst only ──

function FireburstExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const particleCount = 150
  const initialized = useRef(false)
  const velocities = useRef(new Float32Array(particleCount * 3))
  const ages = useRef(new Float32Array(particleCount))
  const lifetimes = useRef(new Float32Array(particleCount))

  const positions = useRef(new Float32Array(particleCount * 3))
  const colors = useRef(new Float32Array(particleCount * 3))
  const sizes = useRef(new Float32Array(particleCount))

  if (!initialized.current) {
    initialized.current = true
    for (let i = 0; i < particleCount; i++) {
      positions.current[i * 3] = 0
      positions.current[i * 3 + 1] = 0.3
      positions.current[i * 3 + 2] = 0
      // Hemisphere direction (upward bias)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.6
      const speed = 6 + Math.random() * 10
      velocities.current[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
      velocities.current[i * 3 + 1] = Math.cos(phi) * speed + 2
      velocities.current[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed
      lifetimes.current[i] = 0.3 + Math.random() * 0.3
      sizes.current[i] = 0.3 + Math.random() * 0.4
    }
  }

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const colAttr = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute
    const sizeAttr = pointsRef.current.geometry.attributes.size as THREE.BufferAttribute

    for (let i = 0; i < particleCount; i++) {
      ages.current[i] += delta
      const t = ages.current[i] / lifetimes.current[i]
      if (t > 1) { sizeAttr.array[i] = 0; continue }
      // Move with gravity
      velocities.current[i * 3 + 1] -= 8 * delta
      positions.current[i * 3] += velocities.current[i * 3] * delta
      positions.current[i * 3 + 1] += velocities.current[i * 3 + 1] * delta
      positions.current[i * 3 + 2] += velocities.current[i * 3 + 2] * delta
      // Friction
      velocities.current[i * 3] *= 0.97
      velocities.current[i * 3 + 2] *= 0.97
      posAttr.array[i * 3] = positions.current[i * 3]
      posAttr.array[i * 3 + 1] = Math.max(0, positions.current[i * 3 + 1])
      posAttr.array[i * 3 + 2] = positions.current[i * 3 + 2]
      // Color: white → orange → dark red
      const r = 1, g = Math.max(0.2, 1 - t * 1.5), b = Math.max(0, 0.3 - t)
      // Fire flicker
      const flicker = 0.85 + Math.sin(ages.current[i] * 30 + i) * 0.15
      colAttr.array[i * 3] = r * flicker
      colAttr.array[i * 3 + 1] = g * flicker
      colAttr.array[i * 3 + 2] = b * flicker
      sizeAttr.array[i] = sizes.current[i] * (1 - t) * flicker
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={particleCount} array={positions.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={particleCount} array={colors.current} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={particleCount} array={sizes.current} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial vertexColors sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

// ── V2: Shockwave — expanding ring + light flash ──

function ShockwaveExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const ringRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame(() => {
    if (ringRef.current) {
      const ringProgress = Math.min(1, age / 0.3)
      const scale = ringProgress * EXPLOSION_RADIUS * 2
      ringRef.current.scale.set(scale, scale, 1)
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.7 * (1 - ringProgress)
    }
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, 4 * (1 - age / 0.25))
    }
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Expanding shockwave ring */}
      <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#ff6b00" transparent opacity={0.7} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Flash light */}
      <pointLight ref={lightRef} position={[0, 1, 0]} color="#ff8c00" intensity={4} distance={8} />
    </group>
  )
}

// ── V3: Hellfire — particles + ring + ground scorch ──

function HellfireExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const scorchSpawned = useRef(false)
  if (!scorchSpawned.current) {
    scorchSpawned.current = true
    spawnGroundCrack(pos.x, pos.z)
  }

  return (
    <group>
      <FireburstExplosion pos={pos} age={age} />
      <ShockwaveExplosion pos={pos} age={age} />
    </group>
  )
}

// ── V4: Double Ring — layered shockwaves + embers + screen flash ──

function DoubleRingExplosion({ pos, age }: { pos: { x: number; z: number }; age: number }) {
  const innerRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const flashTriggered = useRef(false)

  // Ember particles (simple rising sparks)
  const emberCount = 30
  const emberPositions = useRef(new Float32Array(emberCount * 3))
  const emberVelocities = useRef(new Float32Array(emberCount * 3))
  const emberSizes = useRef(new Float32Array(emberCount))
  const emberColors = useRef(new Float32Array(emberCount * 3))
  const emberAges = useRef(new Float32Array(emberCount))
  const emberPointsRef = useRef<THREE.Points>(null)
  const emberInit = useRef(false)

  if (!emberInit.current) {
    emberInit.current = true
    for (let i = 0; i < emberCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * 1.5
      emberPositions.current[i * 3] = Math.cos(angle) * r
      emberPositions.current[i * 3 + 1] = 0.5 + Math.random()
      emberPositions.current[i * 3 + 2] = Math.sin(angle) * r
      emberVelocities.current[i * 3] = (Math.random() - 0.5) * 0.5
      emberVelocities.current[i * 3 + 1] = 1 + Math.random() * 2
      emberVelocities.current[i * 3 + 2] = (Math.random() - 0.5) * 0.5
      emberSizes.current[i] = 0.15 + Math.random() * 0.1
      emberColors.current[i * 3] = 1
      emberColors.current[i * 3 + 1] = 0.5 + Math.random() * 0.3
      emberColors.current[i * 3 + 2] = 0
    }
  }

  if (!flashTriggered.current) {
    flashTriggered.current = true
    useGameStore.getState().triggerScreenFlash()
  }

  useFrame((_, delta) => {
    // Inner ring: fast expand, white/yellow
    if (innerRef.current) {
      const t = Math.min(1, age / 0.2)
      const scale = t * EXPLOSION_RADIUS * 1.5
      innerRef.current.scale.set(scale, scale, 1)
      const mat = innerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * (1 - t)
    }
    // Outer ring: slower expand, orange/red
    if (outerRef.current) {
      const t = Math.min(1, age / 0.4)
      const scale = t * EXPLOSION_RADIUS * 2.2
      outerRef.current.scale.set(scale, scale, 1)
      const mat = outerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.5 * (1 - t)
    }
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, 5 * (1 - age / 0.3))
    }
    // Embers
    if (emberPointsRef.current) {
      const posAttr = emberPointsRef.current.geometry.attributes.position as THREE.BufferAttribute
      const sizeAttr = emberPointsRef.current.geometry.attributes.size as THREE.BufferAttribute
      for (let i = 0; i < emberCount; i++) {
        emberAges.current[i] += delta
        const t = Math.min(1, emberAges.current[i] / 1.2)
        emberPositions.current[i * 3] += emberVelocities.current[i * 3] * delta
        emberPositions.current[i * 3 + 1] += emberVelocities.current[i * 3 + 1] * delta
        emberPositions.current[i * 3 + 2] += emberVelocities.current[i * 3 + 2] * delta
        posAttr.array[i * 3] = emberPositions.current[i * 3]
        posAttr.array[i * 3 + 1] = emberPositions.current[i * 3 + 1]
        posAttr.array[i * 3 + 2] = emberPositions.current[i * 3 + 2]
        sizeAttr.array[i] = emberSizes.current[i] * (1 - t)
      }
      posAttr.needsUpdate = true
      sizeAttr.needsUpdate = true
    }
  })

  return (
    <group position={[pos.x, 0, pos.z]}>
      {/* Inner ring: white/yellow, fast */}
      <mesh ref={innerRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 1, 48]} />
        <meshBasicMaterial color="#fffbe6" transparent opacity={0.8} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Outer ring: orange/red, slower */}
      <mesh ref={outerRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial color="#ff4500" transparent opacity={0.5} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Flash light */}
      <pointLight ref={lightRef} position={[0, 1.5, 0]} color="#ffa500" intensity={5} distance={10} />
      {/* Ember particles */}
      <points ref={emberPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={emberCount} array={emberPositions.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={emberCount} array={emberColors.current} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={emberCount} array={emberSizes.current} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial vertexColors sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

// ── V5: Supernova — everything + fireball core + chain scaling ──

function SupernovaExplosion({ pos, age, chainDepth }: { pos: { x: number; z: number }; age: number; chainDepth: number }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const flashTriggered = useRef(false)
  const scorchSpawned = useRef(false)

  // Chain scaling: each chain explosion is bigger
  const chainScale = 1 + chainDepth * 0.3

  if (!flashTriggered.current) {
    flashTriggered.current = true
    useGameStore.getState().triggerScreenFlash()
    useGameStore.getState().triggerScreenShake(Math.min(1.5, 0.8 + chainDepth * 0.2), 300)
  }
  if (!scorchSpawned.current) {
    scorchSpawned.current = true
    spawnGroundCrack(pos.x, pos.z)
  }

  useFrame(() => {
    // Fireball core: bright sphere that expands and fades
    if (coreRef.current) {
      const t = Math.min(1, age / 0.25)
      const scale = (0.5 + t * 2) * chainScale
      coreRef.current.scale.set(scale, scale, scale)
      const mat = coreRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.9 * (1 - t)
    }
  })

  return (
    <group>
      {/* Fireball core */}
      <mesh ref={coreRef} position={[pos.x, 0.8, pos.z]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#fff4e0" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* All of V4's effects with chain scaling */}
      <group scale={[chainScale, chainScale, chainScale]}>
        <DoubleRingExplosion pos={pos} age={age} />
      </group>
      {/* Extra particle burst */}
      <FireburstExplosion pos={pos} age={age} />
    </group>
  )
}

// ── Main component: manages active explosions and delegates to version ──

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
    // Cleanup expired explosions
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
            return <DoubleRingExplosion key={exp.id} pos={pos} age={age} />
          case 'supernova':
            return <SupernovaExplosion key={exp.id} pos={pos} age={age} chainDepth={exp.chainDepth} />
          default:
            return <FireburstExplosion key={exp.id} pos={pos} age={age} />
        }
      })}
    </>
  )
}
