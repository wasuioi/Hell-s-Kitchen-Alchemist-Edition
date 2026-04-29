import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore, BOILING_POINT_MAX_HEAT } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { ARENA_SIZE } from './Arena'

const PLAYER_SPEED = 8
const PLAYER_RADIUS = 0.5
const BOUNDARY = ARENA_SIZE / 2 - PLAYER_RADIUS - 0.5

const keys: Record<string, boolean> = {}
if (typeof window !== 'undefined') {
  ; (window as any).__playerKeys = keys
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true })
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })
}

const WIZARD_MODEL_PATH = '/models/wizard/Wizard.gltf'
const WIZARD_SCALE = 0.9

if (typeof document !== 'undefined' && !document.getElementById('heat-shake-keyframes')) {
  const style = document.createElement('style')
  style.id = 'heat-shake-keyframes'
  style.textContent = `
    @keyframes heat-shake-light {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(-1px, 0); }
      75% { transform: translate(1px, 0); }
    }
    @keyframes heat-shake-heavy {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(-2px, -1px); }
      40% { transform: translate(2px, 1px); }
      60% { transform: translate(-2px, 1px); }
      80% { transform: translate(2px, -1px); }
    }
  `
  document.head.appendChild(style)
}

export default function Player() {
  const { scene, animations } = useGLTF(WIZARD_MODEL_PATH)
  const groupRef = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, groupRef)
  const currentAnim = useRef<string>('')
  const isMoving = useRef(false)
  const isAttacking = useRef(false)
  const attackEndTime = useRef(0)

  const ghostsRef = useRef<{ x: number; z: number; time: number; index: number }[]>([])
  const [ghosts, setGhosts] = useState<{ x: number; z: number; time: number; index: number }[]>([])
  const ghostIndex = useRef(0)
  const lastSpellColor = useRef('#22c55e')
  const dashTrailColor = useRef('#22c55e')

  // Play idle animation on mount
  useEffect(() => {
    if (actions['Idle']) {
      actions['Idle'].play()
      currentAnim.current = 'Idle'
    }
  }, [actions])

  useFrame((_, delta) => {
    // Register global callbacks
    if (!(window as any).__setLastSpellColor) {
      ; (window as any).__setLastSpellColor = (color: string) => { lastSpellColor.current = color }
    }
    if (!(window as any).__playerAttack) {
      ; (window as any).__playerAttack = () => {
        isAttacking.current = true
        attackEndTime.current = performance.now() + 600
      }
    }

    // Clean expired ghosts and sync to state for re-render
    const ghostNow = performance.now()
    const before = ghostsRef.current.length
    ghostsRef.current = ghostsRef.current.filter((g) => ghostNow - g.time < 300)
    // Re-render every frame while ghosts exist so opacity fades smoothly
    if (ghostsRef.current.length > 0 || ghostsRef.current.length !== before) {
      setGhosts([...ghostsRef.current])
    }

    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') return

    // BoilingPoint Heat decay — fires every frame, but `decayHeat` is a
    // no-op until the 4s window since the last hit has elapsed.
    const bpStacksTick = useDeckStore.getState().activePerks.find((p) => p.id === 'boiling_point')?.stackCount ?? 0
    if (bpStacksTick > 0) usePlayerStore.getState().decayHeat(4000)

    const timeScale = useGameStore.getState().timeScale
    const { status, isDashing, dashDirection, dashEndTime } = usePlayerStore.getState()

    // Check if dash should end
    if (isDashing && performance.now() >= dashEndTime) {
      usePlayerStore.getState().endDash()
    }

    // During dash: move in locked direction at 3x speed
    if (isDashing && dashDirection) {
      const pos = usePlayerStore.getState().position
      const dashSpeed = PLAYER_SPEED * 2 * timeScale * delta
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
    usePlayerStore.getState().setRotation(Math.atan2(dx, dz))

    // Track movement for animation
    isMoving.current = true
  })

  // Switch base animation (Idle/Run) + overlay attack
  useFrame(() => {
    const moving = isMoving.current
    const baseAnim = moving ? 'Run' : 'Idle'
    isMoving.current = false

    // Switch base animation (Idle <-> Run)
    if (baseAnim !== currentAnim.current && actions[baseAnim]) {
      const prev = actions[currentAnim.current]
      const next = actions[baseAnim]
      prev?.fadeOut(0.15)
      next?.reset().fadeIn(0.15).play()
      currentAnim.current = baseAnim
    }

    // Play Staff_Attack on top when casting — it plays once then stops
    if (isAttacking.current && actions['Staff_Attack'] && !actions['Staff_Attack'].isRunning()) {
      const atk = actions['Staff_Attack']
      atk.reset()
      atk.setLoop(THREE.LoopOnce, 1)
      atk.clampWhenFinished = true
      atk.timeScale = 1.5
      atk.play()
    }

    // Check if attack ended
    if (isAttacking.current && performance.now() >= attackEndTime.current) {
      isAttacking.current = false
      actions['Staff_Attack']?.fadeOut(0.15)
    }

    // Lock root bone position to prevent animation root motion from drifting the model
    if (groupRef.current) {
      scene.position.set(0, 0, 0)
    }
  })

  const phase = useGameStore((s) => s.phase)
  const position = usePlayerStore((s) => s.position)
  const rotation = usePlayerStore((s) => s.rotation)
  const hp = usePlayerStore((s) => s.hp)
  const maxHp = usePlayerStore((s) => s.maxHp)
  const heatStacks = usePlayerStore((s) => s.heatStacks)
  const bpStacks = useDeckStore((s) => s.activePerks.find((p) => p.id === 'boiling_point')?.stackCount ?? 0)
  const maxHeat = bpStacks > 0 ? BOILING_POINT_MAX_HEAT[Math.min(bpStacks, 3) - 1] : 0

  if (phase !== 'combat' && phase !== 'boss') return null

  return (
    <>
      <group position={[position.x, 0, position.z]}>
        <group ref={groupRef} rotation={[0, rotation, 0]} scale={[WIZARD_SCALE, WIZARD_SCALE, WIZARD_SCALE]}>
          <primitive object={scene} />
        </group>
        <Html position={[0, 2.2, 0]} center>
          <div style={{ width: '60px', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(hp / maxHp) * 100}%`, height: '100%', background: hp / maxHp > 0.3 ? '#22c55e' : '#ef4444', borderRadius: '3px', transition: 'width 0.2s' }} />
          </div>
        </Html>
        {heatStacks > 0 && (
          <Html position={[0, 2.6, 0]} center>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: heatStackColor(heatStacks, maxHeat),
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 6px currentColor',
                animation: heatShakeAnimation(heatStacks, maxHeat),
              }}
            >
              {heatStacks}
            </div>
          </Html>
        )}
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

useGLTF.preload(WIZARD_MODEL_PATH)

// Heat stack number color: yellow (low) → red (max)
function heatStackColor(stacks: number, max: number): string {
  if (max === 0) return '#fbbf24'
  const t = Math.min(1, stacks / max)
  const r = Math.round(251 + (239 - 251) * t) // 251 → 239
  const g = Math.round(191 + (68 - 191) * t)  // 191 → 68
  const b = Math.round(36 + (68 - 36) * t)    // 36 → 68
  return `rgb(${r}, ${g}, ${b})`
}

// Increasing shake intensity as Heat approaches the cap.
function heatShakeAnimation(stacks: number, max: number): string {
  if (max === 0) return 'none'
  const t = stacks / max
  if (t < 0.4) return 'none'
  if (t < 0.7) return 'heat-shake-light 0.6s infinite'
  return 'heat-shake-heavy 0.15s infinite'
}
