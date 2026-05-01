import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../stores/gameStore'

const ARENA_SIZE = 32
const WALL_HEIGHT = 3
const WALL_THICKNESS = 0.5
// Tile texture density — keep one repeat per ~10 world units so tiles
// stay roughly the same visual size regardless of arena size.
const FLOOR_REPEAT = ARENA_SIZE / 10
const WALL_REPEAT = ARENA_SIZE / 5

// Procedural canvas-generated textures (no asset files = no extra download).
// Floor: dark stone tiles with grease stains, cracks, and red lava seams.
function createFloorTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Dark base
  ctx.fillStyle = '#2a1f18'
  ctx.fillRect(0, 0, size, size)

  // Stone tile grid (4×4 tiles per texture)
  const tileSize = size / 4
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = 24 + Math.floor(Math.random() * 24)
      ctx.fillStyle = `rgb(${v + 8}, ${v}, ${v - 4})`
      ctx.fillRect(i * tileSize + 2, j * tileSize + 2, tileSize - 4, tileSize - 4)
    }
  }

  // Grease / burn stains (random dark blotches)
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 8 + Math.random() * 24
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(8, 4, 2, 0.7)')
    grad.addColorStop(1, 'rgba(8, 4, 2, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Hairline cracks
  ctx.strokeStyle = '#0a0604'
  ctx.lineWidth = 1
  for (let i = 0; i < 12; i++) {
    ctx.beginPath()
    let x = Math.random() * size
    let y = Math.random() * size
    ctx.moveTo(x, y)
    const steps = 3 + Math.floor(Math.random() * 4)
    for (let s = 0; s < steps; s++) {
      x += (Math.random() - 0.5) * 60
      y += (Math.random() - 0.5) * 60
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Red lava seams (emissive-feeling glow lines, sparse)
  for (let i = 0; i < 4; i++) {
    const grad = ctx.createLinearGradient(0, 0, 0, 30)
    grad.addColorStop(0, 'rgba(255, 100, 20, 0)')
    grad.addColorStop(0.5, 'rgba(255, 140, 40, 0.6)')
    grad.addColorStop(1, 'rgba(255, 100, 20, 0)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 2
    ctx.beginPath()
    let x = Math.random() * size
    let y = Math.random() * size
    ctx.moveTo(x, y)
    const steps = 4 + Math.floor(Math.random() * 4)
    for (let s = 0; s < steps; s++) {
      x += (Math.random() - 0.5) * 80
      y += (Math.random() - 0.5) * 80
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(FLOOR_REPEAT, FLOOR_REPEAT)
  tex.needsUpdate = true
  return tex
}

// Wall: dark fire-blackened brick with subtle red mortar glow.
function createWallTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Dark base
  ctx.fillStyle = '#1a0f0a'
  ctx.fillRect(0, 0, size, size)

  // Brick pattern (8 rows × 4 bricks, offset every other row)
  const rows = 8
  const cols = 4
  const brickH = size / rows
  const brickW = size / cols
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (brickW / 2)
    for (let c = -1; c <= cols; c++) {
      const x = c * brickW + offset
      const y = r * brickH
      // Vary brick color — dark red/brown to nearly black
      const v = 20 + Math.floor(Math.random() * 30)
      const tint = Math.random() > 0.7 ? 20 : 0 // occasional red-tinted brick
      ctx.fillStyle = `rgb(${v + tint}, ${v - 4}, ${v - 8})`
      ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4)

      // Soot streaks
      if (Math.random() > 0.6) {
        const grad = ctx.createLinearGradient(x, y, x, y + brickH)
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.6)')
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = grad
        ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4)
      }
    }
  }

  // Glowing mortar (subtle red lines between bricks)
  ctx.strokeStyle = 'rgba(180, 50, 20, 0.35)'
  ctx.lineWidth = 1
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * brickH)
    ctx.lineTo(size, r * brickH)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(WALL_REPEAT, 1)
  tex.needsUpdate = true
  return tex
}

// Floor emissive presets per pacing phase (issue #69). Hellfire orange is the
// baseline (matches the kitchen theme); the surge cooks the floor brighter and
// hotter, the lull bleeds it toward an icy steel-blue "calm before boss".
const FLOOR_BASE_EMISSIVE = new THREE.Color('#ff4408')
const FLOOR_BASE_INTENSITY = 0.55
const FLOOR_SURGE_EMISSIVE = new THREE.Color('#ff1a00')
const FLOOR_SURGE_INTENSITY = 1.4
const FLOOR_LULL_EMISSIVE = new THREE.Color('#3a6df5')
const FLOOR_LULL_INTENSITY = 0.35
const FLOOR_TINT_LERP = 4 // higher = snappier transition

export default function Arena() {
  const floorTex = useMemo(() => createFloorTexture(), [])
  const wallTex = useMemo(() => createWallTexture(), [])
  const floorMatRef = useRef<THREE.MeshStandardMaterial>(null!)

  useFrame((_, delta) => {
    const mat = floorMatRef.current
    if (!mat) return
    const { phase, surgeActive } = useGameStore.getState()
    const target = surgeActive
      ? { color: FLOOR_SURGE_EMISSIVE, intensity: FLOOR_SURGE_INTENSITY }
      : phase === 'pre-boss-lull'
      ? { color: FLOOR_LULL_EMISSIVE, intensity: FLOOR_LULL_INTENSITY }
      : { color: FLOOR_BASE_EMISSIVE, intensity: FLOOR_BASE_INTENSITY }
    const t = Math.min(1, delta * FLOOR_TINT_LERP)
    mat.emissive.lerp(target.color, t)
    mat.emissiveIntensity += (target.intensity - mat.emissiveIntensity) * t
  })

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial
          ref={floorMatRef}
          map={floorTex}
          roughness={0.85}
          metalness={0.1}
          emissive="#ff4408"
          emissiveMap={floorTex}
          emissiveIntensity={0.55}
        />
      </mesh>

      {/* Walls (4 sides) */}
      {[
        { pos: [0, WALL_HEIGHT / 2, -ARENA_SIZE / 2] as const, args: [ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS] as const },
        { pos: [0, WALL_HEIGHT / 2, ARENA_SIZE / 2] as const, args: [ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS] as const },
        { pos: [ARENA_SIZE / 2, WALL_HEIGHT / 2, 0] as const, args: [WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE] as const },
        { pos: [-ARENA_SIZE / 2, WALL_HEIGHT / 2, 0] as const, args: [WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE] as const },
      ].map((w, i) => (
        <mesh key={i} position={w.pos} castShadow receiveShadow>
          <boxGeometry args={w.args} />
          <meshStandardMaterial
            map={wallTex}
            roughness={0.9}
            metalness={0.05}
            emissive="#2a0a02"
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* Hellfire glow lights at the four corners — gives the kitchen a
          flickering forge feel without needing animated point lights. */}
      {[
        [ARENA_SIZE / 2 - 1, ARENA_SIZE / 2 - 1],
        [-(ARENA_SIZE / 2 - 1), ARENA_SIZE / 2 - 1],
        [ARENA_SIZE / 2 - 1, -(ARENA_SIZE / 2 - 1)],
        [-(ARENA_SIZE / 2 - 1), -(ARENA_SIZE / 2 - 1)],
      ].map(([x, z], i) => (
        <pointLight
          key={i}
          position={[x, 1.5, z]}
          color="#ff8040"
          intensity={14}
          distance={26}
          decay={2}
        />
      ))}
    </group>
  )
}
export { ARENA_SIZE }
