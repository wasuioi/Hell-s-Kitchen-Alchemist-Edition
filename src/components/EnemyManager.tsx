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

const SPAWN_INTERVAL_BASE = 3
const ENEMIES_PER_WAVE = 20
const EXPLODER_RADIUS = 3
const EXPLODER_PLAYER_DAMAGE = 15
const EXPLODER_ENEMY_DAMAGE = 20
const DETONATION_DELAY = 400 // ms

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
  if (roll < 0.45) return 'tanky'
  if (roll < 0.75) return 'fast'
  return 'slow'
}

export default function EnemyManager() {
  const spawnTimer = useRef(0)
  const spawnedCount = useRef(0)
  const waveTimer = useRef(0)
  const prevPhase = useRef<string>('menu')
  const pendingDetonations = useRef<Map<string, number>>(new Map())

  useFrame((_, delta) => {
    const { phase, currentWave, timeScale } = useGameStore.getState()

    // Boss spawn
    if (phase === 'boss' && prevPhase.current !== 'boss') {
      useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: -7 })
    }
    prevPhase.current = phase

    if (phase !== 'combat') return
    const dt = delta * timeScale

    // Register global detonation callback so Spell.tsx can queue detonations
    if (!(window as any).__queueDetonation) {
      ;(window as any).__queueDetonation = (enemyId: string) => {
        pendingDetonations.current.set(enemyId, performance.now() + DETONATION_DELAY)
      }
    }

    // Process pending detonations
    const now = performance.now()
    for (const [enemyId, detonateAt] of pendingDetonations.current) {
      if (now >= detonateAt) {
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
              pendingDetonations.current.set(other.id, now + DETONATION_DELAY)
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

        // Screen shake + start death animation for the exploder
        useGameStore.getState().triggerScreenShake(0.6, 200)
        useEnemyStore.getState().setEnemyDying(enemyId)
        useGameStore.getState().recordEnemyDefeated()
      }
    }

    waveTimer.current += dt
    spawnTimer.current += dt
    const spawnInterval = Math.max(1, SPAWN_INTERVAL_BASE - currentWave * 0.2)
    if (spawnTimer.current >= spawnInterval && spawnedCount.current < ENEMIES_PER_WAVE) {
      spawnTimer.current = 0
      spawnedCount.current++
      useEnemyStore.getState().spawnEnemy(getEnemyType(currentWave), getSpawnPosition())
    }
    const enemies = useEnemyStore.getState().enemies
    const allSpawned = spawnedCount.current >= ENEMIES_PER_WAVE
    const allDead = allSpawned && enemies.length === 0
    if (allDead) {
      spawnTimer.current = 0; spawnedCount.current = 0; waveTimer.current = 0
      pendingDetonations.current.clear()
      useEnemyStore.getState().reset()
      if (currentWave >= 7) useGameStore.getState().startBoss()
      else useGameStore.getState().completeWave()
    }
  })

  const enemies = useEnemyStore((s) => s.enemies)
  return <>{enemies.map((enemy) => <Enemy key={enemy.id} enemy={enemy} />)}</>
}
