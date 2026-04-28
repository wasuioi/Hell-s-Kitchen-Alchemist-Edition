# Sprite Sheet VFX for Spells — Design

**Date:** 2026-04-10
**Status:** Approved

## Goal

Replace the procedural particle system used by spell effects with pixel-art sprite sheet animations from the GameFXexport pack. Each spell gets a distinct, punchy visual while keeping the AOE disc for gameplay clarity.

## Background

The current spell visual system has three layers per spell:
1. **AOE shape** — colored disc (cylinder geometry) on the ground showing damage radius
2. **Burst particles** — explosion of particles at cast time
3. **Linger particles** — rising fading particles during spell duration

Layers 2 and 3 are produced by `src/components/ParticleSystem.tsx`. They look generic — all spells share the same particle behavior with only color variations, making it hard to distinguish spells visually.

The user has the [GameFXexport pixel art FX pack](https://spiritwitchspirit.itch.io/) (free, by Spirit Witch Spirit) with 22 sprite sheets covering fire, ice, holy, poison, tornado, magic barrier, and stars. We're using 6 of them — one per spell.

## Style Direction

**Pixel art VFX in a 3D world** — billboard sprite planes that always face the camera. Inspired by Hades and Octopath Traveler. Embraces the stylistic contrast between smooth 3D models and chunky pixel effects as an intentional aesthetic choice. The plan is to try this and revisit if it doesn't feel right in-game; the system will work for any sprite sheet we swap in later.

## Asset Setup

Extract the GameFXexport pack and copy 6 sprite sheets to `public/sprites/spells/`:

| File | Used by | Sheet size | Cell | Frames |
|---|---|---|---|---|
| `FireCast_96x96.png` | INFERNO | 2688×96 | 96 | 28 |
| `IceCast_96x96.png` | TIDAL_WAVE | 2688×96 | 96 | 28 |
| `MagicBarrier_64x64.png` | FORTRESS | 2112×64 | 64 | 33 |
| `HolyExplosion_96x96.png` | STEAM | 2688×96 | 96 | 28 |
| `Explosion_2_64x64.png` | METEOR | 2816×64 | 64 | 44 |
| `PoisonCast_96x96.png` | MUD | 3840×96 | 96 | 40 |

All sheets are horizontal strips (single row). The unused 16 sprites stay available for future spells.

## New Files

### `src/data/spriteConfig.ts`

Single source of truth for spell visual identity — sprite metadata + the spell's signature color (which is also used by the dash trail and damage numbers).

```ts
import type { SpellType } from '../types';

export type SpriteMode = 'oneshot' | 'loop';

export interface SpriteConfig {
  color: string;        // signature spell color (hex) — used by dash trail, AOE disc tint, etc.
  url: string;          // path under /public
  frameCount: number;
  cellSize: number;     // pixels per frame (square)
  fps: number;          // playback speed
  mode: SpriteMode;
  scale: number;        // billboard size in world units
  tint?: string;        // optional color multiply applied to the sprite (hex)
  yOffset: number;      // height above ground
}

export const SPRITE_CONFIGS: Record<SpellType, SpriteConfig> = {
  INFERNO: {
    color: '#ef4444',
    url: '/sprites/spells/FireCast_96x96.png',
    frameCount: 28,
    cellSize: 96,
    fps: 56,            // 28 frames in ~0.5s (matches duration)
    mode: 'oneshot',
    scale: 10,
    yOffset: 0.5,
  },
  TIDAL_WAVE: {
    color: '#3b82f6',
    url: '/sprites/spells/IceCast_96x96.png',
    frameCount: 28,
    cellSize: 96,
    fps: 35,            // 28 frames in 0.8s
    mode: 'oneshot',
    scale: 14,
    yOffset: 0.5,
  },
  FORTRESS: {
    color: '#9ca3af',
    url: '/sprites/spells/MagicBarrier_64x64.png',
    frameCount: 33,
    cellSize: 64,
    fps: 24,            // loops about 3x over 4s
    mode: 'loop',
    scale: 4.5,
    yOffset: 1.5,
  },
  STEAM: {
    color: '#a855f7',
    url: '/sprites/spells/HolyExplosion_96x96.png',
    frameCount: 28,
    cellSize: 96,
    fps: 18,            // loops about 2x over 3s
    mode: 'loop',
    scale: 9,
    tint: '#a855f7',    // purple steam
    yOffset: 0.8,
  },
  METEOR: {
    color: '#f97316',
    url: '/sprites/spells/Explosion_2_64x64.png',
    frameCount: 44,
    cellSize: 64,
    fps: 60,            // 44 frames in ~0.7s (slightly longer than 0.3s spell — looks fine since damage already applied)
    mode: 'oneshot',
    scale: 6,
    yOffset: 0.5,
  },
  MUD: {
    color: '#b48c50',
    url: '/sprites/spells/PoisonCast_96x96.png',
    frameCount: 40,
    cellSize: 96,
    fps: 16,            // loops about 2x over 5s
    mode: 'loop',
    scale: 8,
    tint: '#b48c50',    // brown mud
    yOffset: 0.3,
  },
};
```

### `src/components/SpellSprite.tsx`

A billboard plane that plays a sprite sheet animation. Replaces `<ParticleSystem>` inside the spell visual.

**Approach:**
- Load texture once via `useTexture` from drei
- Set `wrapS = THREE.RepeatWrapping`, `magFilter = THREE.NearestFilter` (preserve pixel art crispness)
- Set `repeat.x = 1 / frameCount` so the texture only shows one cell at a time
- In `useFrame`, advance `offset.x` based on elapsed time and `fps`
  - one-shot: clamp at last frame
  - loop: wrap with modulo
- Render as `<sprite>` (built-in Three.js billboard) with `spriteMaterial`
  - `transparent: true`
  - `blending: AdditiveBlending` (matches existing particle look)
  - `color` set to tint if provided, else white
- Position: spell center + `yOffset`
- Scale: `[scale, scale, 1]`

**Props (mirrors current `ParticleSystem` for drop-in replacement):**
```ts
interface SpellSpriteProps {
  type: SpellType;
  duration: number;     // how long the spell lasts (used for loop-mode unmount timing)
  radius: number;       // accepted for symmetry; not used unless we later scale by AOE
}
```

The component manages its own elapsed time via `useFrame` (same pattern as `ParticleSystem` today).

## Modified Files

### `src/components/Spell.tsx`

- Replace `import ParticleSystem from './ParticleSystem'` with `import SpellSprite from './SpellSprite'`
- Replace `import { PARTICLE_CONFIG } from '../data/particleConfig'` with `import { SPRITE_CONFIGS } from '../data/spriteConfig'`
- Update `const color = PARTICLE_CONFIG[spell.type].color` → `const color = SPRITE_CONFIGS[spell.type].color`
- Replace each `<ParticleSystem type={spell.type} duration={spell.duration} radius={spell.radius} />` with `<SpellSprite type={spell.type} duration={spell.duration} radius={spell.radius} />` (in METEOR, FORTRESS, and default branches)
- For FORTRESS: remove the dome `<mesh>` (the MagicBarrier sprite IS the visual now); keep only the ground ring as a floor indicator
- Keep all damage logic, screen shake, hit freeze, screen flash, ground cracks unchanged

### `src/utils/castSpell.ts`

Replace `import { PARTICLE_CONFIG } from '../data/particleConfig'` with `import { SPRITE_CONFIGS } from '../data/spriteConfig'`. Update the dash trail color call site to read `SPRITE_CONFIGS[spell.type].color`.

## Deleted Files

- `src/components/ParticleSystem.tsx` — replaced by `SpellSprite`
- `src/data/particleConfig.ts` — color moved into `spriteConfig.ts`; all other fields (texture, burstDirection, lingerYSpeed, meteorJitter, fireFlicker) were particle-only and no longer needed
- `src/__tests__/particleConfig.test.ts` — replaced by `spriteConfig.test.ts`

## Data Flow

```
Cast spell
  → castSpell() builds SpellEffect, calls __castSpell(spell)
  → SpellManager picks it up, renders <SpellVisual>
  → <SpellVisual> renders:
      • <mesh> (AOE disc, unchanged)
      • <SpellSprite> (NEW — replaces <ParticleSystem>)
  → SpellSprite plays animation:
      • One-shot: plays once at cast time, stops on final frame
      • Loop: plays continuously until spell.duration expires
  → Damage logic continues to fire from SpellVisual.useFrame (unchanged)
```

## Testing

- **`src/__tests__/spriteConfig.test.ts`** (NEW): every `SpellType` has a config; `color` is a valid hex; `frameCount`, `cellSize`, `fps`, `scale` are all positive numbers; `mode` is `oneshot` or `loop`
- **Unit test for `SpellSprite`**: mocks `useTexture`, asserts the right number of frames advance over a fake time elapse for both modes
- **Manual playtest**: cast each of the 6 spells, confirm:
  - Sprite plays in the right place
  - One-shot spells finish without freezing on a weird frame
  - Loop spells continue throughout the spell duration
  - Tints look right for STEAM (purple) and MUD (brown)
  - No visual mismatch between sprite end and AOE disc end

## Out of Scope

- New spell types
- Per-perk visual variants
- Replacing enemy/explosion VFX (those use separate `ExplosionEffect.tsx` and stay unchanged)
- Sound effects
- Switching to flat-on-ground orientation (saved for later)
- Custom shaders (using built-in `spriteMaterial`)

## Risks

- **Sprite sheet wrap mode**: `RepeatWrapping` works on non-power-of-two textures in modern Three.js but if it fails, fall back to manual UV math via a custom shader or `MeshBasicMaterial` with cloned material per instance.
- **Tinting muddy results**: `material.color` multiplies, so tinting white-ish sprites (HolyExplosion, PoisonCast) works well. Tinting an already-colored sprite would muddy it — that's why only STEAM and MUD use tints.
- **Sprite end timing for short spells**: METEOR is a 0.3s spell but its sprite is 44 frames; at 60fps that's 0.73s. The damage already lands at cast time, so the sprite outliving the AOE disc is fine — it reads as "the impact echo".
- **Loop visual repetition**: FORTRESS loops the MagicBarrier ~3 times over 4 seconds. Players may notice the loop. Acceptable for v1; can be hidden later with subtle scale/opacity randomization if needed.

## Tuning Notes

All scales and fps values are starting points. The plan is to playtest after implementation and tune by eye. Key things to watch:
- Does the sprite scale match the AOE radius visually?
- Does the loop point feel jarring?
- Do tints feel too strong/weak?
