import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../stores/gameStore'
import { useHazardStore } from '../stores/hazardStore'
import { useEnemyStore } from '../stores/enemyStore'
import { usePlayerStore } from '../stores/playerStore'
import { HAZARD_DEFS, HAZARD_POOL, type HazardDef } from '../data/hazards'
import type { Hazard } from '../types'
import { rollHazardPlacement } from './hazardPlacement'
import HazardComponent from './Hazard'

// Living Kitchen — environmental hazards (issue #71).
// Schedules grease fires / steam vents / falling pots on a wave-aware clock
// from wave 4+; also fires during the boss fight. Hazard system handles its
// own lifecycle and collision; rendered as a layer of <Hazard /> children
// driven by the hazardStore.
const FIRST_HAZARD_WAVE = 4
// Spawn cadence escalates as the run progresses, so late-game feels
// meaningfully tighter than the wave-4 intro tier.
const HAZARD_INTERVAL_EARLY_COMBAT_S = 12  // wave 4-5: teaching tier
const HAZARD_INTERVAL_MID_COMBAT_S = 10    // wave 6: picks up
const HAZARD_INTERVAL_LATE_COMBAT_S = 8    // wave 7: chaotic with surge
const HAZARD_INTERVAL_BOSS_S = 6           // boss: relentless

function getHazardIntervalSec(phase: string, currentWave: number): number {
  if (phase === 'boss') return HAZARD_INTERVAL_BOSS_S
  if (currentWave >= 7) return HAZARD_INTERVAL_LATE_COMBAT_S
  if (currentWave >= 6) return HAZARD_INTERVAL_MID_COMBAT_S
  return HAZARD_INTERVAL_EARLY_COMBAT_S
}
/** True if (px, pz) lies inside the hazard's damage shape. */
function isInHazard(px: number, pz: number, h: Hazard, def: HazardDef): boolean {
  const dx = px - h.position.x
  const dz = pz - h.position.z
  if (def.shape === 'disc' || def.shape === 'falling') {
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
    // Reset hazards + restart the clock at the current tier's interval.
    if (isHazardPhase && !wasHazardPhase) {
      nextHazardAt.current = nowMs + getHazardIntervalSec(phase, currentWave) * 1000
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
    // Interval shrinks by tier (see getHazardIntervalSec) so wave 7 + boss
    // feel meaningfully tighter than the wave-4 intro.
    if (currentWave >= FIRST_HAZARD_WAVE && nowMs >= nextHazardAt.current) {
      const type = HAZARD_POOL[Math.floor(Math.random() * HAZARD_POOL.length)]
      const { position, rotation } = rollHazardPlacement(type)
      useHazardStore.getState().spawnHazard(type, position, rotation)
      nextHazardAt.current = nowMs + getHazardIntervalSec(phase, currentWave) * 1000
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
