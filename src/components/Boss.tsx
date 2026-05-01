import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, Html } from '@react-three/drei'
import { useEnemyStore } from '../stores/enemyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { useBossDevStore } from '../stores/bossDevStore'
import { isInRange } from '../utils/collision'
import { ARENA_SIZE } from './Arena'

type AttackPhase = 'idle' | 'telegraph' | 'attack'
type AttackType = 'stone_slam' | 'stone_spikes' | 'hand_lance'

interface SaltCircle {
  x: number
  z: number
}

// Stone-slam wind-up pose — captured via the dev pose tester (2026-05-01).
// Values are rotation deltas added on top of each bone's rest pose, scaled by
// slamT (0 = rest, 1 = fully wound up). The arms lerp into this during the
// 2s telegraph, then snap back to 0 in the first 0.15s of the blast — that
// snap is the "ฟาดลงมาสุดแรง" slam.
const SLAM_WIND_UP_POSE = {
  upper_armL: { x: -0.44, y: 0.74, z: -2.61 },
  upper_armR: { x: 2.72, y: 2.61, z: -1.27 },
  forearmL: { x: 0.02, y: -0.10, z: -0.32 },
  forearmR: { x: 0.00, y: 0.00, z: 0.95 },
  spine003: { x: -0.12, y: -0.04, z: -0.06 },
} as const

// Hand-lance firing pose — also from the pose tester. Arms held forward
// with palms turned up to "hold" the rotating water lasers. Eased in over
// the first 0.4s of the attack via lanceExtendT (0 = rest, 1 = full pose).
const HAND_LANCE_POSE = {
  upper_armL: { x: -0.03, y: -0.60, z: 0.58 },
  upper_armR: { x: 0.00, y: 0.89, z: -0.45 },
  forearmL: { x: -0.09, y: -0.17, z: 0.37 },
  forearmR: { x: 0.00, y: 0.00, z: -0.40 },
  handL: { x: 1.55, y: -0.07, z: -0.08 },
  handR: { x: 2.09, y: 0.00, z: 0.00 },
} as const

// Reusable scratch vector for reading bone world positions every frame —
// declared at module scope so we don't allocate per frame.
const TMP_VEC = new THREE.Vector3()
const RESIST_AURA_DURATION = 350 // ms — must match Spell.tsx's setEnemyResistAura window
const SLAM_RADIUS = 9 // m — stone_slam blast + telegraph + damage radius
const SLAM_BLAST_INNER = SLAM_RADIUS - 1 // ring inner radius (1m thick)
// Snapshot of one material's original emissive so the resist tint can restore it
interface MatTint { mat: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number }

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

  // Dev panel: live tweaks to the floating "BOSS" label above the head.
  const labelOffsetX = useBossDevStore((s) => s.labelOffsetX)
  const labelOffsetY = useBossDevStore((s) => s.labelOffsetY)
  const labelFontSize = useBossDevStore((s) => s.labelFontSize)

  // Auto-fit: scale model to BOSS_HEIGHT units tall, then offset Y so the
  // model's lowest point sits at y=0.
  const BOSS_HEIGHT = 5
  const { fittedScale, floorOffset } = useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const scale = size.y > 0 ? BOSS_HEIGHT / size.y : 1
    const offset = -bbox.min.y * scale
    return { fittedScale: scale, floorOffset: offset }
  }, [scene])

  const bossGroupRef = useRef<THREE.Group>(null)
  const upperArmLRef = useRef<THREE.Object3D | null>(null)
  const upperArmRRef = useRef<THREE.Object3D | null>(null)
  const forearmLRef = useRef<THREE.Object3D | null>(null)
  const forearmRRef = useRef<THREE.Object3D | null>(null)
  const thighLRef = useRef<THREE.Object3D | null>(null)
  const thighRRef = useRef<THREE.Object3D | null>(null)
  const handLRef = useRef<THREE.Object3D | null>(null)
  const handRRef = useRef<THREE.Object3D | null>(null)
  const spine003Ref = useRef<THREE.Object3D | null>(null)
  // Snapshot of each bone's rest-pose rotation so we can apply animation as a
  // delta. Without this, writing `rotation.x = 0` would force-zero the rig's
  // natural rest pose and the model would freeze in T-pose.
  type RestPose = { x: number; y: number; z: number }
  const restPose = useRef<{
    upL?: RestPose; upR?: RestPose; fL?: RestPose; fR?: RestPose;
    thL?: RestPose; thR?: RestPose; hL?: RestPose; hR?: RestPose; sp003?: RestPose;
  }>({})

  // Walk-cycle state
  const walkPhase = useRef(0)
  const walkAmp = useRef(0) // eases between 0 (still) and 1 (walking)
  const lastPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 })

  // GLTFLoader strips dots from bone names (`.` is a path separator in three.js
  // animation tracks), so the source `upper_arm.L` becomes `upper_armL`, etc.
  useEffect(() => {
    const upL = scene.getObjectByName('upper_armL') ?? null
    const upR = scene.getObjectByName('upper_armR') ?? null
    const fL = scene.getObjectByName('forearmL') ?? null
    const fR = scene.getObjectByName('forearmR') ?? null
    const thL = scene.getObjectByName('thighL') ?? null
    const thR = scene.getObjectByName('thighR') ?? null
    const hL = scene.getObjectByName('handL') ?? null
    const hR = scene.getObjectByName('handR') ?? null
    const sp003 = scene.getObjectByName('spine003') ?? null
    upperArmLRef.current = upL
    upperArmRRef.current = upR
    forearmLRef.current = fL
    forearmRRef.current = fR
    thighLRef.current = thL
    thighRRef.current = thR
    handLRef.current = hL
    handRRef.current = hR
    spine003Ref.current = sp003
    const snap = (b: THREE.Object3D | null): RestPose | undefined =>
      b ? { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z } : undefined
    restPose.current = {
      upL: snap(upL), upR: snap(upR), fL: snap(fL), fR: snap(fR),
      thL: snap(thL), thR: snap(thR), hL: snap(hL), hR: snap(hR), sp003: snap(sp003),
    }
    // Snapshot every MeshStandardMaterial in the model so the resist-aura
    // useFrame can flash a gray emissive coating across the body and then
    // restore the originals.
    const tints: MatTint[] = []
    scene.traverse((obj) => {
      const o = obj as THREE.Mesh
      if (!o.isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial) {
          tints.push({ mat: m, emissive: m.emissive.clone(), intensity: m.emissiveIntensity })
        }
      }
    })
    tintMatsRef.current = tints
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
  // Glowing water "muzzles" attached to each hand bone during hand_lance.
  const handLMuzzleRef = useRef<THREE.Mesh>(null)
  const handRMuzzleRef = useRef<THREE.Mesh>(null)
  // Cached MeshStandardMaterial snapshots used to flash a gray "armor coating"
  // tint across the entire boss body when knockback is resisted.
  const tintMatsRef = useRef<MatTint[]>([])

  const ATTACK_ORDER: AttackType[] = ['stone_slam', 'stone_spikes', 'hand_lance']
  const PAUSE_BETWEEN = 5
  const TELEGRAPH_DURATION = 2
  const SOAK_DURATION = 3

  useFrame((_, delta) => {
    if (!boss || phase !== 'boss') return

    // Body Y-rotation: normally face the player, but during hand_lance attack
    // the body spins together with the beams so the arms stay aligned with
    // the lasers ("ขยับ spin_y ตามน้ำที่ยิง").
    const playerPos = usePlayerStore.getState().position
    const isLanceAttack = currentAttack.current === 'hand_lance' && attackPhase.current === 'attack'
    if (bossGroupRef.current) {
      bossGroupRef.current.rotation.y = isLanceAttack
        ? beamAngle.current
        : Math.atan2(
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

    // Slam wind-up — multi-bone pose lerp. slamT goes 0→1 over the 2s
    // telegraph (arms gradually wind up to SLAM_WIND_UP_POSE), then snaps
    // back 1→0 in the first 0.15s of the blast (the actual slam-down hit).
    let slamT = 0
    if (currentAttack.current === 'stone_slam') {
      if (attackPhase.current === 'telegraph') {
        slamT = Math.min(attackPhaseTimer.current / TELEGRAPH_DURATION, 1)
      } else if (attackPhase.current === 'attack') {
        const blastT = heatBlastScale.current / SLAM_RADIUS
        slamT = blastT < 0.2 ? 1 - blastT / 0.2 : 0
      }
    }

    // Lance arm extension — eases in over the first 0.4s of the attack
    let lanceExtendT = 0
    if (
      currentAttack.current === 'hand_lance' &&
      attackPhase.current === 'attack'
    ) {
      lanceExtendT = Math.min(attackPhaseTimer.current / 0.4, 1)
    }

    // Walk cycle — swing thighs in opposite phase when boss is moving.
    // Detect movement by comparing this frame's position to the previous
    // frame's snapshot. Amplitude eases in/out so starts and stops are smooth.
    const dx = boss.position.x - lastPosRef.current.x
    const dz = boss.position.z - lastPosRef.current.z
    const isMoving = Math.hypot(dx, dz) > 0.001
    lastPosRef.current = { x: boss.position.x, z: boss.position.z }
    if (isMoving) walkPhase.current += delta * 4
    const targetAmp = isMoving ? 1 : 0
    walkAmp.current += (targetAmp - walkAmp.current) * Math.min(delta * 8, 1)
    const walkSwing = walkAmp.current * Math.sin(walkPhase.current) * 0.5

    // Apply animation as deltas on top of the snapshotted rest pose so that
    // writing 0 at idle returns the bones to their natural rig pose.
    // Stone_slam and hand_lance can never be active simultaneously, so we
    // simply sum their contributions per axis — the inactive one is 0.
    const upL = upperArmLRef.current
    const upR = upperArmRRef.current
    const fL = forearmLRef.current
    const fR = forearmRRef.current
    const thL = thighLRef.current
    const thR = thighRRef.current
    const rp = restPose.current
    const slam = SLAM_WIND_UP_POSE
    const lance = HAND_LANCE_POSE
    if (upL && rp.upL) {
      upL.rotation.x = rp.upL.x + slamT * slam.upper_armL.x + lanceExtendT * lance.upper_armL.x
      upL.rotation.y = rp.upL.y + slamT * slam.upper_armL.y + lanceExtendT * lance.upper_armL.y
      upL.rotation.z = rp.upL.z + slamT * slam.upper_armL.z + lanceExtendT * lance.upper_armL.z
    }
    if (upR && rp.upR) {
      upR.rotation.x = rp.upR.x + slamT * slam.upper_armR.x + lanceExtendT * lance.upper_armR.x
      upR.rotation.y = rp.upR.y + slamT * slam.upper_armR.y + lanceExtendT * lance.upper_armR.y
      upR.rotation.z = rp.upR.z + slamT * slam.upper_armR.z + lanceExtendT * lance.upper_armR.z
    }
    if (fL && rp.fL) {
      fL.rotation.x = rp.fL.x + slamT * slam.forearmL.x + lanceExtendT * lance.forearmL.x
      fL.rotation.y = rp.fL.y + slamT * slam.forearmL.y + lanceExtendT * lance.forearmL.y
      fL.rotation.z = rp.fL.z + slamT * slam.forearmL.z + lanceExtendT * lance.forearmL.z
    }
    if (fR && rp.fR) {
      fR.rotation.x = rp.fR.x + slamT * slam.forearmR.x + lanceExtendT * lance.forearmR.x
      fR.rotation.y = rp.fR.y + slamT * slam.forearmR.y + lanceExtendT * lance.forearmR.y
      fR.rotation.z = rp.fR.z + slamT * slam.forearmR.z + lanceExtendT * lance.forearmR.z
    }
    if (thL && rp.thL) thL.rotation.x = rp.thL.x + walkSwing
    if (thR && rp.thR) thR.rotation.x = rp.thR.x - walkSwing
    // spine003 — slight torso bend during slam wind-up
    const sp003 = spine003Ref.current
    if (sp003 && rp.sp003) {
      sp003.rotation.x = rp.sp003.x + slamT * slam.spine003.x
      sp003.rotation.y = rp.sp003.y + slamT * slam.spine003.y
      sp003.rotation.z = rp.sp003.z + slamT * slam.spine003.z
    }
    // Hands — only hand_lance writes to them, palms turn up to "hold" beams
    const hL = handLRef.current
    const hR = handRRef.current
    if (hL && rp.hL) {
      hL.rotation.x = rp.hL.x + lanceExtendT * lance.handL.x
      hL.rotation.y = rp.hL.y + lanceExtendT * lance.handL.y
      hL.rotation.z = rp.hL.z + lanceExtendT * lance.handL.z
    }
    if (hR && rp.hR) {
      hR.rotation.x = rp.hR.x + lanceExtendT * lance.handR.x
      hR.rotation.y = rp.hR.y + lanceExtendT * lance.handR.y
      hR.rotation.z = rp.hR.z + lanceExtendT * lance.handR.z
    }

    // Hand muzzle "water" glows — track each hand bone's world position so
    // the beams visually emit from the boss's palms during hand_lance.
    if (hL && handLMuzzleRef.current) {
      hL.getWorldPosition(TMP_VEC)
      handLMuzzleRef.current.position.copy(TMP_VEC)
    }
    if (hR && handRMuzzleRef.current) {
      hR.getWorldPosition(TMP_VEC)
      handRMuzzleRef.current.position.copy(TMP_VEC)
    }

    // Resist coating — flash a gray emissive tint across every body material
    // when the boss shrugs off a knockback. Fades 0.7 → 0 over the aura
    // window, then restores the cached emissive colour/intensity.
    const resistRemaining = boss.resistAuraUntil - performance.now()
    const resistT = resistRemaining > 0 ? resistRemaining / RESIST_AURA_DURATION : 0
    for (const t of tintMatsRef.current) {
      if (resistT > 0) {
        // Mix gray over the original emissive proportional to resistT
        t.mat.emissive.setRGB(0.55 * resistT, 0.55 * resistT, 0.55 * resistT)
        t.mat.emissiveIntensity = t.intensity + resistT * 1.5
      } else {
        t.mat.emissive.copy(t.emissive)
        t.mat.emissiveIntensity = t.intensity
      }
    }

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
          // Seed beamAngle to the current player-facing angle so the body
          // rotation (which is now driven by beamAngle during the attack)
          // doesn't snap on the first frame.
          const pp = usePlayerStore.getState().position
          beamAngle.current = Math.atan2(
            pp.x - boss.position.x,
            pp.z - boss.position.z,
          )
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
          if (isInRange(playerPos, bossPos, SLAM_RADIUS)) {
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
        heatBlastScale.current += delta * 12
        if (heatBlastScale.current >= SLAM_RADIUS) {
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
          <ringGeometry args={[SLAM_BLAST_INNER, SLAM_RADIUS, 64]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.7} emissive="#dc2626" emissiveIntensity={0.8} />
        </mesh>
      )}

      {/* Salt rain circles */}
      {saltCircles.map((c, i) => (
        <mesh key={i} position={[c.x, 0.05, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.5, 24]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.6} emissive="#dc2626" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* Heat wave blast effect — expanding fire disc */}
      {heatBlast && boss && (
        <mesh position={[boss.position.x, 0.3, boss.position.z]}>
          <cylinderGeometry args={[1, 1, 0.5, 32]} />
          <meshStandardMaterial
            color="#92400e"
            transparent
            opacity={Math.max(0, 1 - heatBlastScale.current / SLAM_RADIUS)}
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
            opacity={Math.max(0, 0.7 - heatBlastScale.current / (SLAM_RADIUS * 1.3))}
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

      {/* Hand-muzzle water glows — bright blue spheres tracked to each hand
          bone's world position via useFrame, only visible while the lance
          beams are active. */}
      {showBeam && (
        <>
          <mesh ref={handLMuzzleRef}>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial color="#60a5fa" transparent opacity={0.85} emissive="#3b82f6" emissiveIntensity={3} />
          </mesh>
          <mesh ref={handRMuzzleRef}>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial color="#60a5fa" transparent opacity={0.85} emissive="#3b82f6" emissiveIntensity={3} />
          </mesh>
        </>
      )}

      {/* "BOSS" floating label — position + font size driven by BossDevPanel. */}
      <Html
        position={[
          boss.position.x + labelOffsetX,
          floorOffset + BOSS_HEIGHT - 0.2 + labelOffsetY,
          boss.position.z,
        ]}
        center
        distanceFactor={6}
        zIndexRange={[100, 0]}
      >
        <div
          style={{
            color: '#fee2e2',
            background: 'rgba(127, 29, 29, 0.85)',
            border: '3px solid #ef4444',
            borderRadius: '6px',
            padding: '4px 18px',
            fontSize: `${labelFontSize}px`,
            fontWeight: 'bold',
            letterSpacing: '4px',
            fontFamily: 'inherit',
            textShadow: '0 0 8px #dc2626',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          BOSS
        </div>
      </Html>
    </group>
  )
}

useGLTF.preload('/models/boss/boss.glb')
