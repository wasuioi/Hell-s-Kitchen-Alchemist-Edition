import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { ARENA_SIZE } from './Arena'

const PLAYER_SPEED = 8
const PLAYER_RADIUS = 0.5
const BOUNDARY = ARENA_SIZE / 2 - PLAYER_RADIUS - 0.5

const keys: Record<string, boolean> = {}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true })
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })
}

export default function Player() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') return
    const timeScale = useGameStore.getState().timeScale
    const { status } = usePlayerStore.getState()
    const speedMult = status === 'soaked' ? 0.5 : status === 'stunned' ? 0 : 1
    let dx = 0, dz = 0
    if (keys['w'] || keys['arrowup']) dz -= 1
    if (keys['s'] || keys['arrowdown']) dz += 1
    if (keys['a'] || keys['arrowleft']) dx -= 1
    if (keys['d'] || keys['arrowright']) dx += 1
    if (dx === 0 && dz === 0) return
    const len = Math.sqrt(dx * dx + dz * dz); dx /= len; dz /= len
    const pos = usePlayerStore.getState().position
    const newX = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.x + dx * PLAYER_SPEED * speedMult * timeScale * delta))
    const newZ = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.z + dz * PLAYER_SPEED * speedMult * timeScale * delta))
    usePlayerStore.getState().setPosition({ x: newX, z: newZ })
    usePlayerStore.getState().setRotation(Math.atan2(dx, -dz))
  })

  const phase = useGameStore((s) => s.phase)
  const position = usePlayerStore((s) => s.position)
  const rotation = usePlayerStore((s) => s.rotation)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)

  if (phase !== 'combat' && phase !== 'boss') return null

  return (
    <group position={[position.x, 0, position.z]}>
      <mesh ref={meshRef} position={[0, 0.75, 0]} rotation={[0, rotation, 0]} castShadow>
        <capsuleGeometry args={[PLAYER_RADIUS, 0.8, 8, 16]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <Html position={[0, 2, 0]} center>
        <div style={{ width: '60px', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${(hp / maxHp) * 100}%`, height: '100%', background: hp / maxHp > 0.3 ? '#22c55e' : '#ef4444', borderRadius: '3px', transition: 'width 0.2s' }} />
        </div>
      </Html>
    </group>
  )
}
