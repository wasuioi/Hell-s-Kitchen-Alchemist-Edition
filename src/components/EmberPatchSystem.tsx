import { useFrame } from '@react-three/fiber'
import { useWorldStore } from '../stores/worldStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { spawnDamageNumberVfx } from '../utils/spawnVfx'
import EmberPatch from './EmberPatch'

const TICK_INTERVAL = 0.25
// Damage per tick at each tier (4 ticks/sec → 6/9/13 dps)
const DMG_PER_TICK = [1.5, 2.25, 3.25]

// Per-patch DoT tick accumulator — lives outside React so it survives
// re-renders without polluting Zustand with per-frame writes.
const tickAccumMap = new Map<string, number>()

function EmberPatchTicker() {
  useFrame((_, dt) => {
    const worldStore = useWorldStore.getState()
    const patches = worldStore.tickPatches(dt)

    if (patches.length === 0) {
      tickAccumMap.clear()
      return
    }

    const embersStacks = useDeckStore.getState().activePerks.find((p) => p.id === 'lingering_embers')?.stackCount ?? 0
    if (embersStacks === 0) return

    const now = performance.now()

    for (const patch of patches) {
      const accum = (tickAccumMap.get(patch.id) ?? 0) + dt
      if (accum < TICK_INTERVAL) {
        tickAccumMap.set(patch.id, accum)
        continue
      }
      tickAccumMap.set(patch.id, accum - TICK_INTERVAL)

      const dmgPerTick = DMG_PER_TICK[patch.tier - 1]
      // Read fresh enemy list per patch so we pick up dying flags set in
      // earlier patch iterations within the same frame.
      const enemies = useEnemyStore.getState().enemies

      for (const enemy of enemies) {
        if (enemy.dying || enemy.detonating) continue
        const dx = enemy.position.x - patch.x
        const dz = enemy.position.z - patch.z
        if (dx * dx + dz * dz > patch.radius * patch.radius) continue

        const isSoaked = enemy.soakedUntil > now
        const mult = patch.tier >= 2 && isSoaked ? 1.5 : 1
        const dmg = dmgPerTick * mult

        useEnemyStore.getState().damageEnemy(enemy.id, dmg)
        useEnemyStore.getState().setEnemyHitFlash(enemy.id, now + 100)
        spawnDamageNumberVfx(enemy.position.x, enemy.position.z, dmg, '#ff8800')

        const updated = useEnemyStore.getState().enemies.find((e) => e.id === enemy.id)
        if (!updated || updated.hp > 0) continue

        // Death handling — mirrors the convention in perkTriggers.ts
        if (updated.type === 'exploder') {
          useEnemyStore.getState().setEnemyDetonating(updated.id)
          window.__queueDetonation?.(updated.id)
          continue
        }

        useEnemyStore.getState().setEnemyDying(updated.id)
        useGameStore.getState().recordEnemyDefeated()

        if (updated.type === 'boss') {
          useEnemyStore.getState().reset()
          useGameStore.getState().triggerVictory()
          return
        }

        // T3 capstone: kill inside this patch resets its lifetime and grows radius
        if (patch.tier >= 3) {
          worldStore.refreshAndGrow(patch.id, 0.75, 6.0)
        }
      }
    }

    // Remove accum entries for patches that have since expired
    for (const id of tickAccumMap.keys()) {
      if (!patches.some((p) => p.id === id)) tickAccumMap.delete(id)
    }
  })

  return null
}

export default function EmberPatchSystem() {
  const patches = useWorldStore((s) => s.patches)

  return (
    <>
      <EmberPatchTicker />
      {patches.map((patch) => (
        <EmberPatch key={patch.id} patch={patch} />
      ))}
    </>
  )
}
