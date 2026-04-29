import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorldStore } from '../stores/worldStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { triggerOnEnemyDeath } from '../utils/perkTriggers'
import { spawnDamageNumberVfx } from '../utils/spawnVfx'
import type { CaramelPool, GamePhase } from '../types'

function CaramelPoolMesh({ pool }: { pool: CaramelPool }) {
  return (
    <group position={[pool.x, 0.02, pool.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[pool.radius, 32]} />
        <meshBasicMaterial color="#92400e" transparent opacity={0.65} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[pool.radius * 0.55, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[pool.radius * 0.82, pool.radius, 32]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

export default function CaramelPools() {
  const pools = useWorldStore((s) => s.pools)
  const prevDyingRef = useRef(new Set<string>())
  const dmgNumThrottle = useRef(new Map<string, number>())
  const prevPhaseRef = useRef<GamePhase>('menu')

  useFrame((_, delta) => {
    const phase = useGameStore.getState().phase

    // Reset pools when leaving a combat phase (wave end, death, victory)
    if (phase !== prevPhaseRef.current) {
      if (prevPhaseRef.current === 'combat' || prevPhaseRef.current === 'boss') {
        useWorldStore.getState().reset()
        prevDyingRef.current.clear()
        dmgNumThrottle.current.clear()
      }
      prevPhaseRef.current = phase
    }

    if (phase !== 'combat' && phase !== 'boss') return

    const now = performance.now() / 1000
    const nowMs = performance.now()
    const enemies = useEnemyStore.getState().enemies

    // Detect newly-dying enemies this frame and trigger caramelize drop/grow
    for (const enemy of enemies) {
      if (enemy.dying && !prevDyingRef.current.has(enemy.id)) {
        prevDyingRef.current.add(enemy.id)
        triggerOnEnemyDeath(enemy)
      }
    }
    // Prune IDs of enemies that have been fully removed
    const aliveIds = new Set(enemies.map((e) => e.id))
    for (const id of [...prevDyingRef.current]) {
      if (!aliveIds.has(id)) prevDyingRef.current.delete(id)
    }

    const { pools: currentPools, removeCaramelPool } = useWorldStore.getState()

    // Expire pools that have outlived their lifetime
    for (const pool of currentPools) {
      if (now - pool.spawnedAt >= pool.lifetimeS) {
        removeCaramelPool(pool.id)
      }
    }

    // Apply damage + slow to enemies inside pools (one hit per enemy per frame across all pools)
    const damagedThisFrame = new Set<string>()
    for (const pool of currentPools) {
      if (now - pool.spawnedAt >= pool.lifetimeS) continue
      for (const enemy of enemies) {
        if (enemy.dying || enemy.detonating) continue
        if (damagedThisFrame.has(enemy.id)) continue
        if (Math.hypot(enemy.position.x - pool.x, enemy.position.z - pool.z) > pool.radius) continue

        damagedThisFrame.add(enemy.id)

        const dmgThisTick = pool.dmgPerSecond * delta
        useEnemyStore.getState().damageEnemy(enemy.id, dmgThisTick)
        useEnemyStore.getState().setEnemyHitFlash(enemy.id, nowMs + 80)

        // Throttled damage number every 0.5s per enemy
        const lastDmgNum = dmgNumThrottle.current.get(enemy.id) ?? 0
        if (now - lastDmgNum >= 0.5) {
          dmgNumThrottle.current.set(enemy.id, now)
          spawnDamageNumberVfx(enemy.position.x, enemy.position.z, Math.round(pool.dmgPerSecond * 0.5), '#fb923c')
        }

        // Keep slow active while inside the pool (clears ~100ms after exit)
        useEnemyStore.getState().setEnemySlowed(enemy.id, nowMs + 100)

        if (pool.appliesSoaked) {
          useEnemyStore.getState().setEnemySoaked(enemy.id, nowMs + 500)
        }

        // Death check — mirror the same pattern as perkTriggers.ts
        const updated = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
        if (!updated || updated.hp > 0) continue

        if (updated.type === 'exploder') {
          useEnemyStore.getState().setEnemyDetonating(updated.id)
          window.__queueDetonation?.(updated.id)
        } else {
          useEnemyStore.getState().setEnemyDying(updated.id)
          useGameStore.getState().recordEnemyDefeated()
          if (updated.type === 'boss') {
            useEnemyStore.getState().reset()
            useWorldStore.getState().reset()
            useGameStore.getState().triggerVictory()
            return
          }
        }
      }
    }
  })

  return (
    <>
      {pools.map((pool) => <CaramelPoolMesh key={pool.id} pool={pool} />)}
    </>
  )
}
