import { useRef, useMemo, Suspense, Component, type ReactNode } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharStar as CharStarType } from '../types'
import { useCharStarStore } from '../stores/charStarStore'
import { useEnemyStore } from '../stores/enemyStore'
import { useGameStore } from '../stores/gameStore'
import { usePlayerStore } from '../stores/playerStore'
import { useDeckStore } from '../stores/deckStore'
import { spawnExplosionVfx, spawnDamageNumberVfx } from '../utils/spawnVfx'
import { triggerOnEnemyDeath } from '../utils/perkTriggers'

declare global {
  interface Window {
    __queueDetonation?: (enemyId: string, chainDepth?: number) => void
  }
}

// Sprite-sheet constants — same format as SpriteVfxEffect (6×4, 24 frames).
const COLS = 6
const ROWS = 4
const TOTAL_FRAMES = COLS * ROWS
const PLAYBACK_DURATION = 0.9

class CharStarErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err: unknown) {
    console.warn('[CharStar] dropping sprite — asset missing or failed to load:', err)
  }
  render() { return this.state.hasError ? null : this.props.children }
}

function CharStarSprite({ star }: { star: CharStarType }) {
  const baseTex = useLoader(THREE.TextureLoader, '/vfx/char_star_idle.png')
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
    // Loop the animation using modulo — last frame wraps seamlessly to first.
    const age = ((performance.now() - star.spawnedAt) / 1000) % PLAYBACK_DURATION
    const t = age / PLAYBACK_DURATION
    const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.floor(t * TOTAL_FRAMES))
    const col = frameIdx % COLS
    const row = Math.floor(frameIdx / COLS)
    texture.offset.set(col / COLS, 1 - (row + 1) / ROWS)
  })

  return (
    <mesh position={[star.position.x, 0.05, star.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.5, 2.5]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// Pulsing ground glow — visible even when the VFX asset isn't loaded.
function CharStarGlow({ star }: { star: CharStarType }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (!matRef.current) return
    const age = (performance.now() - star.spawnedAt) / 1000
    matRef.current.opacity = 0.25 + 0.15 * Math.sin(age * Math.PI * 4)
  })

  return (
    <mesh position={[star.position.x, 0.02, star.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1.2, 32]} />
      <meshBasicMaterial ref={matRef} color="#ff4400" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

export default function CharStar({ star }: { star: CharStarType }) {
  const detonated = useRef(false)

  useFrame(() => {
    if (detonated.current) return
    const now = performance.now()
    if (now - star.spawnedAt < star.lifetimeMs) return
    detonated.current = true

    const stacks = useDeckStore.getState().activePerks.find((p) => p.id === 'char_star')?.stackCount ?? 1
    const tier = Math.min(stacks, 3)
    const radius = [3, 4, 5][tier - 1]
    const damage = [25, 40, 55][tier - 1]

    spawnExplosionVfx(star.position.x, star.position.z, 0)

    // Snapshot enemies before damage so lastHitRecipeKind reflects the
    // spell that marked them, not this detonation (for T2 chain check).
    const snapshot = useEnemyStore.getState().enemies

    for (const e of snapshot) {
      if (e.dying || e.detonating) continue
      const dx = e.position.x - star.position.x
      const dz = e.position.z - star.position.z
      if (Math.hypot(dx, dz) > radius) continue

      useEnemyStore.getState().damageEnemy(e.id, damage)
      useEnemyStore.getState().setEnemyHitFlash(e.id, now + 100)
      const dmgColor = damage >= 55 ? '#ef4444' : '#fbbf24'
      spawnDamageNumberVfx(e.position.x, e.position.z, damage, dmgColor)

      const updated = useEnemyStore.getState().enemies.find((x) => x.id === e.id)
      if (!updated || updated.hp > 0) {
        // Survivor — apply stun at T3.
        if (tier >= 3 && updated && !updated.dying) {
          useEnemyStore.getState().setEnemyStunned(e.id, now + 400)
        }
        continue
      }

      // Enemy died.
      if (updated.type === 'exploder' && !updated.detonating && !updated.dying) {
        useEnemyStore.getState().setEnemyDetonating(updated.id)
        window.__queueDetonation?.(updated.id, 1)
        continue
      }

      if (!updated.dying) {
        useEnemyStore.getState().setEnemyDying(updated.id)
      }
      useGameStore.getState().recordEnemyDefeated()

      if (updated.type === 'boss') {
        useEnemyStore.getState().reset()
        useGameStore.getState().triggerVictory()
        useCharStarStore.getState().removeCharStar(star.id)
        return
      }

      // Pass the pre-damage snapshot `e` so triggerOnEnemyDeath reads the
      // original lastHitRecipeKind for the T2 CHILI-marked chain check.
      triggerOnEnemyDeath(e, 'chain')
    }

    // Self-damage if the player is standing too close to the detonating carcass.
    const p = usePlayerStore.getState().position
    if (Math.hypot(p.x - star.position.x, p.z - star.position.z) <= 1.5) {
      usePlayerStore.getState().takeTrueDamage(5)
    }

    useCharStarStore.getState().removeCharStar(star.id)
  })

  return (
    <>
      <CharStarGlow star={star} />
      <CharStarErrorBoundary>
        <Suspense fallback={null}>
          <CharStarSprite star={star} />
        </Suspense>
      </CharStarErrorBoundary>
    </>
  )
}
