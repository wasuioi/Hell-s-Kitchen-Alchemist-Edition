import { useRef, useState, useCallback, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ── Sprite-sheet VFX player ─────────────────────────────────────────────────
//
// Plays a 4×4 sprite-sheet PNG (16 frames, 128×128 each → 512×512 total) as
// a camera-billboarded plane in the 3D scene. Pure black background of the
// PNG is rendered transparent via additive blending — no alpha channel
// needed, so AI-generated MP4 → ffmpeg sprite sheets work directly.
//
// Usage from anywhere: `spawnSpriteVfxLocal('grease_fire', x, z)` (see
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

// One Texture per slug, shared by every active instance. We mutate
// `texture.offset` per-frame in useFrame — that means simultaneous
// VFX of the same slug all show the same frame, which is fine here
// because they all started within ~0.5s of each other anyway.
const textureCache = new Map<string, THREE.Texture>()

function getTexture(slug: string): THREE.Texture {
  const cached = textureCache.get(slug)
  if (cached) return cached
  const tex = new THREE.TextureLoader().load(`/vfx/${slug}.png`)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.repeat.set(1 / COLS, 1 / ROWS)
  textureCache.set(slug, tex)
  return tex
}

function SpriteVfxInstance({ vfx, age }: { vfx: SpriteVfx; age: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const texture = useMemo(() => getTexture(vfx.spriteSlug), [vfx.spriteSlug])

  useFrame(() => {
    // Advance through frames of the sprite sheet
    const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.floor(age / FRAME_DURATION))
    const col = frameIdx % COLS
    const row = Math.floor(frameIdx / COLS)
    // Three.js UV origin is bottom-left, but image rows read top-to-bottom,
    // so flip the row index when computing the y offset.
    texture.offset.set(col / COLS, 1 - (row + 1) / ROWS)

    // Billboard the sprite to face the camera so the player sees the
    // explosion as a flat 2D burst from any camera angle.
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
    <>
      {list.map((v) => {
        const age = (performance.now() - v.createdAt) / 1000
        return <SpriteVfxInstance key={v.id} vfx={v} age={age} />
      })}
    </>
  )
}
