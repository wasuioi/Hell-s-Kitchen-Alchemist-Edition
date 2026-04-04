import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpellEffect, SpellType } from '../types'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { getDistance } from '../utils/collision'
import { SPELL_CONFIG } from '../data/recipes'

const SPELL_COLOR: Record<SpellType, string> = {
  INFERNO: '#ef4444',
  TIDAL_WAVE: '#3b82f6',
  FORTRESS: '#9ca3af',
  STEAM: '#a855f7',
  METEOR: '#f97316',
  MUD: '#b48c50',
}

interface SpellVisualProps {
  spell: SpellEffect
  onExpired: (id: string) => void
}

function SpellVisual({ spell, onExpired }: SpellVisualProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const elapsed = useRef(0)
  const damaged = useRef<Set<string>>(new Set())

  useFrame((_, delta) => {
    elapsed.current += delta
    const progress = Math.min(elapsed.current / spell.duration, 1)

    if (meshRef.current) {
      const scale = spell.type === 'METEOR'
        ? 1 + (1 - progress) * 0.5  // shrink slightly on impact
        : spell.type === 'FORTRESS'
          ? Math.min(1, progress * 8)  // Fortress pops up fast
          : progress                    // AOE expands outward

      meshRef.current.scale.set(scale, 1, scale)

      if (spell.type === 'METEOR') {
        // Drop from y=10 to y=0
        const y = Math.max(0, 10 * (1 - progress * 3))
        meshRef.current.position.y = y + 0.5
      }

      // Fade opacity (skip for Fortress — it's a group, not a mesh)
      if (spell.type !== 'FORTRESS') {
        const material = meshRef.current.material as THREE.MeshStandardMaterial
        if (material) material.opacity = Math.max(0, 1 - progress)
      }
    }

    // Damage enemies in range
    const enemies = useEnemyStore.getState().enemies
    const activePerks = useDeckStore.getState().activePerks
    const deepFreezeStacks = activePerks.find((p) => p.id === 'deep_freeze')?.stackCount || 0
    const heavySaltStacks = activePerks.find((p) => p.id === 'heavy_salt')?.stackCount || 0
    const BOTTLE_SPELLS: SpellType[] = ['TIDAL_WAVE', 'MUD']
    const SALT_SPELLS: SpellType[] = ['FORTRESS', 'METEOR']

    // Fortress: push enemies inside the dome to its edge
    if (spell.type === 'FORTRESS') {
      for (const enemy of enemies) {
        const dist = getDistance(enemy.position, spell.position)
        if (dist < spell.radius && dist > 0.1) {
          const dx = enemy.position.x - spell.position.x
          const dz = enemy.position.z - spell.position.z
          const len = Math.sqrt(dx * dx + dz * dz) || 1
          // Place enemy just outside the dome edge
          const edgeDist = spell.radius + 0.5
          useEnemyStore.getState().updateEnemyPosition(enemy.id, {
            x: spell.position.x + (dx / len) * edgeDist,
            z: spell.position.z + (dz / len) * edgeDist,
          })
        }
      }
    }

    for (const enemy of enemies) {
      if (damaged.current.has(enemy.id)) continue
      const dist = getDistance(enemy.position, spell.position)
      const currentRadius = spell.type === 'METEOR' ? spell.radius : spell.radius * progress
      if (dist <= currentRadius) {
        damaged.current.add(enemy.id)
        if (spell.type === 'FORTRESS') continue // Fortress doesn't deal damage, just pushes
        useEnemyStore.getState().damageEnemy(enemy.id, spell.damage)

        // Apply status effects
        const config = SPELL_CONFIG[spell.type]
        if (config.slow > 0) {
          useEnemyStore.getState().setEnemyStatus(enemy.id, 'soaked')
        }

        // Deep Freeze perk: BOTTLE-based spells stun enemies
        if (BOTTLE_SPELLS.includes(spell.type) && deepFreezeStacks > 0) {
          useEnemyStore.getState().setEnemyStatus(enemy.id, 'stunned')
          setTimeout(() => {
            useEnemyStore.getState().setEnemyStatus(enemy.id, 'normal')
          }, 2000 * deepFreezeStacks)
        }

        // Heavy Salt perk: SALT-based spells push enemies away
        if (SALT_SPELLS.includes(spell.type) && heavySaltStacks > 0) {
          const dx = enemy.position.x - spell.position.x
          const dz = enemy.position.z - spell.position.z
          const len = Math.sqrt(dx * dx + dz * dz) || 1
          const pushDist = 3 * heavySaltStacks
          useEnemyStore.getState().updateEnemyPosition(enemy.id, {
            x: enemy.position.x + (dx / len) * pushDist,
            z: enemy.position.z + (dz / len) * pushDist,
          })
        }

        if (spell.type === 'TIDAL_WAVE' && config.knockback > 0) {
          // Knockback: push enemy away from spell center
          const dx = enemy.position.x - spell.position.x
          const dz = enemy.position.z - spell.position.z
          const len = Math.sqrt(dx * dx + dz * dz) || 1
          const newPos = {
            x: enemy.position.x + (dx / len) * config.knockback,
            z: enemy.position.z + (dz / len) * config.knockback,
          }
          useEnemyStore.getState().updateEnemyPosition(enemy.id, newPos)
        }
      }
    }

    // Remove dead enemies and record kills
    const afterDamage = useEnemyStore.getState().enemies
    const dead = enemies.filter((e) => {
      const updated = afterDamage.find((ae) => ae.id === e.id)
      return updated && updated.hp <= 0
    })
    for (const deadEnemy of dead) {
      const wasBoss = deadEnemy.type === 'boss'
      useEnemyStore.getState().removeEnemy(deadEnemy.id)
      useGameStore.getState().recordEnemyDefeated()
      if (wasBoss) {
        useEnemyStore.getState().reset()
        useGameStore.getState().triggerVictory()
        return
      }
    }

    if (elapsed.current >= spell.duration) {
      onExpired(spell.id)
    }
  })

  const color = SPELL_COLOR[spell.type]
  const isMeteor = spell.type === 'METEOR'

  if (isMeteor) {
    return (
      <mesh
        ref={meshRef}
        position={[spell.position.x, 10.5, spell.position.z]}
      >
        <sphereGeometry args={[spell.radius, 16, 16]} />
        <meshStandardMaterial color={color} transparent opacity={0.85} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    )
  }

  if (spell.type === 'FORTRESS') {
    return (
      <group ref={meshRef as any} position={[spell.position.x, 0, spell.position.z]} scale={[0, 1, 0]}>
        {/* Glass dome */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[spell.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#a8d8ea"
            transparent
            opacity={0.25}
            emissive="#a8d8ea"
            emissiveIntensity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Dome edge ring on ground */}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[spell.radius - 0.15, spell.radius, 48]} />
          <meshStandardMaterial color="#a8d8ea" transparent opacity={0.5} emissive="#a8d8ea" emissiveIntensity={0.5} />
        </mesh>
      </group>
    )
  }

  return (
    <mesh
      ref={meshRef}
      position={[spell.position.x, 0.2, spell.position.z]}
      scale={[0, 1, 0]}
    >
      <cylinderGeometry args={[spell.radius, spell.radius, 0.3, 32]} />
      <meshStandardMaterial color={color} transparent opacity={0.7} emissive={color} emissiveIntensity={0.3} />
    </mesh>
  )
}

export default function SpellManager() {
  const [spells, setSpells] = useState<SpellEffect[]>([])

  useEffect(() => {
    ; (window as any).__castSpell = (spell: SpellEffect) => {
      setSpells((prev) => [...prev, spell])
    }
    return () => { delete (window as any).__castSpell }
  }, [])

  function handleExpired(id: string) {
    setSpells((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <>
      {spells.map((spell) => (
        <SpellVisual key={spell.id} spell={spell} onExpired={handleExpired} />
      ))}
    </>
  )
}
