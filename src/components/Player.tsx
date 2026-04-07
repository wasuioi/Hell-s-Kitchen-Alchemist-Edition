import { useRef, useState } from 'react'
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
  ;(window as any).__playerKeys = keys
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true })
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })
}

export default function Player() {
  const meshRef = useRef<THREE.Mesh>(null)
  const ghostsRef = useRef<{ x: number; z: number; time: number; index: number }[]>([])
  const [ghosts, setGhosts] = useState<{ x: number; z: number; time: number; index: number }[]>([])
  const ghostIndex = useRef(0)
  const lastSpellColor = useRef('#22c55e')
  const dashTrailColor = useRef('#22c55e')

  useFrame((_, delta) => {
    // Register global callback so castSpell can notify us of the last spell color
    if (!(window as any).__setLastSpellColor) {
      ;(window as any).__setLastSpellColor = (color: string) => { lastSpellColor.current = color }
    }

    // Clean expired ghosts and sync to state for re-render
    const ghostNow = performance.now()
    const before = ghostsRef.current.length
    ghostsRef.current = ghostsRef.current.filter((g) => ghostNow - g.time < 300)
    if (ghostsRef.current.length !== before) {
      setGhosts([...ghostsRef.current])
    }

    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') return
    const timeScale = useGameStore.getState().timeScale
    const { status, isDashing, dashDirection, dashEndTime } = usePlayerStore.getState()

    // Check if dash should end
    if (isDashing && performance.now() >= dashEndTime) {
      usePlayerStore.getState().endDash()
    }

    // During dash: move in locked direction at 3x speed
    if (isDashing && dashDirection) {
      const pos = usePlayerStore.getState().position
      const dashSpeed = PLAYER_SPEED * 3 * timeScale * delta
      const newX = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.x + dashDirection.x * dashSpeed))
      const newZ = Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.z + dashDirection.z * dashSpeed))
      // Capture trail color on first frame of dash
      if (ghostsRef.current.length === 0) {
        ghostIndex.current = 0
        const playerStatus = usePlayerStore.getState().status
        dashTrailColor.current = playerStatus === 'soaked' ? '#3b82f6' : lastSpellColor.current
      }
      // Record ghost position for trail
      ghostsRef.current.push({ x: pos.x, z: pos.z, time: performance.now(), index: ghostIndex.current++ })
      setGhosts([...ghostsRef.current])
      usePlayerStore.getState().setPosition({ x: newX, z: newZ })
      return
    }

    // Normal movement
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
    <>
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
      {/* Dash ghost trail — earlier ghosts fade faster for a smooth streaking effect */}
      {ghosts.map((ghost) => {
        const age = (performance.now() - ghost.time) / 300
        // Stagger: earlier ghosts (lower index) get shorter lifetimes
        const totalGhosts = ghostIndex.current || 1
        const positionRatio = ghost.index / totalGhosts // 0 = first, ~1 = last
        const maxOpacity = 0.15 + 0.25 * positionRatio // first=0.15, last=0.4
        const opacity = Math.max(0, maxOpacity * (1 - age))
        if (opacity <= 0) return null
        return (
          <mesh key={ghost.index} position={[ghost.x, 0.75, ghost.z]} rotation={[0, rotation, 0]}>
            <capsuleGeometry args={[PLAYER_RADIUS, 0.8, 8, 16]} />
            <meshStandardMaterial color={dashTrailColor.current} transparent opacity={opacity} />
          </mesh>
        )
      })}
    </>
  )
}
