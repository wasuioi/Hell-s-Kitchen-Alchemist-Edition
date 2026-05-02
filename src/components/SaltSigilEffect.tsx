import { useRef, useMemo, Suspense, Component, type ReactNode } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import type { Hazard } from '../types'

// Renders the looping VFX for a single SaltSigil hazard. Unlike SpriteVfxEffect
// (which plays a 0.9s one-shot), this loops the 24-frame sprite sheet for the
// hazard's entire lifetime, timed to a 1.2s seamless cycle as specified in the
// VFX brief. The plane is 12 world units wide so its glow rim reaches beyond the
// T3 damage radius of 6 units. Additive blending on a pure-black sprite sheet
// gives the same zero-alpha-channel transparency as SpriteVfxEffect.

const COLS = 6
const ROWS = 4
const TOTAL_FRAMES = COLS * ROWS
const LOOP_DURATION_S = 1.2
const SIGIL_PLANE_SIZE = 12

class SigilErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err: unknown) {
    console.warn('[SaltSigil] dropping sprite — asset missing or failed to load:', err)
  }
  render() { return this.state.hasError ? null : this.props.children }
}

function SigilInstance({ hazard }: { hazard: Hazard }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  const baseTex = useLoader(THREE.TextureLoader, '/vfx/salt_sigil.png')
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
    const ageS = (performance.now() - hazard.spawnedAt) / 1000
    const loopT = (ageS % LOOP_DURATION_S) / LOOP_DURATION_S
    const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.floor(loopT * TOTAL_FRAMES))
    const col = frameIdx % COLS
    const row = Math.floor(frameIdx / COLS)
    // Three.js UV origin is bottom-left; image rows are top-to-bottom.
    texture.offset.set(col / COLS, 1 - (row + 1) / ROWS)

    // Gentle breathing opacity so the sigil pulses while active.
    if (matRef.current) {
      matRef.current.opacity = 0.75 + 0.25 * Math.sin(ageS * Math.PI * 2 / LOOP_DURATION_S)
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[hazard.position.x, 0.05, hazard.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[SIGIL_PLANE_SIZE, SIGIL_PLANE_SIZE]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function SaltSigilEffect({ hazard }: { hazard: Hazard }) {
  return (
    <SigilErrorBoundary>
      <Suspense fallback={null}>
        <SigilInstance hazard={hazard} />
      </Suspense>
    </SigilErrorBoundary>
  )
}
