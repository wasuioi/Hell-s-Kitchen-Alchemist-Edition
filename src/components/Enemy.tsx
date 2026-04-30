import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { ARENA_SIZE } from './Arena'
import { spawnDamageNumber } from './DamageNumbers'
import { triggerOnKnockbackCollision } from '../utils/perkTriggers'
import type { Enemy as EnemyType } from '../types'

const BURN_TICK_INTERVAL_MS = 1000
const BURN_TICK_DAMAGE = 3

const SPEED: Record<string, number> = { slow: 2, fast: 4, tanky: 1.5, boss: 1, exploder: 3.5 }
const SIZE: Record<string, number> = { slow: 0.4, fast: 0.35, tanky: 0.6, boss: 1.2, exploder: 0.3 }
const ENEMY_BOUNDARY = ARENA_SIZE / 2 - 0.5
const MODEL_SCALE: Record<string, number> = { slow: 16, fast: 13, tanky: 24, boss: 10, exploder: 11 }
const PLAYER_RADIUS = 0.5
const CONTACT_DAMAGE = 10
const CONTACT_COOLDOWN = 1

interface Props { enemy: EnemyType }

export default function Enemy({ enemy }: Props) {
  const { scene } = useGLTF('/models/slime/scene.gltf')
  const slimeModel = useMemo(() => {
    const clone = scene.clone(true)
    const smallSlime = clone.getObjectByName('SmallSlime')
    if (smallSlime?.parent) smallSlime.parent.remove(smallSlime)
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material.clone()
        mat.emissiveMap = null
        mat.emissive = new THREE.Color(0x44ff44)
        mat.emissiveIntensity = 0.3
        child.material = mat
      }
    })
    return clone
  }, [scene])

  const lastContactTime = useRef(0)
  const deathTimer = useRef(0)
  const [visualScale, setVisualScale] = useState(1)
  const burnTickRef = useRef(0)
  const stunRingRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (stunRingRef.current) {
      stunRingRef.current.rotation.y = performance.now() / 400
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
          ; (window as any).__queueDetonation?.(enemy.id)
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

    // --- Detonating (exploder only) — skip movement ---
    if (enemy.detonating) {
      // Rapid flash: toggle scale between 1.0 and 1.2 every 50ms
      const flashPhase = Math.floor(performance.now() / 50) % 2
      setVisualScale(flashPhase === 0 ? 1.0 : 1.2)
      return
    }

    const timeScale = useGameStore.getState().timeScale
    const playerPos = usePlayerStore.getState().position
    // Animate knockback with friction
    if (enemy.knockback) {
      const kb = enemy.knockback
      const friction = 0.05
      const newVx = kb.vx * Math.pow(friction, delta)
      const newVz = kb.vz * Math.pow(friction, delta)
      const nx = enemy.position.x + kb.vx * delta
      const nz = enemy.position.z + kb.vz * delta
      const cx = Math.max(-ENEMY_BOUNDARY, Math.min(ENEMY_BOUNDARY, nx))
      const cz = Math.max(-ENEMY_BOUNDARY, Math.min(ENEMY_BOUNDARY, nz))
      useEnemyStore.getState().updateEnemyPosition(enemy.id, { x: cx, z: cz })
      triggerOnKnockbackCollision(enemy, { x: cx, z: cz })
      // Bounce off walls
      let bounceVx = newVx
      let bounceVz = newVz
      if (cx !== nx) bounceVx = -newVx * 0.6
      if (cz !== nz) bounceVz = -newVz * 0.6
      if (Math.abs(bounceVx) < 0.5 && Math.abs(bounceVz) < 0.5) {
        useEnemyStore.getState().setEnemyKnockback(enemy.id, null)
      } else {
        useEnemyStore.getState().setEnemyKnockback(enemy.id, { vx: bounceVx, vz: bounceVz, alreadyStruck: kb.alreadyStruck, chained: kb.chained })
      }
      return // skip normal movement while being knocked back
    }

    const now = performance.now()
    const isFrozen = now < enemy.frozenUntil
    const isStunned = now < enemy.stunnedUntil
    const isSoaked = now < enemy.soakedUntil
    const isSlowed = now < enemy.slowedUntil
    const statusMultiplier = (isFrozen || isStunned) ? 0 : (isSoaked || isSlowed) ? 0.5 : 1
    const speed = SPEED[enemy.type] * statusMultiplier * timeScale
    const dx = playerPos.x - enemy.position.x
    const dz = playerPos.z - enemy.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > 0.5) {
      useEnemyStore.getState().updateEnemyPosition(enemy.id, {
        x: enemy.position.x + (dx / dist) * speed * delta,
        z: enemy.position.z + (dz / dist) * speed * delta,
      })
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
    if (enemy.type === 'exploder' && dist < 2.5 && !enemy.detonating && !enemy.dying) {
      useEnemyStore.getState().setEnemyDetonating(enemy.id)
        ; (window as any).__queueDetonation?.(enemy.id)
      return
    }

    if (dist < 1 && !isDashing) {
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

  return (
    <group position={[enemy.position.x, 0, enemy.position.z]}>
      <primitive
        object={slimeModel}
        scale={[scale, scale, scale]}
      />
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
      {/* Exploder danger zone ring during detonation */}
      {isExploder && enemy.detonating && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.7, 3, 48]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent
            opacity={0.3 + Math.sin(performance.now() / 80) * 0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}

useGLTF.preload('/models/slime/scene.gltf')
