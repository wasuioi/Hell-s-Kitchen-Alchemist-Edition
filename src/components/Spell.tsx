import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpellEffect, SpellType } from '../types'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { getDistance } from '../utils/collision'
import { SPELL_CONFIG } from '../data/recipes'
import { PARTICLE_CONFIG } from '../data/particleConfig'
import ParticleSystem from './ParticleSystem'
import { spawnDamageNumber } from './DamageNumbers'
import { spawnGroundCrack } from './GroundCracks'

declare global {
  interface Window {
    __queueDetonation?: (enemyId: string) => void
  }
}

const SOAK_DURATION_MS = 5000
const BURN_DURATION_MS = 3000
const SLOW_DURATION_MS = 4000

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
    const extraSpicyStacks = activePerks.find((p) => p.id === 'extra_spicy')?.stackCount || 0
    const BOTTLE_SPELLS: SpellType[] = ['TIDAL_WAVE', 'MUD']
    const BURN_SPELLS: SpellType[] = ['INFERNO', 'METEOR']

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

        const now = performance.now()
        const isInferno = spell.type === 'INFERNO'
        const wasSoaked = now < enemy.soakedUntil
        const wasFrozen = now < enemy.frozenUntil
        const isSoakedInferno = isInferno && wasSoaked
        const isFrozenInferno = isInferno && wasFrozen
        const infernoConsumedStatus = isSoakedInferno || isFrozenInferno
        const actualDamage = isSoakedInferno ? spell.damage * 2 : spell.damage
        if (isSoakedInferno) {
          useEnemyStore.getState().clearEnemySoaked(enemy.id)
        }
        if (isFrozenInferno) {
          useEnemyStore.getState().clearEnemyFrozen(enemy.id)
        }
        useEnemyStore.getState().damageEnemy(enemy.id, actualDamage)

        // --- JUICE: hit flash, damage number, screen shake ---
        useEnemyStore.getState().setEnemyHitFlash(enemy.id, performance.now() + 100)

        const dmgColor = actualDamage >= 80 ? '#ef4444' : actualDamage >= 40 ? '#fbbf24' : '#ffffff'
        spawnDamageNumber(enemy.position.x, enemy.position.z, actualDamage, dmgColor)

        // Screen shake: stronger for big spells
        if (spell.type === 'METEOR' || spell.type === 'INFERNO') {
          useGameStore.getState().triggerScreenShake(0.6, 200)
        } else {
          useGameStore.getState().triggerScreenShake(0.3, 150)
        }

        // Apply status effects
        const config = SPELL_CONFIG[spell.type]
        if (spell.type === 'STEAM') {
          useEnemyStore.getState().setEnemySlowed(enemy.id, now + SLOW_DURATION_MS)
        } else if (config.slow > 0) {
          useEnemyStore.getState().setEnemySoaked(enemy.id, now + SOAK_DURATION_MS)
        }

        // Deep Freeze perk: BOTTLE-based spells freeze enemies; soak transforms into freeze.
        if (BOTTLE_SPELLS.includes(spell.type) && deepFreezeStacks > 0) {
          useEnemyStore.getState().setEnemyFrozen(enemy.id, now + 2000 * deepFreezeStacks)
          useEnemyStore.getState().clearEnemySoaked(enemy.id)
        }

        // Extra Spicy perk: BURN_SPELLS ignite enemies (Burn). STEAM excluded.
        // INFERNO skips burn when it consumes Soak/Freeze — fire spent on melt/steam.
        if (BURN_SPELLS.includes(spell.type) && extraSpicyStacks > 0 && !infernoConsumedStatus) {
          useEnemyStore.getState().setEnemyBurning(enemy.id, now + BURN_DURATION_MS)
        }

        if (spell.type === 'TIDAL_WAVE' && config.knockback > 0) {
          // Knockback: push enemy to the edge of spell radius
          const dx = enemy.position.x - spell.position.x
          const dz = enemy.position.z - spell.position.z
          const len = Math.sqrt(dx * dx + dz * dz) || 1
          const pushDist = spell.radius - len
          const speed = Math.max(0, pushDist) * 8
          useEnemyStore.getState().setEnemyKnockback(enemy.id, {
            vx: (dx / len) * speed,
            vz: (dz / len) * speed,
          })
        }
      }
    }

    // --- JUICE: hit freeze + screen flash for impactful spells ---
    // Only trigger once, on first frame damage is dealt
    if (damaged.current.size > 0 && elapsed.current <= delta * 2) {
      if (spell.type === 'METEOR' || spell.type === 'INFERNO') {
        useGameStore.getState().triggerHitFreeze(60)
        useGameStore.getState().triggerScreenFlash()
      }
      // Meteor ground crack
      if (spell.type === 'METEOR') {
        spawnGroundCrack(spell.position.x, spell.position.z)
      }
    }

    // Remove dead enemies and record kills
    const afterDamage = useEnemyStore.getState().enemies
    const dead = enemies.filter((e) => {
      if (e.dying || e.detonating) return false
      const updated = afterDamage.find((ae) => ae.id === e.id)
      return updated && updated.hp <= 0
    })
    for (const deadEnemy of dead) {
      // Exploder: start detonation instead of dying
      if (deadEnemy.type === 'exploder' && !deadEnemy.detonating && !deadEnemy.dying) {
        useEnemyStore.getState().setEnemyDetonating(deadEnemy.id)
        window.__queueDetonation?.(deadEnemy.id)
        continue
      }

      const wasBoss = deadEnemy.type === 'boss'
      if (!deadEnemy.dying) {
        useEnemyStore.getState().setEnemyDying(deadEnemy.id)
      }
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

  const color = PARTICLE_CONFIG[spell.type].color
  const isMeteor = spell.type === 'METEOR'

  if (isMeteor) {
    return (
      <group>
        <mesh
          ref={meshRef}
          position={[spell.position.x, 10.5, spell.position.z]}
        >
          <sphereGeometry args={[spell.radius, 16, 16]} />
          <meshStandardMaterial color={color} transparent opacity={0.85} emissive={color} emissiveIntensity={0.4} />
        </mesh>
        <group position={[spell.position.x, 0, spell.position.z]}>
          <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
        </group>
      </group>
    )
  }

  if (spell.type === 'FORTRESS') {
    return (
      <group>
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
        <group position={[spell.position.x, 0, spell.position.z]}>
          <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
        </group>
      </group>
    )
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[spell.position.x, 0.2, spell.position.z]}
        scale={[0, 1, 0]}
      >
        <cylinderGeometry args={[spell.radius, spell.radius, 0.3, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.7} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <group position={[spell.position.x, 0, spell.position.z]}>
        <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
      </group>
    </group>
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
