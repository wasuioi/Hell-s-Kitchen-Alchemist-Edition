const ARENA_SIZE = 20
const WALL_HEIGHT = 2
const WALL_THICKNESS = 0.5

export default function Arena() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_SIZE, ARENA_SIZE]} />
        <meshStandardMaterial color="#3a3028" />
      </mesh>
      <gridHelper args={[ARENA_SIZE, 10, '#4a4038', '#4a4038']} position={[0, 0.01, 0]} />
      <mesh position={[0, WALL_HEIGHT / 2, -ARENA_SIZE / 2]}>
        <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, ARENA_SIZE / 2]}>
        <boxGeometry args={[ARENA_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      <mesh position={[ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      <mesh position={[-ARENA_SIZE / 2, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
    </group>
  )
}
export { ARENA_SIZE }
