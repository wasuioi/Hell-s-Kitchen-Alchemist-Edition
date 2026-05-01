import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../stores/gameStore'
import { useHazardStore } from '../stores/hazardStore'
import { useEnemyStore } from '../stores/enemyStore'
import { usePlayerStore } from '../stores/playerStore'
import { HAZARD_DEFS, HAZARD_POOL } from '../data/hazards'
import { ARENA_SIZE } from './Arena'
import { getDistance } from '../utils/collision'
import Hazard from './Hazard'

// Living Kitchen — environmental hazards (issue #71).
// First pass: grease fire only, scheduled every ~12s during combat from wave 4+.
// Hazard system handles its own lifecycle and collision; rendered as a layer
// of <Hazard /> children driven by the hazardStore.
const HAZARD_INTERVAL_S = 12
const FIRST_HAZARD_WAVE = 4
// Pull cluster spawns away from arena walls so the disc doesn't clip out of bounds.
const HAZARD_SPAWN_INSET = 4

export default function HazardManager() {
  const nextHazardAt = useRef(0)
  const prevPhase = useRef<string>('menu')

  useFrame(() => {
    const { phase, currentWave } = useGameStore.getState()
    const nowMs = performance.now()

    // Combat entry — start the hazard clock fresh so the first one lands
    // ~HAZARD_INTERVAL_S into the wave, not instantly.
    if (phase === 'combat' && prevPhase.current !== 'combat') {
      nextHazardAt.current = nowMs + HAZARD_INTERVAL_S * 1000
      useHazardStore.getState().reset()
    }
    // Clear hazards when leaving combat to avoid lingering damage during
    // reward / death / boss / lull screens.
    if (phase !== 'combat' && prevPhase.current === 'combat') {
      useHazardStore.getState().reset()
    }
    prevPhase.current = phase

    if (phase !== 'combat') return

    // Schedule new hazards on the wall-clock — wave-driven gating opens the
    // door at FIRST_HAZARD_WAVE so early waves stay teaching-friendly.
    if (currentWave >= FIRST_HAZARD_WAVE && nowMs >= nextHazardAt.current) {
      const type = HAZARD_POOL[Math.floor(Math.random() * HAZARD_POOL.length)]
      const half = ARENA_SIZE / 2 - HAZARD_SPAWN_INSET
      const position = {
        x: (Math.random() - 0.5) * 2 * half,
        z: (Math.random() - 0.5) * 2 * half,
      }
      useHazardStore.getState().spawnHazard(type, position)
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
      if (!isDashing && getDistance(playerPos, h.position) <= def.radius) {
        usePlayerStore.getState().takeDamage(def.damage)
        if (usePlayerStore.getState().hp <= 0) useGameStore.getState().triggerDeath()
        didDamage = true
      }

      // Enemy collision — hazards damage everything caught in radius. Skip
      // already-dying / detonating enemies so we don't tick them past 0.
      const enemies = useEnemyStore.getState().enemies
      for (const e of enemies) {
        if (e.dying || e.detonating) continue
        if (getDistance(e.position, h.position) > def.radius) continue
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
  return <>{hazards.map((h) => <Hazard key={h.id} hazard={h} />)}</>
}
