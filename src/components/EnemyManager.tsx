import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { ARENA_SIZE } from './Arena'
import Enemy from './Enemy'
import type { EnemyType } from '../types'

const SPAWN_INTERVAL_BASE = 3
const ENEMIES_PER_WAVE = 20

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
  if (wave <= 6) return Math.random() < 0.6 ? 'fast' : 'slow'
  const roll = Math.random()
  if (roll < 0.3) return 'tanky'
  if (roll < 0.7) return 'fast'
  return 'slow'
}

export default function EnemyManager() {
  const spawnTimer = useRef(0)
  const spawnedCount = useRef(0)
  const waveTimer = useRef(0)
  const prevPhase = useRef<string>('menu')

  useFrame((_, delta) => {
    const { phase, currentWave, timeScale } = useGameStore.getState()

    // Boss spawn
    if (phase === 'boss' && prevPhase.current !== 'boss') {
      useEnemyStore.getState().spawnEnemy('boss', { x: 0, z: -7 })
    }
    prevPhase.current = phase

    if (phase !== 'combat') return
    const dt = delta * timeScale
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
    const timeUp = waveTimer.current >= 60
    if (allDead || timeUp) {
      spawnTimer.current = 0; spawnedCount.current = 0; waveTimer.current = 0
      useEnemyStore.getState().reset()
      if (currentWave >= 7) useGameStore.getState().startBoss()
      else useGameStore.getState().completeWave()
    }
  })

  const enemies = useEnemyStore((s) => s.enemies)
  return <>{enemies.map((enemy) => <Enemy key={enemy.id} enemy={enemy} />)}</>
}
