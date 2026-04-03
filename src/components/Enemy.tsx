import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import type { Enemy as EnemyType } from '../types'

const SPEED: Record<string, number> = { slow: 2, fast: 4, tanky: 1.5, boss: 1 }
const SIZE: Record<string, number> = { slow: 0.4, fast: 0.35, tanky: 0.6, boss: 1.2 }
const COLOR: Record<string, string> = { slow: '#ef4444', fast: '#f97316', tanky: '#7c3aed', boss: '#dc2626' }
const CONTACT_DAMAGE = 10
const CONTACT_COOLDOWN = 1

interface Props { enemy: EnemyType }

export default function Enemy({ enemy }: Props) {
  const lastContactTime = useRef(0)
  useFrame((_, delta) => {
    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') return
    const timeScale = useGameStore.getState().timeScale
    const playerPos = usePlayerStore.getState().position
    const speed = SPEED[enemy.type] * (enemy.status === 'soaked' ? 0.5 : 1) * timeScale
    const dx = playerPos.x - enemy.position.x
    const dz = playerPos.z - enemy.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > 0.5) {
      useEnemyStore.getState().updateEnemyPosition(enemy.id, {
        x: enemy.position.x + (dx / dist) * speed * delta,
        z: enemy.position.z + (dz / dist) * speed * delta,
      })
    }
    if (dist < 1) {
      const now = performance.now() / 1000
      if (now - lastContactTime.current > CONTACT_COOLDOWN) {
        lastContactTime.current = now
        usePlayerStore.getState().takeDamage(CONTACT_DAMAGE)
        if (usePlayerStore.getState().hp <= 0) useGameStore.getState().triggerDeath()
      }
    }
  })
  const size = SIZE[enemy.type]
  return (
    <mesh position={[enemy.position.x, size, enemy.position.z]} castShadow>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={COLOR[enemy.type]} />
    </mesh>
  )
}
