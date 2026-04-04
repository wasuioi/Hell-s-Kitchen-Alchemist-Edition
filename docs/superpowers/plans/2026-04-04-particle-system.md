# Particle System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-layered particle system (burst + linger) to all spell casts for satisfying visual feedback.

**Architecture:** A single `ParticleSystem` React component using Three.js `<points>` with `BufferGeometry`. It manages two particle layers — a one-shot burst on cast and continuous linger particles during spell lifetime. All state lives in refs to avoid React re-renders. Integrated into existing `SpellVisual` as a child component.

**Tech Stack:** Three.js (Points, BufferGeometry, PointsMaterial, CanvasTexture), React Three Fiber (useFrame), TypeScript.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/data/particleConfig.ts` | Per-spell particle configuration (colors, speeds, textures, behavior flags) |
| Create | `src/components/ParticleSystem.tsx` | Points-based particle renderer with burst + linger layers |
| Modify | `src/components/Spell.tsx` | Import and mount `<ParticleSystem />` inside `SpellVisual` |
| Create | `src/__tests__/particleConfig.test.ts` | Tests for particle config completeness and correctness |

---

### Task 1: Particle Configuration Data

**Files:**
- Create: `src/data/particleConfig.ts`
- Create: `src/__tests__/particleConfig.test.ts`

This task defines the per-spell particle config that the ParticleSystem will consume. Separating config from rendering keeps ParticleSystem focused on one job.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/particleConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PARTICLE_CONFIG } from '../data/particleConfig'
import type { SpellType } from '../types'

const ALL_SPELLS: SpellType[] = ['INFERNO', 'TIDAL_WAVE', 'FORTRESS', 'STEAM', 'METEOR', 'MUD']

describe('PARTICLE_CONFIG', () => {
  it('has config for every spell type', () => {
    for (const spell of ALL_SPELLS) {
      expect(PARTICLE_CONFIG[spell]).toBeDefined()
    }
  })

  it('every spell has required fields', () => {
    for (const spell of ALL_SPELLS) {
      const cfg = PARTICLE_CONFIG[spell]
      expect(cfg.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(cfg.lingerYSpeed).toBeGreaterThan(0)
      expect(cfg.texture).toMatch(/^circle|square$/)
      expect(cfg.burstDirection).toMatch(/^sphere|hemisphere$/)
    }
  })

  it('stone spells use square texture and hemisphere burst', () => {
    expect(PARTICLE_CONFIG.FORTRESS.texture).toBe('square')
    expect(PARTICLE_CONFIG.FORTRESS.burstDirection).toBe('hemisphere')
    expect(PARTICLE_CONFIG.METEOR.texture).toBe('square')
    expect(PARTICLE_CONFIG.METEOR.burstDirection).toBe('hemisphere')
  })

  it('non-stone spells use circle texture and sphere burst', () => {
    expect(PARTICLE_CONFIG.INFERNO.texture).toBe('circle')
    expect(PARTICLE_CONFIG.INFERNO.burstDirection).toBe('sphere')
    expect(PARTICLE_CONFIG.TIDAL_WAVE.texture).toBe('circle')
    expect(PARTICLE_CONFIG.TIDAL_WAVE.burstDirection).toBe('sphere')
    expect(PARTICLE_CONFIG.STEAM.texture).toBe('circle')
    expect(PARTICLE_CONFIG.STEAM.burstDirection).toBe('sphere')
    expect(PARTICLE_CONFIG.MUD.texture).toBe('circle')
    expect(PARTICLE_CONFIG.MUD.burstDirection).toBe('sphere')
  })

  it('meteor has jitter flag', () => {
    expect(PARTICLE_CONFIG.METEOR.meteorJitter).toBe(true)
  })

  it('inferno has fireFlicker flag', () => {
    expect(PARTICLE_CONFIG.INFERNO.fireFlicker).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/particleConfig.test.ts`
Expected: FAIL — module `../data/particleConfig` not found.

- [ ] **Step 3: Write the implementation**

Create `src/data/particleConfig.ts`:

```ts
import type { SpellType } from '../types'

export interface ParticleSpellConfig {
  color: string
  lingerYSpeed: number
  texture: 'circle' | 'square'
  burstDirection: 'sphere' | 'hemisphere'
  meteorJitter?: boolean
  fireFlicker?: boolean
}

export const PARTICLE_CONFIG: Record<SpellType, ParticleSpellConfig> = {
  INFERNO: {
    color: '#ef4444',
    lingerYSpeed: 1.5,
    texture: 'circle',
    burstDirection: 'sphere',
    fireFlicker: true,
  },
  TIDAL_WAVE: {
    color: '#3b82f6',
    lingerYSpeed: 1.0,
    texture: 'circle',
    burstDirection: 'sphere',
  },
  FORTRESS: {
    color: '#9ca3af',
    lingerYSpeed: 0.8,
    texture: 'square',
    burstDirection: 'hemisphere',
  },
  STEAM: {
    color: '#a855f7',
    lingerYSpeed: 2.5,
    texture: 'circle',
    burstDirection: 'sphere',
  },
  METEOR: {
    color: '#f97316',
    lingerYSpeed: 1.0,
    texture: 'square',
    burstDirection: 'hemisphere',
    meteorJitter: true,
  },
  MUD: {
    color: '#b48c50',
    lingerYSpeed: 0.5,
    texture: 'circle',
    burstDirection: 'sphere',
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/particleConfig.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/particleConfig.ts src/__tests__/particleConfig.test.ts
git commit -m "feat: add per-spell particle configuration data"
```

---

### Task 2: Canvas Texture Generators

**Files:**
- Create: `src/components/ParticleSystem.tsx` (partial — textures only, component shell)

This task creates the two programmatic textures (soft circle + square with shadowBlur) and the component shell. Later tasks fill in the particle logic.

- [ ] **Step 1: Create the ParticleSystem component shell with texture generators**

Create `src/components/ParticleSystem.tsx`:

```tsx
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpellType } from '../types'
import { PARTICLE_CONFIG } from '../data/particleConfig'

// --- Texture generators (run once at module level) ---

function createCircleTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  )
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  return texture
}

function createSquareTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
  ctx.shadowBlur = 4
  ctx.fillStyle = 'rgba(255, 255, 255, 1)'
  ctx.fillRect(4, 4, size - 8, size - 8)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  return texture
}

const circleTexture = createCircleTexture()
const squareTexture = createSquareTexture()

// --- Constants ---

const BURST_COUNT = 50
const MAX_LINGER = 75
const TOTAL_PARTICLES = BURST_COUNT + MAX_LINGER

const LINGER_SPAWN_INTERVAL = 0.2
const LINGER_BATCH_SIZE = 5

// --- Component ---

interface ParticleSystemProps {
  type: SpellType
  duration: number
  radius: number
}

export default function ParticleSystem({ type, duration, radius }: ParticleSystemProps) {
  const config = PARTICLE_CONFIG[type]
  const texture = config.texture === 'square' ? squareTexture : circleTexture

  // Placeholder — will be filled in Task 3 and Task 4
  return null
}
```

- [ ] **Step 2: Verify the project still builds**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds (component isn't mounted yet, but must compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/ParticleSystem.tsx
git commit -m "feat: add ParticleSystem shell with canvas texture generators"
```

---

### Task 3: Burst Particle Layer

**Files:**
- Modify: `src/components/ParticleSystem.tsx`

This task implements the burst layer — 50 particles that explode outward on spawn, decelerate via friction, color-flicker from white through spell color to dark, and clean up when dead.

- [ ] **Step 1: Replace the ParticleSystem component body with full burst implementation**

Replace the component function in `src/components/ParticleSystem.tsx` starting from `export default function ParticleSystem` to end of file with:

```tsx
export default function ParticleSystem({ type, duration, radius }: ParticleSystemProps) {
  const config = PARTICLE_CONFIG[type]
  const texture = config.texture === 'square' ? squareTexture : circleTexture

  // --- Refs for particle state (not buffer attributes — updated per frame) ---
  const velocities = useRef(new Float32Array(TOTAL_PARTICLES * 3))
  const ages = useRef(new Float32Array(TOTAL_PARTICLES))
  const lifetimes = useRef(new Float32Array(TOTAL_PARTICLES))
  const lingerTimer = useRef(0)
  const lingerIndex = useRef(0) // next slot in linger region
  const spellAge = useRef(0)
  const initialized = useRef(false)

  // --- Buffer attributes (synced to GPU each frame) ---
  const positions = useMemo(() => new Float32Array(TOTAL_PARTICLES * 3), [])
  const colors = useMemo(() => new Float32Array(TOTAL_PARTICLES * 3), [])
  const sizes = useMemo(() => new Float32Array(TOTAL_PARTICLES), [])

  const pointsRef = useRef<THREE.Points>(null)

  // Parse spell color once
  const spellColor = useMemo(() => new THREE.Color(config.color), [config.color])

  // --- Initialize burst particles on first frame ---
  function initBurst() {
    const vel = velocities.current
    const age = ages.current
    const lt = lifetimes.current

    for (let i = 0; i < BURST_COUNT; i++) {
      const i3 = i * 3

      // Position: all start at origin (0,0,0) since parent group is at spell position
      positions[i3] = 0
      positions[i3 + 1] = 0.1 // slightly above ground
      positions[i3 + 2] = 0

      // Random direction on unit sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      let vx = Math.sin(phi) * Math.cos(theta)
      let vy = Math.sin(phi) * Math.sin(theta)
      let vz = Math.cos(phi)

      // Hemisphere for stone spells — force vy upward
      if (config.burstDirection === 'hemisphere') {
        vy = Math.abs(vy)
      }

      // Speed: 8-15 units/sec
      const speed = 8 + Math.random() * 7
      vel[i3] = vx * speed
      vel[i3 + 1] = vy * speed
      vel[i3 + 2] = vz * speed

      // Age and lifetime
      age[i] = 0
      lt[i] = 0.3 + Math.random() * 0.2 // 0.3 - 0.5s

      // Start color: white
      colors[i3] = 1
      colors[i3 + 1] = 1
      colors[i3 + 2] = 1

      // Size: 0.3 - 0.6
      sizes[i] = 0.3 + Math.random() * 0.3
    }

    // Initialize linger particles as dead (off screen)
    for (let i = BURST_COUNT; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3
      positions[i3] = 0
      positions[i3 + 1] = -999
      positions[i3 + 2] = 0
      vel[i3] = 0
      vel[i3 + 1] = 0
      vel[i3 + 2] = 0
      age[i] = 999
      lt[i] = 1
      colors[i3] = 0
      colors[i3 + 1] = 0
      colors[i3 + 2] = 0
      sizes[i] = 0
    }
  }

  useFrame((_, delta) => {
    if (!initialized.current) {
      initBurst()
      initialized.current = true
    }

    spellAge.current += delta
    const vel = velocities.current
    const age = ages.current
    const lt = lifetimes.current

    // --- Update burst particles ---
    for (let i = 0; i < BURST_COUNT; i++) {
      const i3 = i * 3
      age[i] += delta

      if (age[i] > lt[i]) {
        // Dead — move off screen
        positions[i3 + 1] = -999
        sizes[i] = 0
        vel[i3] = 0
        vel[i3 + 1] = 0
        vel[i3 + 2] = 0
        continue
      }

      const t = age[i] / lt[i] // 0..1 normalized age

      // Meteor jitter: random velocity perturbation in first 0.1s
      if (config.meteorJitter && age[i] < 0.1) {
        vel[i3] += (Math.random() - 0.5) * 20 * delta
        vel[i3 + 1] += (Math.random() - 0.5) * 20 * delta
        vel[i3 + 2] += (Math.random() - 0.5) * 20 * delta
      }

      // Friction
      vel[i3] *= 0.95
      vel[i3 + 1] *= 0.95
      vel[i3 + 2] *= 0.95

      // Move
      positions[i3] += vel[i3] * delta
      positions[i3 + 1] += vel[i3 + 1] * delta
      positions[i3 + 2] += vel[i3 + 2] * delta

      // Color flicker: white -> spell color -> dark
      if (t < 0.5) {
        // White to spell color
        const blend = t / 0.5
        colors[i3] = 1 + (spellColor.r - 1) * blend
        colors[i3 + 1] = 1 + (spellColor.g - 1) * blend
        colors[i3 + 2] = 1 + (spellColor.b - 1) * blend
      } else {
        // Spell color to dark
        const blend = (t - 0.5) / 0.5
        colors[i3] = spellColor.r * (1 - blend)
        colors[i3 + 1] = spellColor.g * (1 - blend)
        colors[i3 + 2] = spellColor.b * (1 - blend)
      }

      // Fire flicker: oscillate RGB slightly
      if (config.fireFlicker) {
        const flicker = Math.sin(age[i] * 30) * 0.15
        colors[i3] = Math.min(1, Math.max(0, colors[i3] + flicker))
        colors[i3 + 1] = Math.min(1, Math.max(0, colors[i3 + 1] + flicker * 0.3))
      }

      // Fade size with opacity
      sizes[i] = (0.3 + Math.random() * 0.01) * (1 - t)
    }

    // --- Linger spawning and update happens in Task 4 ---

    // --- Sync buffers to GPU ---
    if (pointsRef.current) {
      const geo = pointsRef.current.geometry
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.attributes.size.needsUpdate = true
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={TOTAL_PARTICLES}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={TOTAL_PARTICLES}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          array={sizes}
          count={TOTAL_PARTICLES}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        vertexColors
        transparent
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ParticleSystem.tsx
git commit -m "feat: implement burst particle layer with friction, color flicker, and cleanup"
```

---

### Task 4: Linger Particle Layer

**Files:**
- Modify: `src/components/ParticleSystem.tsx`

This task adds the linger layer — continuous particle spawning on a 2D disk during spell lifetime, with upward drift, fade-in, and per-spell Y-speed.

- [ ] **Step 1: Add linger logic inside the useFrame callback**

In `src/components/ParticleSystem.tsx`, find the comment `// --- Linger spawning and update happens in Task 4 ---` and replace it with:

```tsx
    // --- Spawn new linger particles ---
    if (spellAge.current < duration) {
      lingerTimer.current += delta
      while (lingerTimer.current >= LINGER_SPAWN_INTERVAL) {
        lingerTimer.current -= LINGER_SPAWN_INTERVAL

        for (let b = 0; b < LINGER_BATCH_SIZE; b++) {
          const i = BURST_COUNT + (lingerIndex.current % MAX_LINGER)
          lingerIndex.current++
          const i3 = i * 3

          // Random position on 2D disk within spell radius
          const angle = Math.random() * Math.PI * 2
          const dist = Math.sqrt(Math.random()) * radius
          positions[i3] = Math.cos(angle) * dist
          positions[i3 + 1] = 0.05 // ground level
          positions[i3 + 2] = Math.sin(angle) * dist

          // Velocity: slow upward + slight horizontal drift
          vel[i3] = (Math.random() - 0.5) * 0.6
          vel[i3 + 1] = config.lingerYSpeed
          vel[i3 + 2] = (Math.random() - 0.5) * 0.6

          // Age and lifetime
          age[i] = 0
          lt[i] = 0.8 + Math.random() * 0.4 // 0.8 - 1.2s

          // Start at spell color
          colors[i3] = spellColor.r
          colors[i3 + 1] = spellColor.g
          colors[i3 + 2] = spellColor.b

          // Size: 0.15 - 0.3
          sizes[i] = 0.15 + Math.random() * 0.15
        }
      }
    }

    // --- Update linger particles ---
    for (let i = BURST_COUNT; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3
      if (age[i] > lt[i]) {
        // Dead
        positions[i3 + 1] = -999
        sizes[i] = 0
        continue
      }

      age[i] += delta
      if (age[i] > lt[i]) {
        positions[i3 + 1] = -999
        sizes[i] = 0
        continue
      }

      const t = age[i] / lt[i]

      // Move upward
      positions[i3] += vel[i3] * delta
      positions[i3 + 1] += vel[i3 + 1] * delta
      positions[i3 + 2] += vel[i3 + 2] * delta

      // Fade-in over first 0.1s, then fade out
      let opacity: number
      if (age[i] < 0.1) {
        opacity = age[i] / 0.1
      } else {
        opacity = 1 - ((age[i] - 0.1) / (lt[i] - 0.1))
      }
      opacity = Math.max(0, Math.min(1, opacity))

      // Apply opacity via color intensity
      colors[i3] = spellColor.r * opacity
      colors[i3 + 1] = spellColor.g * opacity
      colors[i3 + 2] = spellColor.b * opacity

      // Fire flicker on linger too
      if (config.fireFlicker) {
        const flicker = Math.sin(age[i] * 25) * 0.1
        colors[i3] = Math.min(1, Math.max(0, colors[i3] + flicker))
      }

      // Shrink slightly as it fades
      sizes[i] = (0.15 + Math.random() * 0.01) * opacity
    }
```

- [ ] **Step 2: Verify the project builds**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ParticleSystem.tsx
git commit -m "feat: implement linger particle layer with disk spawn and per-spell Y-speed"
```

---

### Task 5: Integrate ParticleSystem into Spell.tsx

**Files:**
- Modify: `src/components/Spell.tsx:1-10` (imports)
- Modify: `src/components/Spell.tsx:156-201` (SpellVisual return statements)

This task mounts `<ParticleSystem />` inside each spell's visual group.

- [ ] **Step 1: Add the import**

In `src/components/Spell.tsx`, add after line 9 (`import { SPELL_CONFIG } from '../data/recipes'`):

```tsx
import ParticleSystem from './ParticleSystem'
```

- [ ] **Step 2: Add ParticleSystem to the Meteor return**

In `src/components/Spell.tsx`, replace the Meteor return block (lines 157-166):

```tsx
  if (isMeteor) {
    return (
      <group>
        <mesh
          ref={meshRef}
          position={[spell.position.x, 10.5, spell.position.z]}
        >
          <sphereGeometry args={[spell.radius, 16, 16]} />
          <meshStandardMaterial color={color} transparent opacity={0.85} emissive={color} emissiveIntensity={0.4} />
        </mesh>
        <group position={[spell.position.x, 0, spell.position.z]}>
          <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
        </group>
      </group>
    )
  }
```

- [ ] **Step 3: Add ParticleSystem to the Fortress return**

Replace the Fortress return block (lines 168-189):

```tsx
  if (spell.type === 'FORTRESS') {
    return (
      <group>
        <group ref={meshRef as any} position={[spell.position.x, 0, spell.position.z]} scale={[0, 1, 0]}>
          {/* Glass dome */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[spell.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color="#a8d8ea"
              transparent
              opacity={0.25}
              emissive="#a8d8ea"
              emissiveIntensity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Dome edge ring on ground */}
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[spell.radius - 0.15, spell.radius, 48]} />
            <meshStandardMaterial color="#a8d8ea" transparent opacity={0.5} emissive="#a8d8ea" emissiveIntensity={0.5} />
          </mesh>
        </group>
        <group position={[spell.position.x, 0, spell.position.z]}>
          <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
        </group>
      </group>
    )
  }
```

- [ ] **Step 4: Add ParticleSystem to the default (AOE cylinder) return**

Replace the default return block (lines 192-201):

```tsx
  return (
    <group>
      <mesh
        ref={meshRef}
        position={[spell.position.x, 0.2, spell.position.z]}
        scale={[0, 1, 0]}
      >
        <cylinderGeometry args={[spell.radius, spell.radius, 0.3, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.7} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <group position={[spell.position.x, 0, spell.position.z]}>
        <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
      </group>
    </group>
  )
```

- [ ] **Step 5: Verify the project builds**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Run all existing tests to check nothing is broken**

Run: `npx vitest run`
Expected: All tests pass (particle system is purely visual, no store changes).

- [ ] **Step 7: Commit**

```bash
git add src/components/Spell.tsx
git commit -m "feat: integrate ParticleSystem into all spell visuals"
```

---

### Task 6: Visual QA & Manual Testing

**Files:** None (no code changes — testing only)

- [ ] **Step 1: Start dev server**

Run: `npx vite dev`

- [ ] **Step 2: Test each spell visually**

Play the game and cast each spell. Verify:
- **Inferno (Chili+Chili):** Red burst explodes outward, embers flicker and rise
- **Tidal Wave (Bottle+Bottle):** Blue burst, blue mist rises gently
- **Fortress (Salt+Salt):** Gray square particles burst upward (hemisphere), salt chunks float up from dome area
- **Steam (Chili+Bottle):** Purple burst, fast-rising steam particles
- **Meteor (Chili+Salt):** Orange square particles burst upward with jitter shake, rock fragments rise from impact
- **Mud (Bottle+Salt):** Brown burst, slow heavy bubbles barely rise

- [ ] **Step 3: Verify no ghost particles**

After each spell expires, confirm no dots remain on screen. Wait a few seconds after each spell to be sure.

- [ ] **Step 4: Check performance**

Cast multiple spells in quick succession. Confirm no frame rate drops or visual glitches. 125 particles per spell * ~3 spells active = ~375 particles max — should be fine.
