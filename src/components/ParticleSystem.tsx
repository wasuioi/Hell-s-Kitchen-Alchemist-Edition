import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpellType } from '../types'
import { PARTICLE_CONFIG } from '../data/particleConfig'

// --- Texture generators (run once at module level) ---

function createCircleTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  )
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  return texture
}

function createSquareTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
  ctx.shadowBlur = 4
  ctx.fillStyle = 'rgba(255, 255, 255, 1)'
  ctx.fillRect(4, 4, size - 8, size - 8)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  return texture
}

const circleTexture = createCircleTexture()
const squareTexture = createSquareTexture()

// --- Constants ---

const BURST_COUNT = 50
const MAX_LINGER = 75
const TOTAL_PARTICLES = BURST_COUNT + MAX_LINGER

const LINGER_SPAWN_INTERVAL = 0.2
const LINGER_BATCH_SIZE = 5

// --- Component ---

interface ParticleSystemProps {
  type: SpellType
  duration: number
  radius: number
}

export default function ParticleSystem({ type, duration, radius }: ParticleSystemProps) {
  const config = PARTICLE_CONFIG[type]
  const texture = config.texture === 'square' ? squareTexture : circleTexture

  // --- Refs for particle state (not buffer attributes — updated per frame) ---
  const velocities = useRef(new Float32Array(TOTAL_PARTICLES * 3))
  const ages = useRef(new Float32Array(TOTAL_PARTICLES))
  const lifetimes = useRef(new Float32Array(TOTAL_PARTICLES))
  const baseSizes = useRef(new Float32Array(TOTAL_PARTICLES))
  const lingerTimer = useRef(0)
  const lingerIndex = useRef(0) // next slot in linger region
  const spellAge = useRef(0)
  const initialized = useRef(false)

  // --- Buffer attributes (synced to GPU each frame) ---
  const positions = useMemo(() => new Float32Array(TOTAL_PARTICLES * 3), [])
  const colors = useMemo(() => new Float32Array(TOTAL_PARTICLES * 3), [])
  const sizes = useMemo(() => new Float32Array(TOTAL_PARTICLES), [])

  const pointsRef = useRef<THREE.Points>(null)

  // Parse spell color once
  const spellColor = useMemo(() => new THREE.Color(config.color), [config.color])

  // --- Initialize burst particles on first frame ---
  function initBurst() {
    const vel = velocities.current
    const age = ages.current
    const lt = lifetimes.current

    for (let i = 0; i < BURST_COUNT; i++) {
      const i3 = i * 3

      // Position: all start at origin (0,0,0) since parent group is at spell position
      positions[i3] = 0
      positions[i3 + 1] = 0.1 // slightly above ground
      positions[i3 + 2] = 0

      // Random direction on unit sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const vx = Math.sin(phi) * Math.cos(theta)
      let vy = Math.sin(phi) * Math.sin(theta)
      let vz = Math.cos(phi)

      // Hemisphere for stone spells — force vy upward
      if (config.burstDirection === 'hemisphere') {
        vy = Math.abs(vy)
      }

      // Speed: 8-15 units/sec
      const speed = 8 + Math.random() * 7
      vel[i3] = vx * speed
      vel[i3 + 1] = vy * speed
      vel[i3 + 2] = vz * speed

      // Age and lifetime
      age[i] = 0
      lt[i] = 0.3 + Math.random() * 0.2 // 0.3 - 0.5s

      // Start color: white
      colors[i3] = 1
      colors[i3 + 1] = 1
      colors[i3 + 2] = 1

      // Size: 0.3 - 0.6
      baseSizes.current[i] = 0.3 + Math.random() * 0.3
      sizes[i] = baseSizes.current[i]
    }

    // Initialize linger particles as dead (off screen)
    for (let i = BURST_COUNT; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3
      positions[i3] = 0
      positions[i3 + 1] = -999
      positions[i3 + 2] = 0
      vel[i3] = 0
      vel[i3 + 1] = 0
      vel[i3 + 2] = 0
      age[i] = 999
      lt[i] = 1
      colors[i3] = 0
      colors[i3 + 1] = 0
      colors[i3 + 2] = 0
      sizes[i] = 0
    }
  }

  useFrame((_, delta) => {
    if (!initialized.current) {
      initBurst()
      initialized.current = true
    }

    spellAge.current += delta
    const vel = velocities.current
    const age = ages.current
    const lt = lifetimes.current

    // --- Update burst particles ---
    for (let i = 0; i < BURST_COUNT; i++) {
      const i3 = i * 3
      age[i] += delta

      if (age[i] > lt[i]) {
        // Dead — move off screen
        positions[i3 + 1] = -999
        sizes[i] = 0
        vel[i3] = 0
        vel[i3 + 1] = 0
        vel[i3 + 2] = 0
        continue
      }

      const t = age[i] / lt[i] // 0..1 normalized age

      // Meteor jitter: random velocity perturbation in first 0.1s
      if (config.meteorJitter && age[i] < 0.1) {
        vel[i3] += (Math.random() - 0.5) * 20 * delta
        vel[i3 + 1] += (Math.random() - 0.5) * 20 * delta
        vel[i3 + 2] += (Math.random() - 0.5) * 20 * delta
      }

      // Friction (frame-rate independent)
      const friction = Math.pow(0.95, delta * 60)
      vel[i3] *= friction
      vel[i3 + 1] *= friction
      vel[i3 + 2] *= friction

      // Move
      positions[i3] += vel[i3] * delta
      positions[i3 + 1] += vel[i3 + 1] * delta
      positions[i3 + 2] += vel[i3 + 2] * delta

      // Color flicker: white -> spell color -> dark
      if (t < 0.5) {
        // White to spell color
        const blend = t / 0.5
        colors[i3] = 1 + (spellColor.r - 1) * blend
        colors[i3 + 1] = 1 + (spellColor.g - 1) * blend
        colors[i3 + 2] = 1 + (spellColor.b - 1) * blend
      } else {
        // Spell color to dark
        const blend = (t - 0.5) / 0.5
        colors[i3] = spellColor.r * (1 - blend)
        colors[i3 + 1] = spellColor.g * (1 - blend)
        colors[i3 + 2] = spellColor.b * (1 - blend)
      }

      // Fire flicker: oscillate RGB slightly
      if (config.fireFlicker) {
        const flicker = Math.sin(age[i] * 30) * 0.15
        colors[i3] = Math.min(1, Math.max(0, colors[i3] + flicker))
        colors[i3 + 1] = Math.min(1, Math.max(0, colors[i3 + 1] + flicker * 0.3))
      }

      // Fade size with opacity
      sizes[i] = baseSizes.current[i] * (1 - t)
    }

    // --- Spawn new linger particles ---
    if (spellAge.current < duration) {
      lingerTimer.current += delta
      while (lingerTimer.current >= LINGER_SPAWN_INTERVAL) {
        lingerTimer.current -= LINGER_SPAWN_INTERVAL

        for (let b = 0; b < LINGER_BATCH_SIZE; b++) {
          const i = BURST_COUNT + (lingerIndex.current % MAX_LINGER)
          lingerIndex.current++
          const i3 = i * 3

          // Random position on 2D disk within spell radius
          const angle = Math.random() * Math.PI * 2
          const dist = Math.sqrt(Math.random()) * radius
          positions[i3] = Math.cos(angle) * dist
          positions[i3 + 1] = 0.05 // ground level
          positions[i3 + 2] = Math.sin(angle) * dist

          // Velocity: slow upward + slight horizontal drift
          vel[i3] = (Math.random() - 0.5) * 0.6
          vel[i3 + 1] = config.lingerYSpeed
          vel[i3 + 2] = (Math.random() - 0.5) * 0.6

          // Age and lifetime
          age[i] = 0
          lt[i] = 0.8 + Math.random() * 0.4 // 0.8 - 1.2s

          // Start at spell color
          colors[i3] = spellColor.r
          colors[i3 + 1] = spellColor.g
          colors[i3 + 2] = spellColor.b

          // Size: 0.15 - 0.3
          baseSizes.current[i] = 0.15 + Math.random() * 0.15
          sizes[i] = baseSizes.current[i]
        }
      }
    }

    // --- Update linger particles ---
    for (let i = BURST_COUNT; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3
      if (age[i] > lt[i]) {
        // Dead
        positions[i3 + 1] = -999
        sizes[i] = 0
        continue
      }

      age[i] += delta
      if (age[i] > lt[i]) {
        positions[i3 + 1] = -999
        sizes[i] = 0
        continue
      }

      // Move upward
      positions[i3] += vel[i3] * delta
      positions[i3 + 1] += vel[i3 + 1] * delta
      positions[i3 + 2] += vel[i3 + 2] * delta

      // Fade-in over first 0.1s, then fade out
      let opacity: number
      if (age[i] < 0.1) {
        opacity = age[i] / 0.1
      } else {
        opacity = 1 - ((age[i] - 0.1) / (lt[i] - 0.1))
      }
      opacity = Math.max(0, Math.min(1, opacity))

      // Apply opacity via color intensity
      colors[i3] = spellColor.r * opacity
      colors[i3 + 1] = spellColor.g * opacity
      colors[i3 + 2] = spellColor.b * opacity

      // Fire flicker on linger too
      if (config.fireFlicker) {
        const flicker = Math.sin(age[i] * 25) * 0.1
        colors[i3] = Math.min(1, Math.max(0, colors[i3] + flicker))
      }

      // Shrink slightly as it fades
      sizes[i] = baseSizes.current[i] * opacity
    }

    // --- Sync buffers to GPU ---
    if (pointsRef.current) {
      const geo = pointsRef.current.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.attributes.size.needsUpdate = true
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        vertexColors
        transparent
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
