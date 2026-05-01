import { useFrame } from '@react-three/fiber'
import { usePickupStore } from '../stores/pickupStore'
import { usePlayerStore } from '../stores/playerStore'
import HeartPickup from './HeartPickup'

const PICKUP_RADIUS = 1.0
const HEART_HEAL_AMOUNT = 10

// Renders all active hearts and runs the per-frame collision check that
// consumes a heart when the player walks within PICKUP_RADIUS units.
export default function HeartPickupManager() {
  const hearts = usePickupStore((s) => s.hearts)

  useFrame(() => {
    const player = usePlayerStore.getState().position
    const list = usePickupStore.getState().hearts
    for (const h of list) {
      const dx = h.position.x - player.x
      const dz = h.position.z - player.z
      if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
        usePickupStore.getState().remove(h.id)
        usePlayerStore.getState().heal(HEART_HEAL_AMOUNT)
      }
    }
  })

  return (
    <>
      {hearts.map((h) => <HeartPickup key={h.id} position={h.position} />)}
    </>
  )
}
