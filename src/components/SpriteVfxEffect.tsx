import { useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
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

// 6×4 = 24 frames lets the explosion show a soft burst, peak, ember
// stage and smoke fade-out over a single play. Source extraction:
// `ffmpeg ... -vf "fps=3,scale=128:128,tile=6x4" ...` (3fps × 8s = 24).
const COLS = 6
const ROWS = 4
const TOTAL_FRAMES = COLS * ROWS
// 1.0s playback gives ~24fps in-game animation — smooth enough that the
// dimming embers in the last few frames read as a fade rather than a
// sudden cut. Bumping any higher feels sluggish for a damage reaction.
const PLAYBACK_DURATION = 1.0
const FRAME_DURATION = PLAYBACK_DURATION / TOTAL_FRAMES
const LIFETIME = PLAYBACK_DURATION + 0.05 // small buffer to finish the last frame
// Plane size in world units. With the frame's visible fire reaching ~80%
// of the sprite, SIZE=10 gives a bloom roughly 8 units across — close to
// grease_fire's T1 radius (4) at the rim, slightly under-spilling for T3.
const SIZE = 10

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
  })

  // Lay the plane flat on the ground (rotated -90° around X) so the burst
  // reads as a top-down bloom expanding around the player. y=0.05 keeps it
  // just above the floor mesh to avoid z-fighting.
  return (
    <mesh ref={meshRef} position={[vfx.position.x, 0.05, vfx.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
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
