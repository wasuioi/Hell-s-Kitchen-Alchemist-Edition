import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ARENA_SIZE } from './Arena'

// Drifting hellfire embers + faint smoke wisps spawned from the four
// corners of the arena. Pure visual flavor, no gameplay impact.
const EMBER_COUNT = 80
const SMOKE_COUNT = 24

const CORNERS: Array<[number, number]> = [
  [ARENA_SIZE / 2 - 1, ARENA_SIZE / 2 - 1],
  [-(ARENA_SIZE / 2 - 1), ARENA_SIZE / 2 - 1],
  [ARENA_SIZE / 2 - 1, -(ARENA_SIZE / 2 - 1)],
  [-(ARENA_SIZE / 2 - 1), -(ARENA_SIZE / 2 - 1)],
]

function createEmberTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255, 220, 120, 1)')
  grad.addColorStop(0.4, 'rgba(255, 130, 30, 0.9)')
  grad.addColorStop(1, 'rgba(180, 40, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  return tex
}

function createSmokeTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(50, 30, 25, 0.6)')
  grad.addColorStop(1, 'rgba(20, 10, 8, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  return tex
}

interface Particle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
}

function spawnEmber(): Particle {
  const [cx, cz] = CORNERS[Math.floor(Math.random() * CORNERS.length)]
  return {
    position: new THREE.Vector3(
      cx + (Math.random() - 0.5) * 1.2,
      0.1 + Math.random() * 0.3,
      cz + (Math.random() - 0.5) * 1.2,
    ),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      0.5 + Math.random() * 0.7,
      (Math.random() - 0.5) * 0.3,
    ),
    life: 0,
    maxLife: 1.5 + Math.random() * 1.5,
  }
}

function spawnSmoke(): Particle {
  const [cx, cz] = CORNERS[Math.floor(Math.random() * CORNERS.length)]
  return {
    position: new THREE.Vector3(
      cx + (Math.random() - 0.5) * 1.5,
      0.5 + Math.random() * 0.5,
      cz + (Math.random() - 0.5) * 1.5,
    ),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      0.3 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.2,
    ),
    life: 0,
    maxLife: 3 + Math.random() * 2,
  }
}

export default function AmbientEmbers() {
  const emberRef = useRef<THREE.Points>(null)
  const smokeRef = useRef<THREE.Points>(null)
  const emberTex = useMemo(() => createEmberTexture(), [])
  const smokeTex = useMemo(() => createSmokeTexture(), [])

  // Mutable particle state — useRef so React doesn't track changes.
  const embersRef = useRef<Particle[]>([])
  const smokesRef = useRef<Particle[]>([])
  // Buffer geometries that get attached to <bufferAttribute>. useMemo keeps
  // the references stable across renders (matches ParticleSystem.tsx).
  const emberPositions = useMemo(() => new Float32Array(EMBER_COUNT * 3), [])
  const emberOpacities = useMemo(() => new Float32Array(EMBER_COUNT), [])
  const smokePositions = useMemo(() => new Float32Array(SMOKE_COUNT * 3), [])
  const smokeOpacities = useMemo(() => new Float32Array(SMOKE_COUNT), [])

  // Init particle pool once. Math.random() lives in an effect so the lint
  // rule about pure renders is happy. useFrame still bails (early-returns)
  // until the pool is initialized.
  useEffect(() => {
    for (let i = 0; i < EMBER_COUNT; i++) {
      const p = spawnEmber()
      // Stagger initial life so they don't all spawn at once
      p.life = Math.random() * p.maxLife
      embersRef.current.push(p)
    }
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const p = spawnSmoke()
      p.life = Math.random() * p.maxLife
      smokesRef.current.push(p)
    }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const embers = embersRef.current
    const smokes = smokesRef.current
    // Skip until init effect has populated the pool
    if (embers.length === 0 || smokes.length === 0) return

    for (let i = 0; i < EMBER_COUNT; i++) {
      const p = embers[i]
      p.life += dt
      if (p.life >= p.maxLife) Object.assign(p, spawnEmber())
      p.position.addScaledVector(p.velocity, dt)
      // Slow horizontal drift damping + slight upward acceleration
      p.velocity.x *= 0.99
      p.velocity.z *= 0.99
      emberPositions[i * 3] = p.position.x
      emberPositions[i * 3 + 1] = p.position.y
      emberPositions[i * 3 + 2] = p.position.z
      const t = p.life / p.maxLife
      emberOpacities[i] = (1 - t) * (t < 0.2 ? t / 0.2 : 1)
    }

    for (let i = 0; i < SMOKE_COUNT; i++) {
      const p = smokes[i]
      p.life += dt
      if (p.life >= p.maxLife) Object.assign(p, spawnSmoke())
      p.position.addScaledVector(p.velocity, dt)
      p.velocity.x *= 0.995
      p.velocity.z *= 0.995
      smokePositions[i * 3] = p.position.x
      smokePositions[i * 3 + 1] = p.position.y
      smokePositions[i * 3 + 2] = p.position.z
      const t = p.life / p.maxLife
      smokeOpacities[i] = (1 - t) * 0.4
    }

    if (emberRef.current) {
      const geom = emberRef.current.geometry
      const posAttr = geom.attributes.position as THREE.BufferAttribute
      posAttr.needsUpdate = true
      const opAttr = geom.attributes.opacity as THREE.BufferAttribute
      opAttr.needsUpdate = true
    }
    if (smokeRef.current) {
      const geom = smokeRef.current.geometry
      const posAttr = geom.attributes.position as THREE.BufferAttribute
      posAttr.needsUpdate = true
      const opAttr = geom.attributes.opacity as THREE.BufferAttribute
      opAttr.needsUpdate = true
    }
  })

  return (
    <>
      <points ref={emberRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[emberPositions, 3]}
            count={EMBER_COUNT}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-opacity"
            args={[emberOpacities, 1]}
            count={EMBER_COUNT}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          map={emberTex}
          size={0.18}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#ff8030"
        />
      </points>
      <points ref={smokeRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[smokePositions, 3]}
            count={SMOKE_COUNT}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-opacity"
            args={[smokeOpacities, 1]}
            count={SMOKE_COUNT}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          map={smokeTex}
          size={0.9}
          sizeAttenuation
          transparent
          depthWrite={false}
          opacity={0.4}
          color="#3a2820"
        />
      </points>
    </>
  )
}
