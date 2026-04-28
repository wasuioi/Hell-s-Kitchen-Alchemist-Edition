# Spell Sprite VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the procedural particle system used by spells with pixel-art sprite sheet animations from the GameFXexport pack.

**Architecture:** Add a new `SpellSprite` component that renders a billboard plane with an animated sprite sheet. Replace `<ParticleSystem>` inside `Spell.tsx` with `<SpellSprite>`. Consolidate spell color metadata into a new `spriteConfig.ts` and delete the now-unused `particleConfig.ts` and `ParticleSystem.tsx`.

**Tech Stack:** React 19, TypeScript (strict), @react-three/fiber, @react-three/drei, three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-10-spell-sprite-vfx-design.md`

---

## Task 1: Copy sprite assets into the project

Sprite sheets live in `/tmp/gamefx/GameFXexport/SPRITESHEET_Files/` (extracted from `~/Downloads/GameFXexport.rar`). We need 6 of them in `public/sprites/spells/` so Vite serves them at `/sprites/spells/...`.

**Files:**
- Create: `public/sprites/spells/FireCast_96x96.png`
- Create: `public/sprites/spells/IceCast_96x96.png`
- Create: `public/sprites/spells/MagicBarrier_64x64.png`
- Create: `public/sprites/spells/HolyExplosion_96x96.png`
- Create: `public/sprites/spells/Explosion_2_64x64.png`
- Create: `public/sprites/spells/PoisonCast_96x96.png`

- [ ] **Step 1: Verify the source files exist**

```bash
ls /tmp/gamefx/GameFXexport/SPRITESHEET_Files/FireCast_96x96.png \
   /tmp/gamefx/GameFXexport/SPRITESHEET_Files/IceCast_96x96.png \
   /tmp/gamefx/GameFXexport/SPRITESHEET_Files/MagicBarrier_64x64.png \
   /tmp/gamefx/GameFXexport/SPRITESHEET_Files/HolyExplosion_96x96.png \
   /tmp/gamefx/GameFXexport/SPRITESHEET_Files/Explosion_2_64x64.png \
   /tmp/gamefx/GameFXexport/SPRITESHEET_Files/PoisonCast_96x96.png
```

If any are missing, re-extract: `mkdir -p /tmp/gamefx && tar xf ~/Downloads/GameFXexport.rar -C /tmp/gamefx/`

- [ ] **Step 2: Create the destination directory and copy the files**

```bash
mkdir -p public/sprites/spells
cp /tmp/gamefx/GameFXexport/SPRITESHEET_Files/FireCast_96x96.png public/sprites/spells/
cp /tmp/gamefx/GameFXexport/SPRITESHEET_Files/IceCast_96x96.png public/sprites/spells/
cp /tmp/gamefx/GameFXexport/SPRITESHEET_Files/MagicBarrier_64x64.png public/sprites/spells/
cp /tmp/gamefx/GameFXexport/SPRITESHEET_Files/HolyExplosion_96x96.png public/sprites/spells/
cp /tmp/gamefx/GameFXexport/SPRITESHEET_Files/Explosion_2_64x64.png public/sprites/spells/
cp /tmp/gamefx/GameFXexport/SPRITESHEET_Files/PoisonCast_96x96.png public/sprites/spells/
```

- [ ] **Step 3: Verify all 6 files are present**

```bash
ls public/sprites/spells/
```

Expected output:
```
Explosion_2_64x64.png
FireCast_96x96.png
HolyExplosion_96x96.png
IceCast_96x96.png
MagicBarrier_64x64.png
PoisonCast_96x96.png
```

- [ ] **Step 4: Commit**

```bash
git add public/sprites/spells/
git commit -m "feat: add spell sprite sheet assets from GameFXexport pack"
```

---

## Task 2: Create `spriteConfig.ts` with the SpriteConfig type and SPRITE_CONFIGS map

This file replaces `particleConfig.ts` as the source of truth for each spell's visual identity. It contains the spell's signature color (used by dash trail and AOE disc tint) and all sprite sheet metadata.

**Files:**
- Create: `src/data/spriteConfig.ts`

- [ ] **Step 1: Create the file with type and config map**

Write to `src/data/spriteConfig.ts`:

```ts
import type { SpellType } from '../types'

export type SpriteMode = 'oneshot' | 'loop'

export interface SpriteConfig {
  /** Signature spell color — used by dash trail, AOE disc tint, etc. */
  color: string
  /** URL to the sprite sheet PNG, served from /public */
  url: string
  /** Number of animation frames in the sheet */
  frameCount: number
  /** Pixel size of each square cell */
  cellSize: number
  /** Playback speed (frames per second) */
  fps: number
  /** 'oneshot' plays once and freezes on the last frame; 'loop' wraps */
  mode: SpriteMode
  /** Billboard size in world units */
  scale: number
  /** Optional color tint applied to the sprite (multiplied) */
  tint?: string
  /** Height above ground in world units */
  yOffset: number
}

export const SPRITE_CONFIGS: Record<SpellType, SpriteConfig> = {
  INFERNO: {
    color: '#ef4444',
    url: '/sprites/spells/FireCast_96x96.png',
    frameCount: 28,
    cellSize: 96,
    fps: 56,
    mode: 'oneshot',
    scale: 10,
    yOffset: 0.5,
  },
  TIDAL_WAVE: {
    color: '#3b82f6',
    url: '/sprites/spells/IceCast_96x96.png',
    frameCount: 28,
    cellSize: 96,
    fps: 35,
    mode: 'oneshot',
    scale: 14,
    yOffset: 0.5,
  },
  FORTRESS: {
    color: '#9ca3af',
    url: '/sprites/spells/MagicBarrier_64x64.png',
    frameCount: 33,
    cellSize: 64,
    fps: 24,
    mode: 'loop',
    scale: 4.5,
    yOffset: 1.5,
  },
  STEAM: {
    color: '#a855f7',
    url: '/sprites/spells/HolyExplosion_96x96.png',
    frameCount: 28,
    cellSize: 96,
    fps: 18,
    mode: 'loop',
    scale: 9,
    tint: '#a855f7',
    yOffset: 0.8,
  },
  METEOR: {
    color: '#f97316',
    url: '/sprites/spells/Explosion_2_64x64.png',
    frameCount: 44,
    cellSize: 64,
    fps: 60,
    mode: 'oneshot',
    scale: 6,
    yOffset: 0.5,
  },
  MUD: {
    color: '#b48c50',
    url: '/sprites/spells/PoisonCast_96x96.png',
    frameCount: 40,
    cellSize: 96,
    fps: 16,
    mode: 'loop',
    scale: 8,
    tint: '#b48c50',
    yOffset: 0.3,
  },
}

/**
 * Pure function: returns the current frame index (0..frameCount-1) for a given elapsed time.
 *
 * - 'oneshot' clamps at the last frame so the sprite freezes when it finishes.
 * - 'loop' wraps with modulo so the animation repeats forever.
 *
 * Extracted as a pure function so it can be unit tested without three.js.
 */
export function computeFrameIndex(elapsed: number, config: SpriteConfig): number {
  const raw = Math.floor(elapsed * config.fps)
  if (config.mode === 'oneshot') {
    return Math.min(raw, config.frameCount - 1)
  }
  return ((raw % config.frameCount) + config.frameCount) % config.frameCount
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/spriteConfig.ts
git commit -m "feat: add spriteConfig with sprite metadata and frame computation"
```

---

## Task 3: Write tests for `spriteConfig.ts`

This replaces the old `particleConfig.test.ts`. Tests cover both the data shape and the pure `computeFrameIndex` function.

**Files:**
- Create: `src/__tests__/spriteConfig.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/spriteConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SPRITE_CONFIGS, computeFrameIndex } from '../data/spriteConfig'
import type { SpellType } from '../types'

const ALL_SPELLS: SpellType[] = ['INFERNO', 'TIDAL_WAVE', 'FORTRESS', 'STEAM', 'METEOR', 'MUD']

describe('SPRITE_CONFIGS', () => {
  it('has config for every spell type', () => {
    for (const spell of ALL_SPELLS) {
      expect(SPRITE_CONFIGS[spell]).toBeDefined()
    }
  })

  it('every config has valid required fields', () => {
    for (const spell of ALL_SPELLS) {
      const cfg = SPRITE_CONFIGS[spell]
      expect(cfg.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(cfg.url).toMatch(/^\/sprites\/spells\/.+\.png$/)
      expect(cfg.frameCount).toBeGreaterThan(0)
      expect(cfg.cellSize).toBeGreaterThan(0)
      expect(cfg.fps).toBeGreaterThan(0)
      expect(cfg.scale).toBeGreaterThan(0)
      expect(cfg.yOffset).toBeGreaterThanOrEqual(0)
      expect(['oneshot', 'loop']).toContain(cfg.mode)
      if (cfg.tint !== undefined) {
        expect(cfg.tint).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
  })

  it('long-duration spells use loop mode', () => {
    expect(SPRITE_CONFIGS.FORTRESS.mode).toBe('loop')
    expect(SPRITE_CONFIGS.STEAM.mode).toBe('loop')
    expect(SPRITE_CONFIGS.MUD.mode).toBe('loop')
  })

  it('impact spells use oneshot mode', () => {
    expect(SPRITE_CONFIGS.INFERNO.mode).toBe('oneshot')
    expect(SPRITE_CONFIGS.TIDAL_WAVE.mode).toBe('oneshot')
    expect(SPRITE_CONFIGS.METEOR.mode).toBe('oneshot')
  })
})

describe('computeFrameIndex', () => {
  const oneshot = SPRITE_CONFIGS.INFERNO  // 28 frames at 56 fps
  const loop = SPRITE_CONFIGS.FORTRESS    // 33 frames at 24 fps

  it('returns 0 at elapsed=0', () => {
    expect(computeFrameIndex(0, oneshot)).toBe(0)
    expect(computeFrameIndex(0, loop)).toBe(0)
  })

  it('advances frames over time', () => {
    // 28 frames in 0.5s → frame ~14 at 0.25s
    expect(computeFrameIndex(0.25, oneshot)).toBe(14)
  })

  it('clamps at last frame for oneshot mode', () => {
    // After 10 seconds, oneshot must stay on the last frame
    expect(computeFrameIndex(10, oneshot)).toBe(oneshot.frameCount - 1)
  })

  it('wraps around for loop mode', () => {
    // 33 frames at 24 fps = 1.375s per loop. At 1.5s we should be ~3 frames in
    const idx = computeFrameIndex(1.5, loop)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(loop.frameCount)
    // At exactly 0s into the second loop = frame 0
    expect(computeFrameIndex(33 / 24, loop)).toBe(0)
  })

  it('never returns negative or out-of-bounds frames', () => {
    for (const cfg of Object.values(SPRITE_CONFIGS)) {
      for (let t = 0; t < 5; t += 0.05) {
        const idx = computeFrameIndex(t, cfg)
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(cfg.frameCount)
      }
    }
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- spriteConfig
```

Expected: all tests pass. (We already wrote the implementation in Task 2, so this is a verification step rather than red-then-green.)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/spriteConfig.test.ts
git commit -m "test: add tests for spriteConfig data and computeFrameIndex"
```

---

## Task 4: Create the `SpellSprite` component

Renders a billboard plane that plays a sprite sheet animation. Drop-in replacement for `<ParticleSystem>`.

**Files:**
- Create: `src/components/SpellSprite.tsx`

- [ ] **Step 1: Write the component**

Write to `src/components/SpellSprite.tsx`:

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { SpellType } from '../types'
import { SPRITE_CONFIGS, computeFrameIndex } from '../data/spriteConfig'

interface SpellSpriteProps {
  type: SpellType
  duration: number
  radius: number
}

/**
 * Animated billboard sprite for spell visual effects.
 *
 * Renders a sprite sheet as a billboard plane (always faces the camera).
 * The sprite advances through its frames based on the elapsed time since
 * mount. One-shot sprites freeze on the last frame; loop sprites wrap.
 *
 * The `radius` prop is currently unused but accepted for symmetry with
 * the old ParticleSystem signature so callers don't change the prop list.
 */
export default function SpellSprite({ type, duration: _duration, radius: _radius }: SpellSpriteProps) {
  const config = SPRITE_CONFIGS[type]
  const texture = useTexture(config.url)
  const elapsed = useRef(0)
  const spriteRef = useRef<THREE.Sprite>(null)

  // Configure texture for sprite sheet playback (set once on first render).
  // Each frame is 1/frameCount of the sheet width.
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.repeat.set(1 / config.frameCount, 1)

  useFrame((_, delta) => {
    elapsed.current += delta
    const frame = computeFrameIndex(elapsed.current, config)
    texture.offset.x = frame / config.frameCount
  })

  const tintColor = config.tint ?? '#ffffff'

  return (
    <sprite ref={spriteRef} position={[0, config.yOffset, 0]} scale={[config.scale, config.scale, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color={tintColor}
      />
    </sprite>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SpellSprite.tsx
git commit -m "feat: add SpellSprite billboard component for sprite sheet VFX"
```

---

## Task 5: Update `castSpell.ts` to read color from `spriteConfig`

The dash trail color comes from `PARTICLE_CONFIG[spellType].color`. Switch to `SPRITE_CONFIGS[spellType].color` so we can delete `particleConfig.ts`.

**Files:**
- Modify: `src/utils/castSpell.ts`

- [ ] **Step 1: Update the import**

In `src/utils/castSpell.ts`, replace:

```ts
import { PARTICLE_CONFIG } from '../data/particleConfig'
```

with:

```ts
import { SPRITE_CONFIGS } from '../data/spriteConfig'
```

- [ ] **Step 2: Update the call site**

In `src/utils/castSpell.ts`, replace:

```ts
;(window as any).__setLastSpellColor?.(PARTICLE_CONFIG[spellType].color)
```

with:

```ts
;(window as any).__setLastSpellColor?.(SPRITE_CONFIGS[spellType].color)
```

- [ ] **Step 3: Verify TypeScript compiles and tests still pass**

```bash
npx tsc --noEmit
npm run test
```

Expected: no errors. The old `particleConfig.test.ts` will still pass because `particleConfig.ts` hasn't been deleted yet.

- [ ] **Step 4: Commit**

```bash
git add src/utils/castSpell.ts
git commit -m "refactor: read spell color from spriteConfig in castSpell"
```

---

## Task 6: Replace `ParticleSystem` with `SpellSprite` in `Spell.tsx`

Swap each `<ParticleSystem>` for `<SpellSprite>`, switch the color import to `SPRITE_CONFIGS`, and remove the FORTRESS dome mesh (the MagicBarrier sprite is the visual now). Keep the dome ring on the ground as a floor indicator. Damage logic, screen shake, hit freeze, screen flash, and ground cracks stay completely unchanged.

**Files:**
- Modify: `src/components/Spell.tsx`

- [ ] **Step 1: Update imports**

In `src/components/Spell.tsx`, replace these two imports:

```ts
import { PARTICLE_CONFIG } from '../data/particleConfig'
import ParticleSystem from './ParticleSystem'
```

with:

```ts
import { SPRITE_CONFIGS } from '../data/spriteConfig'
import SpellSprite from './SpellSprite'
```

- [ ] **Step 2: Update the color lookup**

Find the line near the bottom of `SpellVisual`:

```ts
const color = PARTICLE_CONFIG[spell.type].color
```

Replace with:

```ts
const color = SPRITE_CONFIGS[spell.type].color
```

- [ ] **Step 3: Replace ParticleSystem in the METEOR branch**

In the `if (isMeteor)` return, replace:

```tsx
<group position={[spell.position.x, 0, spell.position.z]}>
  <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
</group>
```

with:

```tsx
<group position={[spell.position.x, 0, spell.position.z]}>
  <SpellSprite type={spell.type} duration={spell.duration} radius={spell.radius} />
</group>
```

- [ ] **Step 4: Replace the FORTRESS branch (drop the dome, keep the ring)**

In the `if (spell.type === 'FORTRESS')` return, replace the entire block:

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

with:

```tsx
if (spell.type === 'FORTRESS') {
  return (
    <group>
      <group ref={meshRef as any} position={[spell.position.x, 0, spell.position.z]} scale={[0, 1, 0]}>
        {/* Floor indicator ring (dome replaced by sprite) */}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[spell.radius - 0.15, spell.radius, 48]} />
          <meshStandardMaterial color="#a8d8ea" transparent opacity={0.5} emissive="#a8d8ea" emissiveIntensity={0.5} />
        </mesh>
      </group>
      <group position={[spell.position.x, 0, spell.position.z]}>
        <SpellSprite type={spell.type} duration={spell.duration} radius={spell.radius} />
      </group>
    </group>
  )
}
```

- [ ] **Step 5: Replace ParticleSystem in the default branch**

In the final `return` (the disc spells: INFERNO, TIDAL_WAVE, STEAM, MUD), replace:

```tsx
<group position={[spell.position.x, 0, spell.position.z]}>
  <ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />
</group>
```

with:

```tsx
<group position={[spell.position.x, 0, spell.position.z]}>
  <SpellSprite type={spell.type} duration={spell.duration} radius={spell.radius} />
</group>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. (THREE is still imported and used for `THREE.MeshStandardMaterial` in the damage logic — leave the import alone.)

- [ ] **Step 7: Run all tests to make sure nothing regressed**

```bash
npm run test
```

Expected: all tests pass. The old `particleConfig.test.ts` is still around and still passing.

- [ ] **Step 8: Commit**

```bash
git add src/components/Spell.tsx
git commit -m "feat: replace ParticleSystem with SpellSprite in Spell.tsx"
```

---

## Task 7: Delete the now-unused `particleConfig.ts`, `ParticleSystem.tsx`, and the old test

Nothing references these files anymore. Delete them.

**Files:**
- Delete: `src/data/particleConfig.ts`
- Delete: `src/components/ParticleSystem.tsx`
- Delete: `src/__tests__/particleConfig.test.ts`

- [ ] **Step 1: Confirm nothing imports them**

```bash
npx grep -r "particleConfig\|ParticleSystem" src/ --include="*.ts" --include="*.tsx"
```

If you don't have `npx grep`, use:

```bash
grep -rn "particleConfig\|ParticleSystem" src/
```

Expected: no results inside `src/` (the matches in `docs/` are fine — those are old plan/spec documents and we leave them as historical record).

- [ ] **Step 2: Delete the files**

```bash
rm src/data/particleConfig.ts
rm src/components/ParticleSystem.tsx
rm src/__tests__/particleConfig.test.ts
```

- [ ] **Step 3: Verify TypeScript compiles and tests pass**

```bash
npx tsc --noEmit
npm run test
```

Expected: no errors, all remaining tests pass.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -u src/data/particleConfig.ts src/components/ParticleSystem.tsx src/__tests__/particleConfig.test.ts
git commit -m "chore: remove old particle system replaced by SpellSprite"
```

---

## Task 8: Manual playtest verification

Sprite VFX cannot be fully validated without seeing them. Run the dev server and cast every spell.

**Files:** none

- [ ] **Step 1: Run a production build to confirm everything compiles end-to-end**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

- [ ] **Step 3: Cast every spell and verify the visual**

Start a game and cast each spell once. For each, confirm:

| Spell | Recipe | Expected look |
|---|---|---|
| INFERNO | CHILI + CHILI | Orange/red fire ring expands and dissipates (one-shot) |
| TIDAL_WAVE | BOTTLE + BOTTLE | Blue ice ring expands (one-shot) |
| FORTRESS | SALT + SALT | Magic barrier sprite loops above the ring on the ground |
| STEAM | BOTTLE + CHILI | Cloudy white sprite tinted purple, looping |
| METEOR | CHILI + SALT | Big impact sprite plays at the meteor target |
| MUD | BOTTLE + SALT | Green poison sprite tinted brown, looping |

For each spell, also confirm:
- The colored AOE disc on the ground is still visible (gameplay clarity)
- The sprite is sized appropriately to the AOE
- The sprite always faces the camera (billboard works)
- No console errors

- [ ] **Step 4: If any spell looks wrong, tune `spriteConfig.ts`**

Common adjustments:
- Sprite too small/large → adjust `scale`
- Sprite too high/low → adjust `yOffset`
- Sprite plays too fast/slow → adjust `fps`
- Tint too strong → change `tint` value or remove

Make the change, save, the dev server will hot-reload, recast the spell to see the result. When happy, commit:

```bash
git add src/data/spriteConfig.ts
git commit -m "tune: adjust spell sprite scale/timing based on playtest"
```

(Skip this commit if no tuning was needed.)

- [ ] **Step 5: Stop the dev server (Ctrl+C) and run final checks**

```bash
npm run build
npm run lint
npm run test
```

Expected: all three succeed.

---

## Verification checklist

Before declaring done, confirm all of these:

- [ ] All 6 sprite PNGs exist in `public/sprites/spells/`
- [ ] `src/data/spriteConfig.ts` exists and exports `SPRITE_CONFIGS` + `computeFrameIndex`
- [ ] `src/__tests__/spriteConfig.test.ts` passes
- [ ] `src/components/SpellSprite.tsx` exists
- [ ] `src/components/Spell.tsx` no longer imports `ParticleSystem` or `particleConfig`
- [ ] `src/utils/castSpell.ts` no longer imports `particleConfig`
- [ ] `src/data/particleConfig.ts` is deleted
- [ ] `src/components/ParticleSystem.tsx` is deleted
- [ ] `src/__tests__/particleConfig.test.ts` is deleted
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes
- [ ] `npm run lint` passes
- [ ] Manual playtest: all 6 spells cast, sprite visible, AOE disc still shown
