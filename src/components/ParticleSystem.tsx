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

  // Placeholder — will be filled in Task 3 and Task 4
  return null
}
