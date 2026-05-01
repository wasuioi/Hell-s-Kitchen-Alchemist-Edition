import { useFrame } from '@react-three/fiber'
import { Suspense } from 'react'
import { useStockCubeStore } from '../stores/stockCubeStore'
import { usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { getDistance } from '../utils/collision'
import StockCube from './StockCube'

// Pickup radius — within this distance the player walks the cube up.
const PICKUP_RADIUS = 1.2
// Bonemeal Stock T1 heal — fixed for now (T2/T3 deferred to a follow-up PR).
const PICKUP_HEAL_AMOUNT = 8

// Manages the active list of Bonemeal Stock cubes:
// - Despawn expired cubes (lifetimeMs since spawn)
// - Detect player pickup (distance check, heal + remove)
// - Reset on phase change away from combat/boss so cubes don't linger over
//   reward / death / lull / victory overlays.
export default function StockCubes() {
  const cubes = useStockCubeStore((s) => s.cubes)

  useFrame(() => {
    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') {
      // Out-of-combat phases shouldn't carry pickups across screens.
      if (useStockCubeStore.getState().cubes.length > 0) {
        useStockCubeStore.getState().reset()
      }
      return
    }

    const nowMs = performance.now()
    const playerPos = usePlayerStore.getState().position
    const list = useStockCubeStore.getState().cubes

    for (const cube of list) {
      // Despawn after lifetime.
      if (nowMs - cube.spawnedAt >= cube.lifetimeMs) {
        useStockCubeStore.getState().removeCube(cube.id)
        continue
      }
      // Pickup.
      if (getDistance(playerPos, cube.position) <= PICKUP_RADIUS) {
        usePlayerStore.getState().heal(PICKUP_HEAL_AMOUNT)
        useStockCubeStore.getState().removeCube(cube.id)
      }
    }
  })

  return (
    <Suspense fallback={null}>
      {cubes.map((cube) => <StockCube key={cube.id} cube={cube} />)}
    </Suspense>
  )
}
