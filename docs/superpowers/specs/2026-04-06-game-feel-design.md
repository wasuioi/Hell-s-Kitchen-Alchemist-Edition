# Game Feel Improvements — Design Spec

**Date**: 2026-04-06
**Goal**: Make combat feel impactful and visually exciting, add strategic depth with dash and exploder enemy.

---

## 1. Game Feel / "Juice"

### 1.1 Screen Shake

Offset the camera position with decaying random values each frame.

| Trigger | Intensity | Duration |
|---------|-----------|----------|
| Enemy hit by normal spell | 0.3 | 150ms |
| METEOR or INFERNO lands | 0.6 | 200ms |
| Player takes damage / boss attack | 1.0 | 300ms |

- Store `shakeIntensity` and `shakeEndTime` in gameStore.
- In the camera's `useFrame`, if `now < shakeEndTime`, apply random x/z offset scaled by intensity with linear decay. Otherwise, offset is zero.
- New shakes override weaker ones; same-or-stronger shakes reset the timer.

### 1.2 Hit Freeze (Time Hiccup)

On impactful spell hits (METEOR, INFERNO): set existing `timeScale` to 0.05 for 60ms, then restore to 1.0.

- Add `freezeUntil` timestamp to gameStore.
- `triggerHitFreeze(durationMs)` sets `timeScale = 0.05` and `freezeUntil = performance.now() + durationMs`.
- **CRITICAL**: `freezeUntil` must use real-world time (`performance.now()`), NOT scaled game time. If the freeze check uses `delta * timeScale`, a 60ms freeze would take ~1.2 real seconds to clear.
- In the game loop, if `performance.now() >= freezeUntil && timeScale === 0.05`, restore `timeScale = 1.0`.
- Does NOT apply to small/frequent damage — only METEOR and INFERNO.

### 1.3 Damage Numbers

Floating numbers that rise from damaged enemies and fade out.

- Use drei's `<Text>` component (renders in WebGL, not DOM) at enemy world position on damage.
- **Why not `<Html>`**: `<Html>` creates real DOM elements synced to 3D space. An INFERNO hitting 15 enemies would spawn 15 DOM elements causing layout thrashing and stuttering. `<Text>` renders directly in the WebGL canvas — no DOM overhead.
- Rise upward (y += 2 units/sec), fade opacity over 0.8s, then remove.
- Colors: white (normal), yellow (damage >= 40), red (METEOR).
- Font: bold, size ~0.5 world units, with billboard behavior (always faces camera).
- Store active damage numbers in a lightweight array (max 10, oldest removed first).

### 1.4 Enemy Hit Flash

- Add `hitFlashUntil` timestamp per enemy in enemyStore.
- On damage: set `hitFlashUntil = now + 100`.
- In Enemy component: if flashing, override material with white emissive (color=#ffffff, emissiveIntensity=2). Otherwise, use normal material.

### 1.5 Enemy Death Effect

- On death, before removing enemy from store, trigger a death sequence:
  1. Scale enemy to 1.3x over 100ms.
  2. Scale to 0 over 200ms.
  3. Spawn 8-12 particles in enemy color bursting outward (reuse ParticleSystem).
- Enemy is flagged `dying = true` during animation; dying enemies have no collision.

### 1.6 Spell Impact Enhancement

- METEOR and INFERNO only: brief white overlay on screen (opacity 0.15, 80ms fade).
- Implemented as a full-screen `<div>` in the HUD layer with pointer-events: none.
- Double the particle burst count for METEOR and INFERNO (100 burst instead of 50).

### 1.7 Meteor Ground Crack

- On METEOR impact: spawn a flat plane (y=0.01) at impact position with a radial crack texture.
- Texture: canvas-generated dark lines radiating from center on transparent background.
- 2-3 pattern variations (random rotation + variation index).
- Crack size matches METEOR radius (2 units).
- Fades out over 3.5 seconds (opacity 1.0 to 0.0), then removed from scene.
- Max 5 active cracks at once (oldest removed if exceeded).

---

## 2. Player Dash

### Mechanics

| Property | Value |
|----------|-------|
| Trigger | Shift key |
| Speed | 3x normal (24 units/sec) for 150ms |
| Cooldown | 2.5 seconds |
| I-frames | Invincible during dash |
| Soaked interaction | Dash removes soaked status |
| Stunned interaction | Cannot dash while stunned |

### Dash Direction Vector

- On dash trigger, capture a **static dash vector** locked for the full 150ms (no steering mid-dash).
- If player is moving (WASD held): dash vector = current movement direction (normalized).
- If player is stationary (no input): dash vector = direction from player's current `rotation` (i.e., where they're facing).
- Store as `dashDirection: {x, z}` — set on trigger, cleared when dash ends.

### State (playerStore)

- `isDashing: boolean` — true during the 150ms dash window.
- `dashCooldownUntil: number` — timestamp when dash becomes available again.
- `dashDirection: {x: number, z: number} | null` — locked movement vector during dash.

### Visual

- During dash, spawn 2-3 ghost afterimages (semi-transparent copies of player mesh) at positions along the dash path.
- Afterimages fade out over 300ms.
- Simple implementation: store last 3 positions during dash, render transparent meshes at those positions.

### UI

- Small dash cooldown indicator near the bottom of the HUD (a simple circular fill or bar).
- Shows remaining cooldown time.

### Collision

- While `isDashing === true`, skip all enemy-to-player damage checks.
- Player still collides with arena walls (no dashing through boundaries).

---

## 3. Exploder Enemy

### Stats

| Property | Value |
|----------|-------|
| Type key | `exploder` |
| HP | 1x base (30) |
| Speed | 3.5 |
| Scale | 0.7x |
| Color | Red/orange (#ef4444) |

### Behavior

- Moves toward player like other enemies.
- On death: enters 0.4s detonation sequence instead of dying immediately.
  1. Flash white/red rapidly (toggle every 50ms).
  2. Scale to 1.5x over the 0.4s.
  3. Explode: 3 radius AoE, 15 damage to player, 20 damage to all enemies in radius.
- Chain reaction: if explosion kills another exploder, that exploder also detonates.
- While detonating: enemy is `detonating = true`, no longer moves, still takes up space.

### Visual

- While alive: pulsing red emissive glow (sinusoidal oscillation, period ~1s).
- Detonation: rapid flash + swell (described above).
- Explosion: orange/red particle burst (reuse ParticleSystem) + expanding ring on ground + screen shake (medium, 0.6).

### Spawning

- First appears in wave 4.
- 1-2 per wave in waves 4-5, 2-3 in waves 6-7.
- Max ~30% of total wave enemies.
- Add `exploder` to the enemy type definitions and wave config.

### Strategy

- Players can herd exploders into enemy clusters for chain damage.
- METEOR on a group with exploders creates satisfying chain explosions.
- Risk/reward: letting exploders get close is dangerous but enables big plays.

---

## Non-Goals

- No new ingredients or spells in this iteration.
- No audio/sound effects (can be added later).
- No changes to boss mechanics.
- No UI redesign beyond dash cooldown indicator.

---

## File Impact Estimate

| File | Changes |
|------|---------|
| `gameStore.ts` | Add screen shake state, hit freeze state, screen flash state |
| `playerStore.ts` | Add dash state (isDashing, dashCooldownUntil) |
| `enemyStore.ts` | Add hitFlashUntil, dying, detonating per enemy; add exploder type |
| `types.ts` | Add exploder enemy type, dash-related types |
| `Player.tsx` | Dash input handling, ghost trail rendering |
| `Enemy.tsx` | Hit flash material, death animation, exploder pulsing/detonation |
| `EnemyManager.tsx` | Exploder spawn logic, chain explosion logic, death effect trigger |
| `Spell.tsx` / `SpellVisual` | Ground crack for METEOR, enhanced particles |
| `Camera` component | Screen shake offset in useFrame |
| New: `DamageNumbers.tsx` | Floating damage number component |
| New: `GroundCrack.tsx` | Meteor crack decal component |
| HUD layer | Screen flash overlay, dash cooldown indicator |
