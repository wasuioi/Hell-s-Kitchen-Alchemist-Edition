import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../stores/gameStore'
import { useHazardStore } from '../stores/hazardStore'
import { useEnemyStore } from '../stores/enemyStore'
import { usePlayerStore } from '../stores/playerStore'
import { HAZARD_DEFS, HAZARD_POOL, type HazardDef } from '../data/hazards'
import { ARENA_SIZE } from './Arena'
import type { Hazard, HazardType, Position } from '../types'
import HazardComponent from './Hazard'

// Living Kitchen — environmental hazards (issue #71).
// Schedules grease fires + steam vents on a 12s clock from wave 4+; vents
// also fire during the boss fight. Hazard system handles its own lifecycle
// and collision; rendered as a layer of <Hazard /> children driven by the
// hazardStore.
const HAZARD_INTERVAL_S = 12
const FIRST_HAZARD_WAVE = 4
// Pull disc spawns away from arena walls so they don't clip out of bounds.
const DISC_SPAWN_INSET = 4
// Keep wall vents away from corners so the rectangle doesn't graze the
// neighbouring wall.
const WALL_VENT_CORNER_INSET = 4

/** Pick a spawn position + rotation for a freshly-rolled hazard type.
 *  Exported so DevPanel can reuse the same placement rules when manually
 *  spawning a hazard of a chosen type. */
export function rollHazardPlacement(type: HazardType): { position: Position; rotation: number } {
  const def = HAZARD_DEFS[type]
  if (def.shape === 'disc') {
    const half = ARENA_SIZE / 2 - DISC_SPAWN_INSET
    return {
      position: {
        x: (Math.random() - 0.5) * 2 * half,
        z: (Math.random() - 0.5) * 2 * half,
      },
      rotation: 0,
    }
  }
  // Rect (steam vent): anchor on a random wall, perpendicular into arena.
  const half = ARENA_SIZE / 2
  const alongMax = ARENA_SIZE / 2 - WALL_VENT_CORNER_INSET
  const along = (Math.random() - 0.5) * 2 * alongMax
  const edge = Math.floor(Math.random() * 4)
  switch (edge) {
    case 0: return { position: { x: along, z: -half }, rotation: 0 }              // north wall, +z
    case 1: return { position: { x: along, z: half }, rotation: Math.PI }         // south wall, -z
    case 2: return { position: { x: half, z: along }, rotation: -Math.PI / 2 }    // east wall, -x
    default: return { position: { x: -half, z: along }, rotation: Math.PI / 2 }   // west wall, +x
  }
}

/** True if (px, pz) lies inside the hazard's damage shape. */
function isInHazard(px: number, pz: number, h: Hazard, def: HazardDef): boolean {
  const dx = px - h.position.x
  const dz = pz - h.position.z
  if (def.shape === 'disc') {
    return dx * dx + dz * dz <= def.radius * def.radius
  }
  // Rect: rotate point into the vent's local frame (vent extends along +z).
  const cos = Math.cos(h.rotation)
  const sin = Math.sin(h.rotation)
  const localX = dx * cos - dz * sin
  const localZ = dx * sin + dz * cos
  return localZ >= 0 && localZ <= def.length && Math.abs(localX) <= def.width / 2
}

export default function HazardManager() {
  const nextHazardAt = useRef(0)
  const prevPhase = useRef<string>('menu')

  useFrame(() => {
    const { phase, currentWave } = useGameStore.getState()
    const nowMs = performance.now()

    // Hazards run during combat AND boss — the boss fight gets the same
    // environmental pressure to keep the kitchen feeling alive.
    const isHazardPhase = phase === 'combat' || phase === 'boss'
    const wasHazardPhase = prevPhase.current === 'combat' || prevPhase.current === 'boss'

    // Just entered a hazard phase from anywhere else (menu, reward, lull).
    // Reset hazards + restart the clock so the first one lands ~HAZARD_INTERVAL_S in.
    if (isHazardPhase && !wasHazardPhase) {
      nextHazardAt.current = nowMs + HAZARD_INTERVAL_S * 1000
      useHazardStore.getState().reset()
    }
    // Just exited (reward / lull / death / victory). Clear so they don't
    // tick damage on overlay screens.
    if (!isHazardPhase && wasHazardPhase) {
      useHazardStore.getState().reset()
    }
    prevPhase.current = phase

    if (!isHazardPhase) return

    // Schedule new hazards on the wall-clock — wave-driven gating opens the
    // door at FIRST_HAZARD_WAVE so early waves stay teaching-friendly.
    // Boss phase carries currentWave 7, so the gate is naturally open there.
    if (currentWave >= FIRST_HAZARD_WAVE && nowMs >= nextHazardAt.current) {
      const type = HAZARD_POOL[Math.floor(Math.random() * HAZARD_POOL.length)]
      const { position, rotation } = rollHazardPlacement(type)
      useHazardStore.getState().spawnHazard(type, position, rotation)
      nextHazardAt.current = nowMs + HAZARD_INTERVAL_S * 1000
    }

    // Lifecycle + collision. Iterate from a snapshot so removeHazard mid-loop is safe.
    const hazards = useHazardStore.getState().hazards
    const playerPos = usePlayerStore.getState().position
    const isDashing = usePlayerStore.getState().isDashing

    for (const h of hazards) {
      const def = HAZARD_DEFS[h.type]
      const elapsed = nowMs - h.spawnedAt
      // Cleanup once the active phase has fully run.
      if (elapsed >= def.telegraphMs + def.activeMs) {
        useHazardStore.getState().removeHazard(h.id)
        continue
      }
      // Skip collision during the telegraph window — that's the fairness beat.
      if (elapsed < def.telegraphMs) continue

      const intervalMs = def.damageInterval * 1000
      if (nowMs - h.lastDamageAt < intervalMs) continue
      let didDamage = false

      // Player collision — dash gives i-frames, matches the existing exploder rule.
      if (!isDashing && isInHazard(playerPos.x, playerPos.z, h, def)) {
        usePlayerStore.getState().takeDamage(def.damage)
        if (usePlayerStore.getState().hp <= 0) useGameStore.getState().triggerDeath()
        didDamage = true
      }

      // Enemy collision — hazards damage everything caught in shape EXCEPT
      // the boss; the boss fight reads better when hazards are pure player
      // pressure, not a chip-damage tool against the boss HP bar.
      const enemies = useEnemyStore.getState().enemies
      for (const e of enemies) {
        if (e.dying || e.detonating) continue
        if (e.type === 'boss') continue
        if (!isInHazard(e.position.x, e.position.z, h, def)) continue
        useEnemyStore.getState().damageEnemy(e.id, def.damage)
        useEnemyStore.getState().setEnemyHitFlash(e.id, nowMs + 100)
        const updated = useEnemyStore.getState().enemies.find((x) => x.id === e.id)
        if (updated && updated.hp <= 0 && !updated.dying) {
          // Exploders queue a chain detonation through the global hook the
          // EnemyManager registers — falling through just marks them dying.
          if (updated.type === 'exploder' && (window as Window & { __queueDetonation?: (id: string, depth?: number) => void }).__queueDetonation) {
            useEnemyStore.getState().setEnemyDetonating(e.id)
            ;(window as Window & { __queueDetonation?: (id: string, depth?: number) => void }).__queueDetonation!(e.id, 0)
          } else {
            useEnemyStore.getState().setEnemyDying(e.id)
            useGameStore.getState().recordEnemyDefeated()
          }
        }
        didDamage = true
      }

      if (didDamage) useHazardStore.getState().setLastDamageAt(h.id, nowMs)
    }
  })

  const hazards = useHazardStore((s) => s.hazards)
  return <>{hazards.map((h) => <HazardComponent key={h.id} hazard={h} />)}</>
}
