import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { TIER_MODIFIERS } from '../data/waves'
import { ARENA_SIZE } from './Arena'
import { spawnDamageNumber } from './DamageNumbers'
import type { Enemy as EnemyType } from '../types'

const BURN_TICK_INTERVAL_MS = 1000
const BURN_TICK_DAMAGE = 3

const SPEED: Record<string, number> = { slow: 2, fast: 4, tanky: 1.5, boss: 1, exploder: 3.5 }
const SIZE: Record<string, number> = { slow: 0.4, fast: 0.35, tanky: 0.6, boss: 1.2, exploder: 0.3 }
const TANKY_DETECT_RANGE = 5
const TANKY_TELEGRAPH_MS = 1000
const TANKY_CHARGE_MS = 700
const TANKY_CHARGE_MULT = 6
const TANKY_COOLDOWN_MS = 3000
// Exploder telegraph: total wind-up window must match INITIAL_DETONATION_DELAY_MS
// in EnemyManager.tsx so the visual ramp ends exactly when the explosion fires.
const EXPLODER_TELEGRAPH_MS = 1800
const EXPLODER_PAUSE_MS = 800
const EXPLODER_SPRINT_MULT = 1.7
const EXPLODER_TRIGGER_RANGE = 4
// Fast: weaves left/right while chasing — sin(performance.now() / period + phase).
const FAST_WEAVE_PERIOD_MS = 223
const FAST_WEAVE_LATERAL = 1.5
const FAST_WEAVE_FORWARD_SLOWDOWN = 0.3
const ENEMY_BOUNDARY = ARENA_SIZE / 2 - 0.5
const MODEL_SCALE: Record<string, number> = { slow: 16, fast: 13, tanky: 24, boss: 10, exploder: 11 }
const BASE_COLOR: Record<string, string> = {
  slow: '#5cb85c',
  fast: '#f00f0f',
  tanky: '#6b7280',
  exploder: '#301c1c',
  boss: '#dc2626',
}
const EMISSIVE_COLOR: Record<string, string> = {
  slow: '#44ff44',
  fast: '#ffeb3b',
  tanky: '#9ca3af',
  exploder: '#120d02',
  boss: '#7f1d1d',
}
const EMISSIVE_INTENSITY: Record<string, number> = {
  slow: 0.30,
  fast: 0.65,
  tanky: 0.30,
  exploder: 0.80,
  boss: 0.30,
}

const TANKY_PLATES = [
  { x:  0.60, y: 0.70, z: -0.05, rx: 0.00, ry: 0.00, rz: 1.95, sx: 0.69, sy: 0.29, sz: 0.57, color: '#4b5563' },
  { x: -0.25, y: 0.60, z:  0.60, rx: 0.30, ry: 0.90, rz: 0.75, sx: 0.49, sy: 0.15, sz: 0.57, color: '#4f6078' },
  { x: -0.35, y: 0.80, z: -0.40, rx: 3.05, ry: 3.95, rz: 0.90, sx: 0.37, sy: 0.21, sz: 0.61, color: '#756961' },
] as const

const PLAYER_RADIUS = 0.5
const CONTACT_DAMAGE = 10
const CONTACT_COOLDOWN = 1

interface Props { enemy: EnemyType }

export default function Enemy({ enemy }: Props) {
  const { scene } = useGLTF('/models/slime/scene.glb')
  const slimeModel = useMemo(() => {
    const clone = scene.clone(true)
    const smallSlime = clone.getObjectByName('SmallSlime')
    if (smallSlime?.parent) smallSlime.parent.remove(smallSlime)
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material.clone()
        mat.map = null
        mat.emissiveMap = null
        mat.color = new THREE.Color(BASE_COLOR[enemy.type] ?? '#5cb85c')
        mat.emissive = new THREE.Color(EMISSIVE_COLOR[enemy.type] ?? '#44ff44')
        mat.emissiveIntensity = EMISSIVE_INTENSITY[enemy.type] ?? 0.3
        child.material = mat
      }
    })
    return clone
  }, [scene, enemy.type])

  const currentTier = useGameStore((s) => s.currentTier) ?? 'mild'
  const tierSpeed = TIER_MODIFIERS[currentTier].speedMultiplier

  const lastContactTime = useRef(0)
  const deathTimer = useRef(0)
  const [visualScale, setVisualScale] = useState(1)
  const burnTickRef = useRef(0)
  const stunRingRef = useRef<THREE.Group>(null)
  const facingGroupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (stunRingRef.current) {
      stunRingRef.current.rotation.y = performance.now() / 400
    }

    if (facingGroupRef.current && enemy.type === 'tanky') {
      const facingPlayer = usePlayerStore.getState().position
      facingGroupRef.current.rotation.y = Math.atan2(
        facingPlayer.x - enemy.position.x,
        facingPlayer.z - enemy.position.z,
      )
    }

    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') return

    const tickNow = performance.now()

    // Burn DOT: 3 damage per second while burning, with white flash per tick
    if (
      tickNow < enemy.burningUntil &&
      tickNow - burnTickRef.current >= BURN_TICK_INTERVAL_MS &&
      !enemy.dying &&
      !enemy.detonating
    ) {
      burnTickRef.current = tickNow
      useEnemyStore.getState().damageEnemy(enemy.id, BURN_TICK_DAMAGE)
      useEnemyStore.getState().setEnemyHitFlash(enemy.id, tickNow + 100)
      spawnDamageNumber(enemy.position.x, enemy.position.z, BURN_TICK_DAMAGE, '#fb923c')
      const updated = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
      if (updated && updated.hp <= 0) {
        if (updated.type === 'exploder') {
          useEnemyStore.getState().setEnemyDetonating(enemy.id)
          // chainDepth=1 → short delay, exploder bun in place (no sprint).
          ; (window as any).__queueDetonation?.(enemy.id, 1)
        } else {
          useEnemyStore.getState().setEnemyDying(enemy.id)
          useGameStore.getState().recordEnemyDefeated()
          if (updated.type === 'boss') {
            useEnemyStore.getState().reset()
            useGameStore.getState().triggerVictory()
          }
        }
      }
    }

    // --- Death animation ---
    if (enemy.dying) {
      deathTimer.current += delta
      if (deathTimer.current < 0.1) {
        // Swell to 1.3x over 100ms
        setVisualScale(1 + 0.3 * (deathTimer.current / 0.1))
      } else if (deathTimer.current < 0.3) {
        // Shrink to 0 over 200ms
        const shrinkProgress = (deathTimer.current - 0.1) / 0.2
        setVisualScale(1.3 * (1 - shrinkProgress))
      } else {
        // Animation done — remove enemy
        useEnemyStore.getState().removeEnemy(enemy.id)
      }
      return // skip movement while dying
    }

    const timeScale = useGameStore.getState().timeScale
    const playerPos = usePlayerStore.getState().position

    // --- Detonating (exploder only) — body visibly swells over the wind-up
    // window. First EXPLODER_PAUSE_MS the exploder freezes ("locked on"),
    // then sprints toward the player at boosted speed for the rest of the
    // window so a stationary player can't simply walk away. Chain
    // reactions also enter this branch — their CHAIN_DETONATION_DELAY_MS
    // is shorter so they fire while the visual ramp is still partway.
    if (enemy.detonating) {
      const detElapsed = performance.now() - enemy.detonationStartTime
      const progress = Math.min(1, detElapsed / EXPLODER_TELEGRAPH_MS)
      const swell = 1.0 + progress * 0.5
      const jitterAmt = 0.05 + progress * 0.15
      const flashPhase = Math.floor(performance.now() / 50) % 2
      setVisualScale(swell + (flashPhase === 0 ? -jitterAmt : jitterAmt))

      if (detElapsed < EXPLODER_PAUSE_MS) return // lock-on freeze

      const detNow = performance.now()
      const detFrozen = detNow < enemy.frozenUntil
      const detStunned = detNow < enemy.stunnedUntil
      const detSoaked = detNow < enemy.soakedUntil
      const detSlowed = detNow < enemy.slowedUntil
      const detMult = (detFrozen || detStunned) ? 0 : (detSoaked || detSlowed) ? 0.5 : 1
      const sdx = playerPos.x - enemy.position.x
      const sdz = playerPos.z - enemy.position.z
      const sdist = Math.sqrt(sdx * sdx + sdz * sdz) || 1
      const sprintSpeed = SPEED.exploder * EXPLODER_SPRINT_MULT * detMult * timeScale * tierSpeed
      useEnemyStore.getState().updateEnemyPosition(enemy.id, {
        x: enemy.position.x + (sdx / sdist) * sprintSpeed * delta,
        z: enemy.position.z + (sdz / sdist) * sprintSpeed * delta,
      })
      return
    }
    // Animate knockback with friction. Tanky shrugs it off during the
    // telegraph + charge windows — clear the impulse so the player can't
    // cancel a committed wind-up with a single spell hit.
    if (enemy.knockback) {
      if (enemy.ai.kind === 'tanky_telegraph' || enemy.ai.kind === 'tanky_charge') {
        useEnemyStore.getState().setEnemyKnockback(enemy.id, null)
      } else {
        const kb = enemy.knockback
        const friction = 0.05
        const newVx = kb.vx * Math.pow(friction, delta)
        const newVz = kb.vz * Math.pow(friction, delta)
        const nx = enemy.position.x + kb.vx * delta
        const nz = enemy.position.z + kb.vz * delta
        const cx = Math.max(-ENEMY_BOUNDARY, Math.min(ENEMY_BOUNDARY, nx))
        const cz = Math.max(-ENEMY_BOUNDARY, Math.min(ENEMY_BOUNDARY, nz))
        useEnemyStore.getState().updateEnemyPosition(enemy.id, { x: cx, z: cz })
        // Bounce off walls
        let bounceVx = newVx
        let bounceVz = newVz
        if (cx !== nx) bounceVx = -newVx * 0.6
        if (cz !== nz) bounceVz = -newVz * 0.6
        if (Math.abs(bounceVx) < 0.5 && Math.abs(bounceVz) < 0.5) {
          useEnemyStore.getState().setEnemyKnockback(enemy.id, null)
        } else {
          useEnemyStore.getState().setEnemyKnockback(enemy.id, { vx: bounceVx, vz: bounceVz })
        }
        return // skip normal movement while being knocked back
      }
    }

    const now = performance.now()
    const isFrozen = now < enemy.frozenUntil
    const isStunned = now < enemy.stunnedUntil
    const isSoaked = now < enemy.soakedUntil
    const isSlowed = now < enemy.slowedUntil
    const statusMultiplier = (isFrozen || isStunned) ? 0 : (isSoaked || isSlowed) ? 0.5 : 1
    const speed = SPEED[enemy.type] * statusMultiplier * timeScale * tierSpeed
    const dx = playerPos.x - enemy.position.x
    const dz = playerPos.z - enemy.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // AI dispatcher per ai.kind. Most enemies use 'chase'. Tanky has its own
    // idle → telegraph → charge cycle so the player has to read the wind-up
    // and dodge the committed direction.
    const ai = enemy.ai
    if (ai.kind === 'tanky_telegraph') {
      // Hold position; lock charge direction at telegraph end (commits to
      // player's position when the wind-up finishes, not where they are now).
      if (now >= ai.until && statusMultiplier > 0) {
        const tlen = dist || 1
        const chargeSpeed = SPEED.tanky * TANKY_CHARGE_MULT * tierSpeed
        useEnemyStore.getState().setEnemyAi(enemy.id, {
          kind: 'tanky_charge',
          until: now + TANKY_CHARGE_MS,
          vx: (dx / tlen) * chargeSpeed,
          vz: (dz / tlen) * chargeSpeed,
        })
      }
    } else if (ai.kind === 'tanky_charge') {
      if (now >= ai.until) {
        useEnemyStore.getState().setEnemyAi(enemy.id, {
          kind: 'tanky_idle',
          cooldownUntil: now + TANKY_COOLDOWN_MS,
        })
      } else {
        useEnemyStore.getState().updateEnemyPosition(enemy.id, {
          x: enemy.position.x + ai.vx * statusMultiplier * delta * timeScale,
          z: enemy.position.z + ai.vz * statusMultiplier * delta * timeScale,
        })
      }
    } else {
      // 'chase' or 'tanky_idle' — standard walk toward player. Fast adds a
      // lateral sine weave so a stationary AoE has to predict the swing,
      // not just sit on the enemy's current point.
      if (dist > 0.5) {
        const fx = dx / dist
        const fz = dz / dist
        let mx = fx * speed * delta
        let mz = fz * speed * delta
        if (enemy.type === 'fast') {
          const idHash = parseInt(enemy.id.split('_')[1] ?? '0', 10) * 0.7
          const wave = Math.sin(now / FAST_WEAVE_PERIOD_MS + idHash)
          // Right-perpendicular vector (90° clockwise on the xz plane).
          const px = -fz
          const pz = fx
          const forwardScale = 1 - FAST_WEAVE_FORWARD_SLOWDOWN * Math.abs(wave)
          const lateralScale = FAST_WEAVE_LATERAL * wave
          mx = (fx * forwardScale + px * lateralScale) * speed * delta
          mz = (fz * forwardScale + pz * lateralScale) * speed * delta
        }
        useEnemyStore.getState().updateEnemyPosition(enemy.id, {
          x: enemy.position.x + mx,
          z: enemy.position.z + mz,
        })
      }
      const cooldownReady = ai.kind === 'tanky_idle' && now >= (ai.cooldownUntil ?? 0)
      if (cooldownReady && dist < TANKY_DETECT_RANGE && statusMultiplier > 0) {
        useEnemyStore.getState().setEnemyAi(enemy.id, {
          kind: 'tanky_telegraph',
          until: now + TANKY_TELEGRAPH_MS,
        })
      }
    }

    // Circle collision: push enemy out of player
    const enemySize = SIZE[enemy.type]
    const combinedRadius = PLAYER_RADIUS + enemySize
    if (dist < combinedRadius && dist > 0.01) {
      const pushX = (enemy.position.x - playerPos.x) / dist
      const pushZ = (enemy.position.z - playerPos.z) / dist
      useEnemyStore.getState().updateEnemyPosition(enemy.id, {
        x: playerPos.x + pushX * combinedRadius,
        z: playerPos.z + pushZ * combinedRadius,
      })
    }

    // Circle collision: gentle push apart from other enemies
    const currentPos = useEnemyStore.getState().enemies.find(e => e.id === enemy.id)
    if (currentPos) {
      const enemies = useEnemyStore.getState().enemies
      let pushX = 0, pushZ = 0
      for (const other of enemies) {
        if (other.id === enemy.id) continue
        const odx = currentPos.position.x - other.position.x
        const odz = currentPos.position.z - other.position.z
        const oDist = Math.sqrt(odx * odx + odz * odz)
        const combinedEnemyRadius = enemySize + SIZE[other.type]
        if (oDist < combinedEnemyRadius && oDist > 0.01) {
          const force = (combinedEnemyRadius - oDist) / combinedEnemyRadius
          pushX += (odx / oDist) * force
          pushZ += (odz / oDist) * force
        }
      }
      if (pushX !== 0 || pushZ !== 0) {
        const pushSpeed = speed * 0.8
        const pushLen = Math.sqrt(pushX * pushX + pushZ * pushZ)
        useEnemyStore.getState().updateEnemyPosition(enemy.id, {
          x: currentPos.position.x + (pushX / pushLen) * pushSpeed * delta,
          z: currentPos.position.z + (pushZ / pushLen) * pushSpeed * delta,
        })
      }
    }

    // Clamp enemy inside arena walls
    const latest = useEnemyStore.getState().enemies.find(e => e.id === enemy.id)
    if (latest) {
      const cx = Math.max(-ENEMY_BOUNDARY, Math.min(ENEMY_BOUNDARY, latest.position.x))
      const cz = Math.max(-ENEMY_BOUNDARY, Math.min(ENEMY_BOUNDARY, latest.position.z))
      if (cx !== latest.position.x || cz !== latest.position.z) {
        useEnemyStore.getState().updateEnemyPosition(enemy.id, { x: cx, z: cz })
      }
    }

    const isDashing = usePlayerStore.getState().isDashing

    // Exploder: self-detonate when close to player
    if (enemy.type === 'exploder' && dist < EXPLODER_TRIGGER_RANGE && !enemy.detonating && !enemy.dying) {
      useEnemyStore.getState().setEnemyDetonating(enemy.id)
        ; (window as any).__queueDetonation?.(enemy.id)
      return
    }

    const contactDist = Math.max(1, combinedRadius + 0.1)
    if (dist < contactDist && !isDashing) {
      const now = performance.now() / 1000
      if (now - lastContactTime.current > CONTACT_COOLDOWN) {
        lastContactTime.current = now
        usePlayerStore.getState().takeDamage(CONTACT_DAMAGE)
        useGameStore.getState().triggerScreenShake(1.0, 300)
        if (usePlayerStore.getState().hp <= 0) useGameStore.getState().triggerDeath()
      }
    }
  })

  const renderNow = performance.now()
  const isFlashing = enemy.hitFlashUntil > renderNow
  const isFrozenVisual = renderNow < enemy.frozenUntil
  const isStunnedVisual = renderNow < enemy.stunnedUntil
  const isSoakedVisual = renderNow < enemy.soakedUntil && !isFrozenVisual
  const isBurningVisual = renderNow < enemy.burningUntil
  const isPoisonedVisual = renderNow < enemy.poisonedUntil && !isFrozenVisual
  const isSlowedVisual = renderNow < enemy.slowedUntil && !isFrozenVisual
  const isExploder = enemy.type === 'exploder'
  const scale = MODEL_SCALE[enemy.type] * visualScale
  const enemySize = SIZE[enemy.type]

  // Boss is visually rendered by <Boss> using a .glb model.
  // We still need this Enemy component mounted so its useFrame runs the
  // movement / AI / collision logic that drives `enemy.position` — just
  // skip drawing the slime mesh for boss type.
  if (enemy.type === 'boss') return null

  return (
    <group position={[enemy.position.x, 0, enemy.position.z]}>
      <primitive
        object={slimeModel}
        scale={[scale, scale, scale]}
      />
      {/* Tanky telegraph: pulsing red aura while winding up the charge */}
      {enemy.ai.kind === 'tanky_telegraph' && !enemy.dying && (
        <mesh position={[0, enemySize, 0]}>
          <sphereGeometry args={[enemySize * 1.7, 16, 16]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent
            opacity={0.25 + Math.sin(renderNow / 80) * 0.18}
          />
        </mesh>
      )}
      {/* Tanky stone plates — 3 baked plates around upper body */}
      {enemy.type === 'tanky' && (
        <group ref={facingGroupRef}>
          {TANKY_PLATES.map((p, i) => (
            <mesh
              key={i}
              position={[p.x, p.y, p.z]}
              rotation={[p.rx, p.ry, p.rz]}
            >
              <boxGeometry args={[p.sx, p.sy, p.sz]} />
              <meshStandardMaterial color={p.color} roughness={0.95} />
            </mesh>
          ))}
        </group>
      )}

      {/* Exploder: single pulsing red dot on top of head */}
      {enemy.type === 'exploder' && !enemy.dying && !enemy.detonating && (
        <mesh
          position={[0, enemySize * 1.7, 0]}
          scale={1 + Math.sin(renderNow / 220) * 0.25}
        >
          <sphereGeometry args={[enemySize * 0.24, 14, 14]} />
          <meshStandardMaterial
            color="#ff3b1a"
            emissive="#ff0000"
            emissiveIntensity={2.5 + Math.sin(renderNow / 220) * 1.5}
          />
        </mesh>
      )}

      {/* Exploder telegraph aura — red sphere that grows + brightens over the
          wind-up window so the threat reads from across the arena. */}
      {enemy.type === 'exploder' && enemy.detonating && !enemy.dying && (() => {
        const elapsed = renderNow - enemy.detonationStartTime
        const progress = Math.min(1, elapsed / EXPLODER_TELEGRAPH_MS)
        const auraRadius = enemySize * (1.4 + progress * 1.4)
        const auraOpacity = 0.20 + progress * 0.55
        return (
          <mesh position={[0, enemySize, 0]}>
            <sphereGeometry args={[auraRadius, 20, 20]} />
            <meshBasicMaterial
              color="#ff2200"
              transparent
              opacity={auraOpacity}
              depthWrite={false}
            />
          </mesh>
        )
      })()}
      {/* Hit flash overlay — white sphere over the enemy */}
      {isFlashing && (
        <mesh position={[0, SIZE[enemy.type], 0]}>
          <sphereGeometry args={[SIZE[enemy.type] * 1.2, 8, 8]} />
          <meshBasicMaterial color="white" transparent opacity={0.8} />
        </mesh>
      )}
      {/* Soaked: cyan watery glow + puddle ring */}
      {isSoakedVisual && !enemy.dying && (
        <>
          <mesh position={[0, enemySize, 0]}>
            <sphereGeometry args={[enemySize * 1.5, 16, 16]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.35} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[enemySize * 1.3, enemySize * 1.7, 32]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      {/* Frozen: white-blue frosty cube + crystalline wireframe edges (static) */}
      {isFrozenVisual && !enemy.dying && (
        <group position={[0, enemySize, 0]}>
          <mesh>
            <boxGeometry args={[enemySize * 2.6, enemySize * 2.6, enemySize * 2.6]} />
            <meshBasicMaterial color="#dbeafe" transparent opacity={0.45} />
          </mesh>
          <mesh>
            <boxGeometry args={[enemySize * 2.65, enemySize * 2.65, enemySize * 2.65]} />
            <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.7} />
          </mesh>
        </group>
      )}
      {/* Burning: ember sparks rising from ground + thin black smoke wisps */}
      {isBurningVisual && !enemy.dying && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const period = 1100
            const phase = ((renderNow + i * (period / 6)) % period) / period
            const angle = (i * (Math.PI * 2)) / 6 + Math.sin(renderNow / 600 + i) * 0.25
            const r = enemySize * (0.55 + Math.sin(phase * Math.PI * 2 + i) * 0.15)
            const x = Math.cos(angle) * r
            const z = Math.sin(angle) * r
            const y = phase * enemySize * 2.4
            const opacity = phase < 0.15 ? (phase / 0.15) * 0.95 : (1 - (phase - 0.15) / 0.85) * 0.95
            const color = i % 2 === 0 ? '#fbbf24' : '#f97316'
            return (
              <mesh key={`s${i}`} position={[x, y, z]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshBasicMaterial color={color} transparent opacity={opacity} />
              </mesh>
            )
          })}
          {[0, 1].map((i) => {
            const cycle = ((renderNow / 1400) + i * 0.5) % 1
            const sway = Math.sin(renderNow / 700 + i * 1.3) * 0.06
            const x = (i === 0 ? -0.08 : 0.08) + sway
            const y = enemySize * 1.7 + cycle * enemySize * 1.4
            const opacity = (1 - cycle) * 0.4
            const size = 0.06 + cycle * 0.05
            return (
              <mesh key={`m${i}`} position={[x, y, 0]}>
                <sphereGeometry args={[size, 6, 6]} />
                <meshBasicMaterial color="#1f2937" transparent opacity={opacity} />
              </mesh>
            )
          })}
        </>
      )}
      {/* Slowed: orange downward arrow above head — scales with enemy size */}
      {isSlowedVisual && !enemy.dying && (
        <group
          position={[0, enemySize * 2.5 + 0.5 + Math.sin(renderNow / 250) * 0.05, 0]}
          scale={enemySize / 0.4}
        >
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.32, 6]} />
            <meshBasicMaterial color="#ea580c" />
          </mesh>
          <mesh position={[0, -0.08, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.13, 0.22, 6]} />
            <meshBasicMaterial color="#ea580c" />
          </mesh>
        </group>
      )}
      {/* Stunned: yellow stars orbiting the head — scales with enemy size */}
      {isStunnedVisual && !enemy.dying && (
        <group
          ref={stunRingRef}
          position={[0, enemySize * 2.5 + 0.3, 0]}
          rotation={[0, renderNow / 400, 0]}
          scale={enemySize / 0.4}
        >
          {[0, 1, 2].map((i) => {
            const angle = (i * Math.PI * 2) / 3
            return (
              <mesh key={i} position={[Math.cos(angle) * 0.4, 0, Math.sin(angle) * 0.4]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color="#fbbf24" />
              </mesh>
            )
          })}
        </group>
      )}
      {/* Poisoned: green teardrops dripping from above to the ground */}
      {isPoisonedVisual && !enemy.dying && (
        <>
          {[0, 1, 2, 3].map((i) => {
            const period = 1400
            const phase = ((renderNow + i * (period / 4)) % period) / period
            const angle = (i * (Math.PI * 2)) / 4 + Math.sin(renderNow / 900 + i) * 0.2
            const r = enemySize * (0.5 + Math.sin(i * 1.7) * 0.15)
            const x = Math.cos(angle) * r
            const z = Math.sin(angle) * r
            const startY = enemySize * 2.4
            const y = startY * (1 - phase)
            const opacity =
              phase < 0.1 ? (phase / 0.1) * 0.9 : phase > 0.85 ? ((1 - phase) / 0.15) * 0.9 : 0.9
            return (
              <mesh key={`p${i}`} position={[x, y, z]} scale={[1, 1.5, 1]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshBasicMaterial color="#22c55e" transparent opacity={opacity} />
              </mesh>
            )
          })}
        </>
      )}
      {/* Exploder glow pulse */}
      {isExploder && !enemy.dying && (
        <pointLight
          position={[0, 0.5, 0]}
          color="#ef4444"
          intensity={1 + Math.sin(performance.now() / 200) * 0.5}
          distance={2}
        />
      )}
      {/* Exploder danger zone ring during detonation — opacity + ring scale
          ramp with telegraph progress so the threat builds. */}
      {isExploder && enemy.detonating && (() => {
        const elapsed = renderNow - enemy.detonationStartTime
        const progress = Math.min(1, elapsed / EXPLODER_TELEGRAPH_MS)
        const pulseFreq = 80 - progress * 40 // 80ms → 40ms
        const baseOpacity = 0.10 + progress * 0.75 // 0.10 → 0.85
        const ringScale = 1.0 + progress * 0.18 // grows ~18% as it builds
        return (
          <mesh
            position={[0, 0.03, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={ringScale}
          >
            <ringGeometry args={[2.7, 3, 48]} />
            <meshBasicMaterial
              color="#ef4444"
              transparent
              opacity={baseOpacity + Math.sin(performance.now() / pulseFreq) * 0.12}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )
      })()}
    </group>
  )
}

useGLTF.preload('/models/slime/scene.glb')
