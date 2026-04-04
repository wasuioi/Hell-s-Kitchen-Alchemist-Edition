# Particle System Design — Spell Cast VFX

## Overview

A two-layered particle system for spell casting in Hell's Kitchen: Alchemist Edition. Each spell gets a **Burst** (explosive one-shot on cast) and a **Linger** (ambient rising particles while spell is active). Built with pure Three.js Points + useFrame — no new dependencies.

## Architecture

### New File: `src/components/ParticleSystem.tsx`

A single React component using `<points>` with one `BufferGeometry`. Receives props from `Spell.tsx`:

```tsx
<ParticleSystem
  type={spell.type}        // for texture + behavior selection
  color={SPELL_CONFIG[spell.type].color}
  duration={spell.duration}
  radius={spell.radius}    // for linger disk spawn
/>
```

All state managed via refs (no React state) to avoid re-renders.

### Modified File: `src/components/Spell.tsx`

Drop `<ParticleSystem />` inside the SpellVisual group:

```tsx
<group position={[spell.position.x, 0, spell.position.z]}>
  <ParticleSystem
    type={spell.type}
    color={SPELL_CONFIG[spell.type].color}
    duration={spell.duration}
    radius={spell.radius}
  />
  {/* Existing spell mesh/cylinder */}
</group>
```

No changes to stores, game logic, or other files.

---

## Layer 1: Burst

### Spawn (frame 0)
- 50 particles at spell position
- Random velocity: direction = random unit sphere, speed = 8-15 units/sec
- **Stone spells (Fortress, Meteor):** hemisphere only — `Math.abs(velocity.y)` so particles go up
- Lifetime: 0.3-0.5s (randomized per particle)

### Per-frame update
- `position += velocity * delta`
- **Friction:** `velocity *= 0.95` each frame (explosive start, quick deceleration)
- `age += delta`
- **Meteor jitter:** For the first 0.1s, add small random velocity perturbation each frame for a "shake" effect
- **Color flicker:** Interpolate White (age=0) -> Spell Color (age=0.5*lifetime) -> Dark (age=lifetime)
  - Fire particles: slight RGB oscillation for ember flicker
- **Opacity:** `1 - (age / lifetime)`

### Death cleanup
- When `age > lifetime`: position = (0, -999, 0), size = 0, velocity = 0
- No ghost dots on screen

---

## Layer 2: Linger

### Spawning (continuous)
- Every 0.2 seconds, spawn 5 new particles
- Spawn position: random point on a **2D disk** (not sphere) within spell radius
  - `angle = Math.random() * Math.PI * 2`
  - `distance = Math.sqrt(Math.random()) * spellRadius`
  - `x = cos(angle) * distance`, `z = sin(angle) * distance`, `y = 0`
- Continues until spell duration ends; remaining particles fade out naturally
- Max buffer: ~75 particles

### Per-particle behavior
- Upward drift (Y-velocity varies by spell — see table below)
- Slight horizontal drift: x/z = +/-0.3 units/sec
- Lifetime: 0.8-1.2s per particle
- **Fade-in:** Opacity 0 -> 1 over first 0.1s, then fade out normally
- Death cleanup: same as burst (y = -999, size = 0)

### Per-spell linger config

| Spell | Y-Speed | Vibe |
|-------|---------|------|
| Inferno (Chili+Chili) | 1.5 | Flickering embers |
| Tidal Wave (Bottle+Bottle) | 1.0 | Rising mist |
| Fortress (Salt+Salt) | 0.8 | Floating salt chunks |
| Steam (Chili+Bottle) | 2.5 | Fast rising steam |
| Meteor (Chili+Salt) | 1.0 | Hot rock fragments |
| Mud (Bottle+Salt) | 0.5 | Slow heavy bubbles |

---

## Textures & Material

### Two canvas-generated textures (32x32 px, created once at module level)

1. **Soft circle** — radial gradient, white center to transparent edge
   - Used by: Inferno, Tidal Wave, Steam, Mud

2. **Square** — filled square with `shadowBlur` for soft glowing edges
   - Used by: Fortress, Meteor

### PointsMaterial config
- `map`: circle or square texture based on spell type
- `vertexColors: true` — per-particle color (for white->spell->dark flicker)
- `transparent: true`
- `depthWrite: false` — prevents clipping/box artifacts between particles
- `sizeAttenuation: true` — particles shrink with distance
- `blending: THREE.AdditiveBlending` — glowy magical feel
- `texture.minFilter = THREE.LinearFilter` — clean filtering

### Particle sizes
- Burst: 0.3-0.6 units (randomized)
- Linger: 0.15-0.3 units (smaller, subtler)

---

## Per-Spell Summary

| Spell | Color | Texture | Burst Direction | Linger Y | Special |
|-------|-------|---------|----------------|----------|---------|
| Inferno | Red/Orange | Circle | Full sphere | 1.5 | RGB flicker on fire particles |
| Tidal Wave | Blue | Circle | Full sphere | 1.0 | — |
| Fortress | Gray/White | Square | Hemisphere (up) | 0.8 | — |
| Steam | Light Blue | Circle | Full sphere | 2.5 | — |
| Meteor | Orange/Brown | Square | Hemisphere (up) | 1.0 | Jitter first 0.1s |
| Mud | Brown/Green | Circle | Full sphere | 0.5 | — |

---

## Buffer Layout

Single Float32Array per attribute, sized for `BURST_COUNT + MAX_LINGER`:
- `position`: Float32Array(particles * 3)
- `velocity`: Float32Array(particles * 3) — stored in ref, not a buffer attribute
- `color`: Float32Array(particles * 3) — RGB per particle
- `size`: Float32Array(particles)
- `age`: Float32Array(particles) — stored in ref
- `lifetime`: Float32Array(particles) — stored in ref

Total max particles: 50 (burst) + 75 (linger) = 125 per spell instance.

---

## Non-goals

- No audio integration (separate improvement)
- No screen shake or camera effects (burst only)
- No interaction between particles and game logic (purely visual)
