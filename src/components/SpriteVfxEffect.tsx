import { useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { PERK_POOL } from '../data/perks'

// ── Sprite-sheet VFX player ─────────────────────────────────────────────────
//
// Plays a 6×4 sprite-sheet PNG (24 frames, 128×128 each → 768×512 total) as
// a flat-on-ground plane in the 3D scene. Pure black background of the PNG
// renders transparent via additive blending — no alpha channel needed.
//
// Usage from anywhere: `spawnSpriteVfx('grease_fire', x, z, size?)` (see
// src/utils/spawnVfx.ts). Sprite sheets live at `/vfx/<slug>.png`.
//
// Add new VFX by dropping a new sprite sheet into `public/vfx/` — no code
// change needed; the loader resolves the URL from the slug.
// ────────────────────────────────────────────────────────────────────────────

const COLS = 6
const ROWS = 4
const TOTAL_FRAMES = COLS * ROWS
// Total playback length. The phase-split timing below means the rise
// (expand) takes ~0.36s and the fall (fade) takes ~0.50s with a 50ms
// peak transit between — a "wave that crashes" rather than a fireball
// that lingers.
const PLAYBACK_DURATION = 0.9
const LIFETIME = PLAYBACK_DURATION + 0.05
// Default plane size when a spawn doesn't specify one. Most callers pass
// a per-spawn size derived from their own AOE radius — see spawnSpriteVfx.
const DEFAULT_SIZE = 7

// Phase split — chosen so the player sees the expansion clearly, the
// peak frames blur past in a single beat (just enough for visual
// continuity), and the fade is the longest phase so the burst recedes
// rather than disappears.
//
// Maps to the source sprite sheet:
//   frames 0..6  → expand     (40% of playback)
//   frames 7..11 → peak       ( 5% of playback)   ← was the "hold" feel
//   frames 12..23 → fade      (55% of playback)
const FRAME_EXPAND_END = 6
const FRAME_FADE_START = 12
const PHASE_EXPAND = 0.40
const PHASE_PEAK = 0.05

interface SpriteVfx {
  id: string
  position: { x: number; z: number }
  spriteSlug: string
  size: number
  createdAt: number
}

declare global {
  interface Window {
    __spawnSpriteVfx?: (arg: { x: number; z: number; spriteSlug: string; size?: number }) => void
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
    const t = Math.min(1, age / PLAYBACK_DURATION)

    // Phase-split frame mapping: expand → quick peak transit → fade. The
    // peak phase only consumes 5% of playback so the player no longer
    // sees frames 7..11 hang at the same look — they flash past for
    // visual continuity, then the fade frames take over.
    let frameIdx: number
    if (t < PHASE_EXPAND) {
      // Expand: frames 0..6
      const phaseT = t / PHASE_EXPAND
      frameIdx = Math.floor(phaseT * (FRAME_EXPAND_END + 1))
    } else if (t < PHASE_EXPAND + PHASE_PEAK) {
      // Peak transit: frames 7..(FRAME_FADE_START-1)
      const phaseT = (t - PHASE_EXPAND) / PHASE_PEAK
      const peakLen = FRAME_FADE_START - (FRAME_EXPAND_END + 1)
      frameIdx = (FRAME_EXPAND_END + 1) + Math.floor(phaseT * peakLen)
    } else {
      // Fade: frames 12..23
      const phaseT = (t - PHASE_EXPAND - PHASE_PEAK) / (1 - PHASE_EXPAND - PHASE_PEAK)
      const fadeLen = TOTAL_FRAMES - FRAME_FADE_START
      frameIdx = FRAME_FADE_START + Math.floor(phaseT * fadeLen)
    }
    frameIdx = Math.min(TOTAL_FRAMES - 1, Math.max(0, frameIdx))

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
      <planeGeometry args={[vfx.size, vfx.size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// Invisible always-mounted mesh that holds a reference to a sprite-sheet
// texture. Without this, the very first call to spawnSpriteVfx for a slug
// causes a frame-skip — the GPU upload + shader compile happens during
// the first real draw call. Mounting one per slug at scene start does
// that work up-front so the first real burst is jank-free.
function VfxWarmup({ slug }: { slug: string }) {
  const tex = useLoader(THREE.TextureLoader, `/vfx/${slug}.png`)
  return (
    <mesh position={[0, -1000, 0]}>
      <planeGeometry args={[0.001, 0.001]} />
      <meshBasicMaterial
        map={tex}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0}
      />
    </mesh>
  )
}

const WARMUP_SLUGS = Array.from(new Set(
  PERK_POOL.flatMap((p) => (p.vfxSprite ? [p.vfxSprite] : [])),
))

export default function SpriteVfxEffects() {
  const [list, setList] = useState<SpriteVfx[]>([])
  const listRef = useRef<SpriteVfx[]>([])

  const spawn = useCallback((data: { x: number; z: number; spriteSlug: string; size?: number }) => {
    const v: SpriteVfx = {
      id: `sprvfx_${nextId++}`,
      position: { x: data.x, z: data.z },
      spriteSlug: data.spriteSlug,
      size: data.size ?? DEFAULT_SIZE,
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
      {WARMUP_SLUGS.map((slug) => <VfxWarmup key={`warmup-${slug}`} slug={slug} />)}
      {list.map((v) => (
        <SpriteVfxInstance key={v.id} vfx={v} />
      ))}
    </Suspense>
  )
}
