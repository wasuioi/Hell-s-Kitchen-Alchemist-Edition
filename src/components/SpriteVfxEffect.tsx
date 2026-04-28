import { useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

// ── Sprite-sheet VFX player ─────────────────────────────────────────────────
//
// Plays a 4×4 sprite-sheet PNG (16 frames, 128×128 each → 512×512 total) as
// a camera-billboarded plane in the 3D scene. Pure black background of the
// PNG renders transparent via additive blending — no alpha channel needed.
//
// Usage from anywhere: `spawnSpriteVfx('grease_fire', x, z)` (see
// src/utils/spawnVfx.ts). Sprite sheets live at `/vfx/<slug>.png`.
//
// Add new VFX by dropping a new sprite sheet into `public/vfx/` — no code
// change needed; the loader resolves the URL from the slug.
// ────────────────────────────────────────────────────────────────────────────

const COLS = 4
const ROWS = 4
const TOTAL_FRAMES = COLS * ROWS
const PLAYBACK_DURATION = 0.5 // seconds; chosen to match the perk-trigger feel
const FRAME_DURATION = PLAYBACK_DURATION / TOTAL_FRAMES
const LIFETIME = PLAYBACK_DURATION + 0.05 // small buffer to finish the last frame
const SIZE = 6 // billboard size in world units; tuned to match grease_fire AOE

interface SpriteVfx {
  id: string
  position: { x: number; z: number }
  spriteSlug: string
  createdAt: number
}

declare global {
  interface Window {
    __spawnSpriteVfx?: (arg: { x: number; z: number; spriteSlug: string }) => void
  }
}

let nextId = 0

function SpriteVfxInstance({ vfx }: { vfx: SpriteVfx }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  // useLoader caches per URL across the whole app — multiple instances of
  // the same slug share the GPU upload but each instance gets its own
  // clone so they can advance through frames independently. clone()
  // copies offset/repeat state but reuses the underlying image, so it's
  // cheap.
  const baseTex = useLoader(THREE.TextureLoader, `/vfx/${vfx.spriteSlug}.png`)
  const texture = useMemo(() => {
    const t = baseTex.clone()
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(1 / COLS, 1 / ROWS)
    t.needsUpdate = true
    return t
  }, [baseTex])

  useFrame(() => {
    // Compute age inside useFrame — the parent only re-renders when the
    // list changes, so passing `age` as a prop would freeze on the first
    // frame and never animate.
    const age = (performance.now() - vfx.createdAt) / 1000
    const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.floor(age / FRAME_DURATION))
    const col = frameIdx % COLS
    const row = Math.floor(frameIdx / COLS)
    // Three.js UV origin is bottom-left, but image rows read top-to-bottom,
    // so flip the row index when computing the y offset.
    texture.offset.set(col / COLS, 1 - (row + 1) / ROWS)

    // Billboard the sprite to face the camera so the burst reads as a flat
    // 2D effect from any camera angle.
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh ref={meshRef} position={[vfx.position.x, 1.5, vfx.position.z]}>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function SpriteVfxEffects() {
  const [list, setList] = useState<SpriteVfx[]>([])
  const listRef = useRef<SpriteVfx[]>([])

  const spawn = useCallback((data: { x: number; z: number; spriteSlug: string }) => {
    const v: SpriteVfx = {
      id: `sprvfx_${nextId++}`,
      position: { x: data.x, z: data.z },
      spriteSlug: data.spriteSlug,
      createdAt: performance.now(),
    }
    listRef.current = [...listRef.current, v]
    setList([...listRef.current])
  }, [])

  useFrame(() => {
    if (!window.__spawnSpriteVfx) {
      window.__spawnSpriteVfx = (arg) => spawn(arg)
    }
    const now = performance.now()
    const before = listRef.current.length
    listRef.current = listRef.current.filter((v) => (now - v.createdAt) / 1000 < LIFETIME)
    if (listRef.current.length !== before) setList([...listRef.current])
  })

  return (
    <Suspense fallback={null}>
      {list.map((v) => (
        <SpriteVfxInstance key={v.id} vfx={v} />
      ))}
    </Suspense>
  )
}
