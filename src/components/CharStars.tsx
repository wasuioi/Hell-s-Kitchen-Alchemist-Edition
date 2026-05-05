import { useFrame } from '@react-three/fiber'
import { useCharStarStore } from '../stores/charStarStore'
import { useGameStore } from '../stores/gameStore'
import CharStar from './CharStar'

// Manages all active CharStar world objects:
// - Clears the list when leaving combat so carcasses don't linger into
//   reward / death / lull / victory overlays.
// - Delegates per-star detonation logic to the CharStar component.
export default function CharStars() {
  const charStars = useCharStarStore((s) => s.charStars)

  useFrame(() => {
    const phase = useGameStore.getState().phase
    if (phase !== 'combat' && phase !== 'boss') {
      if (useCharStarStore.getState().charStars.length > 0) {
        useCharStarStore.getState().reset()
      }
    }
  })

  return (
    <>
      {charStars.map((star) => (
        <CharStar key={star.id} star={star} />
      ))}
    </>
  )
}
