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
  // Auto-fit: scale model to 3 units tall, then offset Y so its lowest point sits at y=0
  const { fittedScale, floorOffset } = useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const scale = size.y > 0 ? 3 / size.y : 1
    const offset = -bbox.min.y * scale
    return { fittedScale: scale, floorOffset: offset }
  }, [scene])

  const bossGroupRef = useRef<THREE.Group>(null)
  const upperArmLRef = useRef<THREE.Object3D | null>(null)
  const upperArmRRef = useRef<THREE.Object3D | null>(null)
  const forearmLRef = useRef<THREE.Object3D | null>(null)
  const forearmRRef = useRef<THREE.Object3D | null>(null)
  // Snapshot of each bone's rest-pose rotation so we can apply animation as a
  // delta. Without this, writing `rotation.x = 0` would force-zero the rig's
  // natural rest pose and the model would freeze in T-pose.
  type RestPose = { x: number; y: number; z: number }
  const restPose = useRef<{ upL?: RestPose; upR?: RestPose; fL?: RestPose; fR?: RestPose }>({})

  // GLTFLoader strips dots from bone names (`.` is a path separator in three.js
  // animation tracks), so the source `upper_arm.L` becomes `upper_armL`, etc.
  useEffect(() => {
    const upL = scene.getObjectByName('upper_armL') ?? null
    const upR = scene.getObjectByName('upper_armR') ?? null
    const fL = scene.getObjectByName('forearmL') ?? null
    const fR = scene.getObjectByName('forearmR') ?? null
    upperArmLRef.current = upL
    upperArmRRef.current = upR
    forearmLRef.current = fL
    forearmRRef.current = fR
    const snap = (b: THREE.Object3D | null): RestPose | undefined =>
      b ? { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z } : undefined
    restPose.current = { upL: snap(upL), upR: snap(upR), fL: snap(fL), fR: snap(fR) }
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

  const beamRef = useRef<THREE.Group>(null)

  const ATTACK_ORDER: AttackType[] = ['stone_slam', 'stone_spikes', 'hand_lance']
  const PAUSE_BETWEEN = 5
  const TELEGRAPH_DURATION = 2
  const SOAK_DURATION = 3

  useFrame((_, delta) => {
    if (!boss || phase !== 'boss') return

    // Rotate the whole boss body to face the player (Y-axis only)
    const playerPos = usePlayerStore.getState().position
    if (bossGroupRef.current) {
      bossGroupRef.current.rotation.y = Math.atan2(
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

    // Arm animation — both stone_slam (rotation.x) and hand_lance (rotation.z)
    // targets are computed every frame and written every frame, so transitioning
    // between attacks resets cleanly without residual rotations.
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

    let lanceExtendT = 0 // 0 = rest, 1 = fully extended outward
    if (
      currentAttack.current === 'hand_lance' &&
      attackPhase.current === 'attack'
    ) {
      // Eases in over the first 0.4s of the attack, then holds at 1 for the rest
      lanceExtendT = Math.min(attackPhaseTimer.current / 0.4, 1)
    }

    // Apply animation as deltas on top of the snapshotted rest pose so that
    // writing 0 at idle returns the bones to their natural rig pose.
    const upL = upperArmLRef.current
    const upR = upperArmRRef.current
    const fL = forearmLRef.current
    const fR = forearmRRef.current
    const rp = restPose.current
    if (upL && rp.upL) {
      upL.rotation.x = rp.upL.x + slamArmAngle
      upL.rotation.z = rp.upL.z + lanceExtendT * 1.5
    }
    if (upR && rp.upR) {
      upR.rotation.x = rp.upR.x + slamArmAngle
      upR.rotation.z = rp.upR.z + lanceExtendT * -1.5
    }
    if (fL && rp.fL) fL.rotation.x = rp.fL.x + -lanceExtendT * 0.3
    if (fR && rp.fR) fR.rotation.x = rp.fR.x + -lanceExtendT * 0.3

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

        // Damage player if near either beam midpoint
        const midRX = bossPos.x + Math.cos(beamAngle.current) * 3
        const midRZ = bossPos.z - Math.sin(beamAngle.current) * 3
        const midLX = bossPos.x - Math.cos(beamAngle.current) * 3
        const midLZ = bossPos.z + Math.sin(beamAngle.current) * 3
        const playerPos = usePlayerStore.getState().position
        const inRight = isInRange(playerPos, { x: midRX, z: midRZ }, 2)
        const inLeft = isInRange(playerPos, { x: midLX, z: midLZ }, 2)
        if (inRight || inLeft) {
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
      <group ref={bossGroupRef} position={[boss.position.x, floorOffset, boss.position.z]}>
        <primitive object={scene} scale={fittedScale} />
      </group>

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
          <meshStandardMaterial color="#fb923c" transparent opacity={0.5} emissive="#fb923c" emissiveIntensity={0.6} />
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
          <coneGeometry args={[0.4, 2.4, 6]} />
          <meshStandardMaterial
            color="#3f3f46"
            transparent
            opacity={Math.max(0, 1 - saltImpactTimer.current / 0.8)}
            emissive="#fb923c"
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}

      {/* Deep soak beam */}
      {showBeam && (
        <group ref={beamRef} position={[boss.position.x, 0.3, boss.position.z]}>
          <mesh position={[3, 0, 0]}>
            <boxGeometry args={[6, 0.4, 0.6]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.7} emissive="#3b82f6" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[-3, 0, 0]}>
            <boxGeometry args={[6, 0.4, 0.6]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.7} emissive="#3b82f6" emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}
    </group>
  )
}

useGLTF.preload('/models/boss/boss.glb')
