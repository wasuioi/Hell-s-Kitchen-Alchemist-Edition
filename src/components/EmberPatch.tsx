import { useMemo, Suspense, Component, type ReactNode } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import type { EmberPatch as EmberPatchType } from '../types'

const COLS = 6
const ROWS = 4
const TOTAL_FRAMES = COLS * ROWS
// Loop duration for the idle patch animation — chosen to feel like a slow,
// smouldering ember cycle rather than a fast active spell burst.
const LOOP_DURATION = 1.5

class VfxErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err: unknown) {
    console.warn('[EmberPatch] sprite asset missing or failed to load:', err)
  }
  render() { return this.state.hasError ? null : this.props.children }
}

function EmberPatchMesh({ patch }: { patch: EmberPatchType }) {
  const baseTex = useLoader(THREE.TextureLoader, '/vfx/embers_patch_idle.png')
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
    const t = (performance.now() / 1000) % LOOP_DURATION
    const frameIdx = Math.floor((t / LOOP_DURATION) * TOTAL_FRAMES) % TOTAL_FRAMES
    const col = frameIdx % COLS
    const row = Math.floor(frameIdx / COLS)
    texture.offset.set(col / COLS, 1 - (row + 1) / ROWS)
  })

  const size = patch.radius * 2
  return (
    <mesh position={[patch.x, 0.05, patch.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function EmberPatch({ patch }: { patch: EmberPatchType }) {
  return (
    <VfxErrorBoundary>
      <Suspense fallback={null}>
        <EmberPatchMesh patch={patch} />
      </Suspense>
    </VfxErrorBoundary>
  )
}
