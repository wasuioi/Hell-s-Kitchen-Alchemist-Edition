import { useRef, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Crack {
  id: string
  position: { x: number; z: number }
  rotation: number
  createdAt: number
}

const MAX_CRACKS = 5
const CRACK_LIFETIME = 3.5
const CRACK_SIZE = 2

let nextCrackId = 0

// Canvas-generated crack texture
function createCrackTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)

  const cx = size / 2, cy = size / 2

  // Draw radiating crack lines
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 2
  const arms = 5 + Math.floor(Math.random() * 4)
  for (let i = 0; i < arms; i++) {
    const angle = (Math.PI * 2 * i) / arms + (Math.random() - 0.5) * 0.4
    const length = size * 0.3 + Math.random() * size * 0.15
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    // Jagged line with 2-3 midpoints
    let x = cx, y = cy
    const steps = 2 + Math.floor(Math.random() * 2)
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      x = cx + Math.cos(angle + (Math.random() - 0.5) * 0.3) * length * t
      y = cy + Math.sin(angle + (Math.random() - 0.5) * 0.3) * length * t
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Pre-generate 3 variations
const crackTextures = [createCrackTexture(), createCrackTexture(), createCrackTexture()]

declare global {
  interface Window {
    __spawnGroundCrack?: (pos: { x: number; z: number }) => void
  }
}

export function spawnGroundCrack(x: number, z: number) {
  window.__spawnGroundCrack?.({ x, z })
}

export default function GroundCracks() {
  const [cracks, setCracks] = useState<Crack[]>([])
  const cracksRef = useRef<Crack[]>([])

  const addCrack = useCallback((pos: { x: number; z: number }) => {
    const crack: Crack = {
      id: `crack_${nextCrackId++}`,
      position: pos,
      rotation: Math.random() * Math.PI * 2,
      createdAt: performance.now(),
    }
    cracksRef.current = [...cracksRef.current, crack].slice(-MAX_CRACKS)
    setCracks([...cracksRef.current])
  }, [])

  useFrame(() => {
    if (!(window as any).__spawnGroundCrack) {
      ;(window as any).__spawnGroundCrack = addCrack
    }
    // Remove expired cracks
    const now = performance.now()
    const alive = cracksRef.current.filter((c) => (now - c.createdAt) / 1000 < CRACK_LIFETIME)
    if (alive.length !== cracksRef.current.length) {
      cracksRef.current = alive
      setCracks([...alive])
    }
  })

  return (
    <>
      {cracks.map((crack) => {
        const age = (performance.now() - crack.createdAt) / 1000
        const opacity = Math.max(0, 1 - age / CRACK_LIFETIME)
        const texIdx = parseInt(crack.id.split('_')[1]) % crackTextures.length
        return (
          <mesh
            key={crack.id}
            position={[crack.position.x, 0.02, crack.position.z]}
            rotation={[-Math.PI / 2, 0, crack.rotation]}
          >
            <planeGeometry args={[CRACK_SIZE * 2, CRACK_SIZE * 2]} />
            <meshBasicMaterial
              map={crackTextures[texIdx]}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </>
  )
}
