import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpellEffect, SpellType } from '../types'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { getDistance } from '../utils/collision'
import { PARTICLE_CONFIG } from '../data/particleConfig'
import { MAX_PERK_TIER } from '../data/perks'
import { triggerJulienneChain } from '../utils/perkTriggers'
import ParticleSystem from './ParticleSystem'
import { spawnDamageNumber } from './DamageNumbers'
import { spawnGroundCrack } from './GroundCracks'

declare global {
  interface Window {
    __queueDetonation?: (enemyId: string, chainDepth?: number) => void
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
  const chainedThisCast = useRef(false)

  useFrame((_, delta) => {
    elapsed.current += delta
    const progress = Math.min(elapsed.current / spell.duration, 1)

    if (meshRef.current) {
      const scale = spell.type === 'METEOR'
        ? 1 + (1 - progress) * 0.5  // shrink slightly on impact
        : spell.type === 'SALT_SPEED'
          ? Math.min(1, progress * 6)  // Self-buff pops out very fast
          : progress                    // AOE expands outward (matches enemy push for Steam)

      meshRef.current.scale.set(scale, 1, scale)

      if (spell.type === 'METEOR') {
        // Drop from y=10 to y=0
        const y = Math.max(0, 10 * (1 - progress * 3))
        meshRef.current.position.y = y + 0.5
      }

      const material = meshRef.current.material as THREE.MeshStandardMaterial
      if (material) material.opacity = Math.max(0, 1 - progress)
    }

    // Damage enemies in range
    const enemies = useEnemyStore.getState().enemies
    const activePerks = useDeckStore.getState().activePerks
    const deepFreezeStacks = activePerks.find((p) => p.id === 'deep_freeze')?.stackCount || 0
    const extraSpicyStacks = activePerks.find((p) => p.id === 'extra_spicy')?.stackCount || 0
    const BOTTLE_SPELLS: SpellType[] = ['TIDAL_WAVE', 'MUD']
    const BURN_SPELLS: SpellType[] = ['INFERNO', 'METEOR']

    // SALT_SPEED is a self-buff with no enemy interaction
    if (spell.type === 'SALT_SPEED') {
      if (elapsed.current >= spell.duration) onExpired(spell.id)
      return
    }

    for (const enemy of enemies) {
      if (damaged.current.has(enemy.id)) continue
      const dist = getDistance(enemy.position, spell.position)
      const currentRadius = spell.type === 'METEOR' ? spell.radius : spell.radius * progress
      if (dist <= currentRadius) {
        damaged.current.add(enemy.id)

        // STEAM: push only, no damage, no status. Boss is immune to
        // knockback — flash a brief gray "resist" aura instead.
        if (spell.type === 'STEAM') {
          if (enemy.type === 'boss') {
            useEnemyStore.getState().setEnemyResistAura(enemy.id, performance.now() + 350)
          } else {
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
          continue
        }

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
        if (spell.damage > 0) {
          useEnemyStore.getState().damageEnemy(enemy.id, actualDamage)

          // --- JUICE: hit flash, damage number, screen shake ---
          useEnemyStore.getState().setEnemyHitFlash(enemy.id, performance.now() + 100)

          const dmgColor = actualDamage >= 80 ? '#ef4444' : actualDamage >= 40 ? '#fbbf24' : '#ffffff'
          // Boss is ~4.5 units tall vs the default 1.5; lift the damage number
          // above its head so the player can actually see it land.
          const dmgY = enemy.type === 'boss' ? 5 : 1.5
          spawnDamageNumber(enemy.position.x, enemy.position.z, actualDamage, dmgColor, dmgY)

          // Screen shake: stronger for big spells
          if (spell.type === 'METEOR' || spell.type === 'INFERNO') {
            useGameStore.getState().triggerScreenShake(0.6, 200)
          } else {
            useGameStore.getState().triggerScreenShake(0.3, 150)
          }

          if (!chainedThisCast.current) {
            const julienneStacks = activePerks.find((p) => p.id === 'julienne')?.stackCount ?? 0
            if (julienneStacks > 0) {
              chainedThisCast.current = true
              const tier = Math.min(julienneStacks, MAX_PERK_TIER) as 1 | 2 | 3
              triggerJulienneChain(enemy.id, actualDamage, tier)
            }
          }
        }

        // Apply status effects per spell
        if (spell.type === 'TIDAL_WAVE') {
          useEnemyStore.getState().setEnemySoaked(enemy.id, now + SOAK_DURATION_MS)
        } else if (spell.type === 'MUD') {
          useEnemyStore.getState().setEnemySlowed(enemy.id, now + SLOW_DURATION_MS)
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
        // chainDepth=1 → short delay, exploder bun in place (no sprint).
        window.__queueDetonation?.(deadEnemy.id, 1)
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
