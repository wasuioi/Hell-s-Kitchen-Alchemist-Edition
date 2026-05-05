import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { usePlayerStore } from '../stores/playerStore'
import { ARENA_SIZE } from './Arena'
import Enemy from './Enemy'
import { spawnDamageNumber } from './DamageNumbers'
import { getDistance } from '../utils/collision'
import type { EnemyType } from '../types'
import { spawnExplosion } from './ExplosionEffect'
import { PRE_BOSS_LULL_MS } from '../data/waves'

const SPAWN_INTERVAL_BASE = 3
// Per-wave enemy count — ramps up so early waves feel compact and the peak hits fast.
// Index = wave number (1-based); wave 0 unused. Wave 7 stays at 20 because the surge adds clusters on top.
const ENEMIES_PER_WAVE_CURVE = [0, 8, 11, 14, 17, 19, 20, 20]
function enemiesForWave(wave: number): number {
  return ENEMIES_PER_WAVE_CURVE[wave] ?? 20
}
const EXPLODER_RADIUS = 3
const EXPLODER_PLAYER_DAMAGE = 15
const EXPLODER_ENEMY_DAMAGE = 20
const INITIAL_DETONATION_DELAY_MS = 1800 // player-triggered wind-up — long enough to read + dodge
const CHAIN_DETONATION_DELAY_MS = 400 // chain reaction — kept tight so chains feel quick
// Pre-boss surge / lull (issue #69)
const SURGE_TRIGGER_RATIO = 0.6 // wave 7+ flips into surge once 60% of base wave is spawned
const SURGE_DURATION_MS = 20_000
const SURGE_CLUSTER_SIZE = 3
const SURGE_CLUSTER_INTERVAL = 3 // seconds between clusters
const SURGE_CLUSTER_JITTER = 1.0 // world units

function getSpawnPosition(): { x: number; z: number } {
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

// During the pre-boss surge we anchor each cluster to whichever wall edge is
// farthest from the player so the wave-of-mobs visual doesn't dump on top of them.
function getSurgeClusterCenter(playerPos: { x: number; z: number }): { x: number; z: number } {
  const half = ARENA_SIZE / 2 - 1
  const rand = (Math.random() - 0.5) * ARENA_SIZE * 0.5
  const edges: Array<{ center: { x: number; z: number }; dist: number; horizontal: boolean }> = [
    { center: { x: 0, z: -half }, dist: Math.abs(playerPos.z - -half), horizontal: true },
    { center: { x: 0, z: half }, dist: Math.abs(playerPos.z - half), horizontal: true },
    { center: { x: half, z: 0 }, dist: Math.abs(playerPos.x - half), horizontal: false },
    { center: { x: -half, z: 0 }, dist: Math.abs(playerPos.x - -half), horizontal: false },
  ]
  edges.sort((a, b) => b.dist - a.dist)
  const farthest = edges[0]
  return farthest.horizontal
    ? { x: rand, z: farthest.center.z }
    : { x: farthest.center.x, z: rand }
}

function getEnemyType(wave: number): EnemyType {
  if (wave <= 3) return 'slow'
  if (wave <= 6) {
    const roll = Math.random()
    if (roll < 0.15) return 'exploder'
    if (roll < 0.55) return 'fast'
    return 'slow'
  }
  const roll = Math.random()
  if (roll < 0.2) return 'exploder'
  if (roll < 0.35) return 'tanky'
  if (roll < 0.65) return 'fast'
  return 'slow'
}

export default function EnemyManager() {
  const spawnTimer = useRef(0)
  const spawnedCount = useRef(0)
  const waveTimer = useRef(0)
  const prevPhase = useRef<string>('menu')
  const pendingDetonations = useRef<Map<string, { time: number; chainDepth: number }>>(new Map())

  useFrame((_, delta) => {
    const { phase, currentWave, timeScale, surgeActive, surgeEndTime, lullEndTime } = useGameStore.getState()
    const nowMs = performance.now()

    // Pre-boss lull → boss transition: hold the arena empty for a beat, then spawn boss.
    if (phase === 'pre-boss-lull') {
      if (nowMs >= lullEndTime) useGameStore.getState().startBoss()
      prevPhase.current = phase
      return
    }

    // Boss spawn
    if (phase === 'boss' && prevPhase.current !== 'boss') {
      useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: -7 })
    }
    // Reset spawn state on entry to combat — guards against stale waveTimer
    // after death/victory mid-wave restarts (allDead branch only fires on clean clears).
    if (phase === 'combat' && prevPhase.current !== 'combat') {
      waveTimer.current = 0
      spawnTimer.current = 0
      spawnedCount.current = 0
      pendingDetonations.current.clear()
      // Defensive: if a previous run left surge flag on, clear it.
      if (surgeActive) useGameStore.getState().endSurge()
    }
    prevPhase.current = phase

    if (phase !== 'combat') return
    const dt = delta * timeScale
    const waveTarget = enemiesForWave(currentWave)

    // Register global detonation callback so Spell.tsx and Enemy.tsx can queue detonations.
    // Re-register every frame so HMR / remounts always point to the live pendingDetonations Map.
    ;(window as any).__queueDetonation = (enemyId: string, chainDepth = 0) => {
      const delay = chainDepth === 0 ? INITIAL_DETONATION_DELAY_MS : CHAIN_DETONATION_DELAY_MS
      pendingDetonations.current.set(enemyId, { time: performance.now() + delay, chainDepth })
    }

    // Process pending detonations
    const now = performance.now()
    for (const [enemyId, det] of pendingDetonations.current) {
      if (now >= det.time) {
        pendingDetonations.current.delete(enemyId)
        const enemy = useEnemyStore.getState().enemies.find((e) => e.id === enemyId)
        if (!enemy) continue

        // Explosion AoE damage to nearby enemies
        const enemies = useEnemyStore.getState().enemies
        for (const other of enemies) {
          if (other.id === enemyId || other.dying) continue
          const dist = getDistance(other.position, enemy.position)
          if (dist <= EXPLODER_RADIUS) {
            useEnemyStore.getState().damageEnemy(other.id, EXPLODER_ENEMY_DAMAGE)
            useEnemyStore.getState().setEnemyHitFlash(other.id, now + 100)
            spawnDamageNumber(other.position.x, other.position.z, EXPLODER_ENEMY_DAMAGE, '#f97316')

            // Chain reaction: if we killed another exploder
            const updated = useEnemyStore.getState().enemies.find((e) => e.id === other.id)
            if (updated && updated.hp <= 0 && updated.type === 'exploder' && !updated.detonating) {
              useEnemyStore.getState().setEnemyDetonating(other.id)
              pendingDetonations.current.set(other.id, { time: now + CHAIN_DETONATION_DELAY_MS, chainDepth: det.chainDepth + 1 })
            } else if (updated && updated.hp <= 0 && !updated.dying) {
              useEnemyStore.getState().setEnemyDying(updated.id)
              useGameStore.getState().recordEnemyDefeated()
            }
          }
        }

        // Damage player if in range
        const playerPos = usePlayerStore.getState().position
        const isDashing = usePlayerStore.getState().isDashing
        if (!isDashing && getDistance(playerPos, enemy.position) <= EXPLODER_RADIUS) {
          usePlayerStore.getState().takeDamage(EXPLODER_PLAYER_DAMAGE)
          if (usePlayerStore.getState().hp <= 0) useGameStore.getState().triggerDeath()
        }

        // Spawn explosion visual effect
        spawnExplosion(enemy.position.x, enemy.position.z, det.chainDepth)

        // Screen shake + start death animation for the exploder
        useGameStore.getState().triggerScreenShake(0.6, 200)
        useEnemyStore.getState().setEnemyDying(enemyId)
        useGameStore.getState().recordEnemyDefeated()
      }
    }

    waveTimer.current += dt
    spawnTimer.current += dt

    // Pre-boss surge trigger / expiry (wave 7+).
    if (
      currentWave >= 7 && !surgeActive &&
      spawnedCount.current >= Math.floor(waveTarget * SURGE_TRIGGER_RATIO)
    ) {
      useGameStore.getState().triggerSurge(SURGE_DURATION_MS)
      spawnTimer.current = 0 // reset so the first cluster waits the full interval, not the leftover scrap
    }
    if (surgeActive && nowMs >= surgeEndTime) {
      useGameStore.getState().endSurge()
    }

    if (surgeActive) {
      // Cluster spawn — bypass per-wave cap, anchor to far edge from player.
      if (spawnTimer.current >= SURGE_CLUSTER_INTERVAL) {
        spawnTimer.current = 0
        const playerPos = usePlayerStore.getState().position
        const center = getSurgeClusterCenter(playerPos)
        for (let i = 0; i < SURGE_CLUSTER_SIZE; i++) {
          const jx = (Math.random() - 0.5) * SURGE_CLUSTER_JITTER * 2
          const jz = (Math.random() - 0.5) * SURGE_CLUSTER_JITTER * 2
          useEnemyStore.getState().spawnEnemy(getEnemyType(currentWave), {
            x: center.x + jx,
            z: center.z + jz,
          })
          spawnedCount.current++
        }
      }
    } else {
      // RoR2-style director timer: spawn floor drops the longer the wave drags on.
      // waveTimer term clamped to 20s so escalation caps; floor 0.4s prevents runaway density.
      const spawnInterval = Math.max(
        0.4,
        SPAWN_INTERVAL_BASE - currentWave * 0.2 - Math.min(waveTimer.current, 20) * 0.05,
      )
      if (spawnTimer.current >= spawnInterval && spawnedCount.current < waveTarget) {
        spawnTimer.current = 0
        spawnedCount.current++
        useEnemyStore.getState().spawnEnemy(getEnemyType(currentWave), getSpawnPosition())
      }
    }

    const enemies = useEnemyStore.getState().enemies
    // Don't end the wave while the surge is still firing clusters.
    const allSpawned = !surgeActive && spawnedCount.current >= waveTarget
    const allDead = allSpawned && enemies.length === 0
    if (allDead) {
      spawnTimer.current = 0; spawnedCount.current = 0; waveTimer.current = 0
      pendingDetonations.current.clear()
      useEnemyStore.getState().reset()
      if (currentWave >= 7) useGameStore.getState().triggerPreBossLull(PRE_BOSS_LULL_MS)
      else useGameStore.getState().completeWave()
    }
  })

  const enemies = useEnemyStore((s) => s.enemies)
  return <>{enemies.map((enemy) => <Enemy key={enemy.id} enemy={enemy} />)}</>
}
