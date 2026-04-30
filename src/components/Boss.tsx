import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useEnemyStore } from '../stores/enemyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { isInRange } from '../utils/collision'
import { ARENA_SIZE } from './Arena'

type AttackPhase = 'idle' | 'telegraph' | 'attack'
type AttackType = 'stone_slam' | 'stone_spikes' | 'hand_lance'

interface SaltCircle {
  x: number
  z: number
}

function getEdgeSpawnPosition(): { x: number; z: number } {
  const edge = Math.floor(Math.random() * 4)
  const half = ARENA_SIZE / 2 - 1
  const rand = (Math.random() - 0.5) * ARENA_SIZE * 0.8
  switch (edge) {
    case 0: return { x: rand, z: -half }
    case 1: return { x: rand, z: half }
    case 2: return { x: half, z: rand }
    default: return { x: -half, z: rand }
  }
}

export default function Boss() {
  const boss = useEnemyStore((s) => s.enemies.find((e) => e.type === 'boss'))
  const { scene } = useGLTF('/models/boss/boss.glb')
  const fittedScale = useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    return size.y > 0 ? 3 / size.y : 1
  }, [scene])

  const faceBoneRef = useRef<THREE.Object3D | null>(null)
  const upperArmLRef = useRef<THREE.Object3D | null>(null)
  const upperArmRRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    faceBoneRef.current = scene.getObjectByName('face') ?? null
    upperArmLRef.current = scene.getObjectByName('upper_arm.L') ?? null
    upperArmRRef.current = scene.getObjectByName('upper_arm.R') ?? null
  }, [scene])
  const phase = useGameStore((s) => s.phase)

  const attackTimer = useRef(0)
  const attackPhaseTimer = useRef(0)
  const slimeTimer = useRef(0)
  const attackPhase = useRef<AttackPhase>('idle')
  const currentAttack = useRef<AttackType>('stone_slam')
  const attackIndex = useRef(0)
  const beamAngle = useRef(0)
  const soakDamageTimer = useRef(0)

  const [saltCircles, setSaltCircles] = useState<SaltCircle[]>([])
  const [showHeatRing, setShowHeatRing] = useState(false)
  const [showBeam, setShowBeam] = useState(false)
  const [heatBlast, setHeatBlast] = useState(false)
  const [saltImpact, setSaltImpact] = useState<SaltCircle[]>([])
  const heatBlastScale = useRef(0)
  const saltImpactTimer = useRef(0)

  const beamRef = useRef<THREE.Mesh>(null)

  const ATTACK_ORDER: AttackType[] = ['stone_slam', 'stone_spikes', 'hand_lance']
  const PAUSE_BETWEEN = 5
  const TELEGRAPH_DURATION = 2
  const SOAK_DURATION = 3

  useFrame((_, delta) => {
    if (!boss || phase !== 'boss') return

    const playerPos = usePlayerStore.getState().position
    const face = faceBoneRef.current
    if (face) {
      face.rotation.y = Math.atan2(
        playerPos.x - boss.position.x,
        playerPos.z - boss.position.z,
      )
    }

    const bossPos = boss.position

    // Check boss death
    if (boss.hp <= 0) {
      useEnemyStore.getState().removeEnemy(boss.id)
      useEnemyStore.getState().reset()
      useGameStore.getState().triggerVictory()
      return
    }

    // Check player death
    const playerHp = usePlayerStore.getState().hp
    if (playerHp <= 0) {
      useGameStore.getState().triggerDeath()
      return
    }

    // Spawn slimes every 8 seconds
    slimeTimer.current += delta
    if (slimeTimer.current >= 8) {
      slimeTimer.current = 0
      useEnemyStore.getState().spawnEnemy('slow', getEdgeSpawnPosition())
    }

    // Arm slam animation (stone_slam)
    let slamArmAngle = 0 // 0 = rest (arms down), -1.4 ≈ raised overhead
    if (currentAttack.current === 'stone_slam') {
      if (attackPhase.current === 'telegraph') {
        // Lerp 0 → -1.4 over the 2s telegraph
        const t = Math.min(attackPhaseTimer.current / TELEGRAPH_DURATION, 1)
        slamArmAngle = -1.4 * t
      } else if (attackPhase.current === 'attack') {
        // Snap down on the first 0.15s of the blast, then return to rest
        const blastT = heatBlastScale.current / 6
        if (blastT < 0.2) {
          slamArmAngle = -1.4 + 1.4 * (blastT / 0.2) // -1.4 → 0
        } else {
          slamArmAngle = 0
        }
      }
    }

    const upL = upperArmLRef.current
    const upR = upperArmRRef.current
    if (upL) upL.rotation.x = slamArmAngle
    if (upR) upR.rotation.x = slamArmAngle

    // Attack state machine
    if (attackPhase.current === 'idle') {
      attackTimer.current += delta
      if (attackTimer.current >= PAUSE_BETWEEN) {
        attackTimer.current = 0
        attackPhaseTimer.current = 0
        attackPhase.current = 'telegraph'
        currentAttack.current = ATTACK_ORDER[attackIndex.current % 3]
        attackIndex.current++

        if (currentAttack.current === 'stone_slam') {
          setShowHeatRing(true)
        } else if (currentAttack.current === 'stone_spikes') {
          const playerPos = usePlayerStore.getState().position
          const circles: SaltCircle[] = []
          const count = 3 + Math.floor(Math.random() * 3)
          for (let i = 0; i < count; i++) {
            circles.push({
              x: playerPos.x + (Math.random() - 0.5) * 6,
              z: playerPos.z + (Math.random() - 0.5) * 6,
            })
          }
          setSaltCircles(circles)
        } else if (currentAttack.current === 'hand_lance') {
          beamAngle.current = 0
          setShowBeam(true)
          attackPhase.current = 'attack'
          return
        }
      }
    } else if (attackPhase.current === 'telegraph') {
      attackPhaseTimer.current += delta
      if (attackPhaseTimer.current >= TELEGRAPH_DURATION) {
        attackPhaseTimer.current = 0
        attackPhase.current = 'attack'

        if (currentAttack.current === 'stone_slam') {
          setShowHeatRing(false)
          // Show blast effect
          setHeatBlast(true)
          heatBlastScale.current = 0
          const playerPos = usePlayerStore.getState().position
          if (isInRange(playerPos, bossPos, 6)) {
            usePlayerStore.getState().takeDamage(25)
            const dx = playerPos.x - bossPos.x
            const dz = playerPos.z - bossPos.z
            const len = Math.sqrt(dx * dx + dz * dz) || 1
            usePlayerStore.getState().setPosition({
              x: playerPos.x + (dx / len) * 4,
              z: playerPos.z + (dz / len) * 4,
            })
          }
          // Stay in attack phase to animate blast
        } else if (currentAttack.current === 'stone_spikes') {
          // Show impact effects at circle positions
          setSaltImpact([...saltCircles])
          saltImpactTimer.current = 0
          setSaltCircles([])
          const playerPos = usePlayerStore.getState().position
          for (const circle of saltCircles) {
            if (isInRange(playerPos, circle, 1.5)) {
              usePlayerStore.getState().takeDamage(20)
              break
            }
          }
          // Stay in attack phase to animate impact
        }
      }
    } else if (attackPhase.current === 'attack') {
      // Heat wave blast animation (expanding fire ring)
      if (currentAttack.current === 'stone_slam') {
        heatBlastScale.current += delta * 8
        if (heatBlastScale.current >= 6) {
          setHeatBlast(false)
          attackPhase.current = 'idle'
          attackTimer.current = 0
        }
      }
      // Salt rain impact animation (pillars rise then fade)
      else if (currentAttack.current === 'stone_spikes') {
        saltImpactTimer.current += delta
        if (saltImpactTimer.current >= 0.8) {
          setSaltImpact([])
          attackPhase.current = 'idle'
          attackTimer.current = 0
        }
      }
      // Deep soak active attack
      else if (currentAttack.current === 'hand_lance') {
        attackPhaseTimer.current += delta
        beamAngle.current += delta * 1.5

        if (beamRef.current) {
          beamRef.current.rotation.y = beamAngle.current
        }

        // Damage player if near beam midpoint
        const midX = bossPos.x + Math.sin(beamAngle.current) * 4
        const midZ = bossPos.z + Math.cos(beamAngle.current) * 4
        const playerPos = usePlayerStore.getState().position
        if (isInRange(playerPos, { x: midX, z: midZ }, 2)) {
          usePlayerStore.getState().setStatus('soaked')
          soakDamageTimer.current += delta
          if (soakDamageTimer.current >= 1) {
            soakDamageTimer.current = 0
            usePlayerStore.getState().takeDamage(5)
          }
        }

        if (attackPhaseTimer.current >= SOAK_DURATION) {
          setShowBeam(false)
          attackPhase.current = 'idle'
          attackTimer.current = 0
          attackPhaseTimer.current = 0
          soakDamageTimer.current = 0
        }
      }
    }
  })

  if (!boss || phase !== 'boss') return null

  return (
    <group>
      <primitive
        object={scene}
        position={[boss.position.x, 0, boss.position.z]}
        scale={fittedScale}
      />

      {/* Heat wave telegraph ring */}
      {showHeatRing && (
        <mesh position={[boss.position.x, 0.05, boss.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.5, 6.5, 48]} />
          <meshStandardMaterial color="#a16207" transparent opacity={0.6} emissive="#78350f" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Salt rain circles */}
      {saltCircles.map((c, i) => (
        <mesh key={i} position={[c.x, 0.05, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.5, 24]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.5} emissive="#ef4444" emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* Heat wave blast effect — expanding fire disc */}
      {heatBlast && boss && (
        <mesh position={[boss.position.x, 0.3, boss.position.z]}>
          <cylinderGeometry args={[1, 1, 0.5, 32]} />
          <meshStandardMaterial
            color="#92400e"
            transparent
            opacity={Math.max(0, 1 - heatBlastScale.current / 6)}
            emissive="#78350f"
            emissiveIntensity={1.5}
          />
        </mesh>
      )}
      {heatBlast && boss && (
        <mesh
          position={[boss.position.x, 0.15, boss.position.z]}
          scale={[heatBlastScale.current, 1, heatBlastScale.current]}
        >
          <cylinderGeometry args={[1, 1, 0.2, 32]} />
          <meshStandardMaterial
            color="#a16207"
            transparent
            opacity={Math.max(0, 0.7 - heatBlastScale.current / 8)}
            emissive="#a16207"
            emissiveIntensity={0.6}
          />
        </mesh>
      )}

      {/* Salt rain impact — pillars shooting up */}
      {saltImpact.map((c, i) => (
        <mesh key={`impact_${i}`} position={[c.x, saltImpactTimer.current * 3, c.z]}>
          <boxGeometry args={[0.5, 2, 0.5]} />
          <meshStandardMaterial
            color="#a8a29e"
            transparent
            opacity={Math.max(0, 1 - saltImpactTimer.current / 0.8)}
            emissive="#78716c"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Deep soak beam */}
      {showBeam && (
        <mesh ref={beamRef} position={[boss.position.x, 0.3, boss.position.z]}>
          <boxGeometry args={[0.6, 0.4, 8]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.7} emissive="#3b82f6" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

useGLTF.preload('/models/boss/boss.glb')
