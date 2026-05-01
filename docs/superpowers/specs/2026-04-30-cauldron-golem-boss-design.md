# Cauldron Golem Boss — Design

**Date:** 2026-04-30
**Status:** Pending review
**Scope:** Visual rework only (option A from brainstorm). No new mechanics — keep existing HP, attack timing, slime spawn, victory conditions untouched.

## Goal

Replace the placeholder boss (red sphere with cartoon face built from primitive geometry in `src/components/Boss.tsx`) with a **Cauldron Golem**: a dark-fantasy stone golem with a kitchen identity. Rename and re-skin the three boss attacks so their visuals match the new identity. No changes to attack mechanics, damage, timing, or HP.

## Background

Current boss (`src/components/Boss.tsx`):
- Visual: `sphereGeometry args={[1.5]}` body + face built from inline mesh primitives (eyes, mouth, fangs)
- 3 attacks rotating in fixed order, 5s pause between, 2s telegraph each:
  - `heat_wave` — radial blast 6m radius, 25 dmg + knockback
  - `salt_rain` — 3-5 ground circles around player, 0.8s pillar rise, 20 dmg
  - `deep_soak` — single rotating beam from boss centre, 3s sweep, 5 dmg/s + soaked status
- Spawns one `slow` enemy from a random arena edge every 8s
- HP multiplier ×15 (`HP_MULTIPLIER` in `src/stores/enemyStore.ts`)

Project already loads `.gltf` rigged models for Player and Slime via `useGLTF` from `@react-three/drei`. Pattern is established — the boss switches to the same approach.

## Visual: Cauldron Golem

### Model

- **File:** `public/models/boss/boss.glb` (already in place, ~14MB)
- **Format:** glTF 2.0 binary, 31 bones, 1 mesh named `input`, skin named `metarig`, **no animations**
- **Rig convention:** Rigify (Blender) — `.L` / `.R` suffixes
- **Loading:** `useGLTF('/models/boss/boss.glb')` + `useGLTF.preload(...)` at module scope, matching the pattern in `Player.tsx:301` and `Enemy.tsx:464`

### Identity (defined by the model)

The model is a kitchen-themed stone golem:
- **Body:** stone oven blocks + dark bricks
- **Chest:** embedded cauldron with glowing molten core (the `breast.L` / `breast.R` bones land in this region)
- **Head:** inverted mortar with two glowing eyes; pestle / knife "fangs" around the rim
- **Arms:** pestle-stone forearms, brick fists
- **Legs (asymmetric):** one charred green vegetable, one large animal bone with smoked-meat scraps
- **Cracks:** orange-glowing fissures across the body, implying internal heat from the cauldron core

The original red-sphere body and face primitives in `Boss.tsx:218-260` are deleted. The model carries all of the visual identity.

### Scale and placement

- The current sphere body sits at `y = 1.5` (centre) with radius 1.5 → top at y=3
- Target visual size for the golem: roughly the same total height (~3 units) so existing arena and camera framing still work
- The model's local origin is at the rig `Root` (likely at the feet). Render with `position={[boss.position.x, 0, boss.position.z]}` and apply a uniform `scale` chosen to hit ~3 units tall — final scale will be picked during implementation by visual eyeballing in the dev panel.

### Rig-driven idle and facing

- **Facing the player:** rotate the `face` bone (child of `spine.006`) on its Y axis so the head turns toward the player every frame, replacing the current `faceGroupRef` Y rotation in `Boss.tsx:64-70`. If turning the head alone reads weakly, also rotate `spine.001` slightly so the upper torso follows.
- **Idle breathing (subtle):** in `useFrame`, apply `Math.sin(t * 0.8) * 0.05` to `spine.003.rotation.x` so the chest rocks gently. Optional polish — can be skipped on first pass.

## Attacks

The three attacks keep their existing timing, damage, and damage geometry (radii, durations, telegraph length, attack-order rotation). Only the **internal name (`AttackType`)**, **VFX**, and **bone-driven animation** change.

### Attack rename table

| Old name | New name | Damage geometry (unchanged) | New visual |
|---|---|---|---|
| `heat_wave` | `stone_slam` | 2s telegraph (red ring), then 6m radial blast around boss, 25 dmg + 4-unit knockback | Both arms rear up, slam down on telegraph end. Telegraph ring colour shifts from red → dust-brown. Blast effect: expanding brown dust shockwave + radiating ground cracks (`GroundCracks` already exists in the project) instead of orange fire disc. |
| `salt_rain` | `stone_spikes` | 3-5 telegraphed circles within 6 units of player position, 0.8s rise, 20 dmg if player still inside circle | Telegraph circles: orange-glowing (matching the body cracks). Rising "pillars" become **stone spikes** — narrower box geometry (0.4 wide, taller, sharper top) with `#3f3f3f` base + `#fb923c` emissive lines at the cracks. Drop the grey `#a8a29e` salt look. |
| `deep_soak` | `hand_lance` | 3s rotating beam, 5 dmg/s + `soaked` status, hitbox at midpoint of beam | **Both arms** extend outward in opposite directions (`upper_arm.L` / `upper_arm.R` rotated to horizontal, `forearm.L/R` straightened). A blue water laser fires from each hand outward, 6m long. Both arms rotate in **sync** around the boss centre like helicopter blades. |

### Mechanic invariants (do not change)

- Pause between attacks: 5s (`PAUSE_BETWEEN`)
- Telegraph duration: 2s (`TELEGRAPH_DURATION`)
- Soak duration: 3s (`SOAK_DURATION`)
- Attack order: rotates `[stone_slam, stone_spikes, hand_lance]` by index
- Damage values: 25 / 20 / 5-per-sec
- Slime spawn: every 8s, type `slow`, edge spawn (`getEdgeSpawnPosition`)

### `hand_lance` geometry and damage

The two beams behave as **independent helicopter blades** anchored to a rotating parent group at the boss centre, NOT a single line through the boss.

- Each beam: `boxGeometry args={[0.6, 0.4, 6]}`, 6m long
- Positioned in group-local space at `[+3, 0.3, 0]` and `[-3, 0.3, 0]` (i.e. each beam's centre is 3m from boss centre, so the beam itself extends from the boss surface outward to 6m on each side — there is no beam piece passing through the boss body)
- Parent group rotates on Y at the existing `1.5 rad/s` rate (`beamAngle.current += delta * 1.5`)
- Result: visually two arms, each holding a laser of its own, sweeping together

**Damage rule:** the original `deep_soak` deals damage when the player is within 2 units of the beam midpoint (4m from boss). For the two-beam version, the midpoint of each beam in world space is 3m out from the boss along the beam's direction. If the player is within 2 units of **either** midpoint → 5 dmg/s + `soaked`, clamped to one tick per second regardless of how many beams overlap (no double damage). This is a small generalisation of the existing single-midpoint check, not a balance change in practice (a player can only stand near one beam at a time given the 6m separation between midpoints).

**Dodge:** safe arc is 90° offset from the beam line. Player strafes around the boss in the same rotational direction as the beams to keep that offset. Same dodge difficulty as the current single beam.

### `hand_lance` visual

- Material: `#3b82f6` water-blue with emissive — unchanged from current beam
- Hand bones (`hand.L`, `hand.R`) animated to extend outward via parent-arm bone rotation — purely cosmetic alignment with the beams (the beams are NOT parented to the hand bones; they're independent meshes in the rotating group, simpler to reason about than reading bone world positions every frame)

## Implementation notes

### Bone control

`useGLTF` returns `{ scene }`. Bones are `THREE.Bone` instances inside `scene`, accessible via `scene.getObjectByName('bone_name')`. Cache references in a `useRef` map on first render (one effect, runs once per mount), then in `useFrame` read/write `bone.rotation.x/y/z` directly. Rotations are local to the bone's parent.

Bone references the implementation needs:

| Bone | Used for |
|---|---|
| `face` | Y-rotation to face player every frame |
| `upper_arm.L`, `upper_arm.R` | `stone_slam` (raise + slam Z), `hand_lance` (raise + outward Z) |
| `forearm.L`, `forearm.R` | `hand_lance` (straighten X to point hand outward) |
| `hand.L`, `hand.R` | Source positions for `hand_lance` beams (read world position, anchor beam group there) |
| `spine.003` *(optional polish)* | Idle breathing |

### Animation state

Each frame, derive bone rotations from a small set of phase-driven scalars (existing pattern in `Boss.tsx`):
- `attackPhase.current` — `idle | telegraph | attack`
- `attackPhaseTimer.current` — seconds into current phase
- `currentAttack.current` — which attack
- `slamRaiseT`, `slamFallT` — new locals for `stone_slam` arm angle interpolation (0 → 1)
- `lanceExtendT` — new local for `hand_lance` arm extension (0 → 1, eases in over the first 0.4s of the attack phase, then holds)

These compute target euler angles per bone per frame; no animation library needed (`useAnimations` skipped because there are no baked clips).

### File deltas

- `public/models/boss/boss.glb` — already added (this PR / branch).
- `src/components/Boss.tsx` — heavy rewrite of the JSX return block (model + bone refs replace the sphere/face mesh tree) and animation-driving useFrame logic. Attack timing, damage, and state machine flow are preserved. `AttackType` (the local type at line 11) is renamed `'heat_wave' | 'salt_rain' | 'deep_soak'` → `'stone_slam' | 'stone_spikes' | 'hand_lance'`. No store-level type changes (boss attacks are not stored in Zustand).
- No other files are modified.

### Preload

`useGLTF.preload('/models/boss/boss.glb')` at module scope of `Boss.tsx`, matching the established pattern in `Player.tsx:301` and `Enemy.tsx:464`. `Boss.tsx` is imported eagerly via `Scene.tsx`, so the preload fires at app mount even though the boss component itself is conditionally rendered. `src/utils/preloadAssets.ts` is image-only (uses `new Image()` to warm the texture cache); model preloads stay in their respective component files.

## Out of scope

The following were considered during brainstorming and explicitly deferred:
- Cauldron-core weak point with damage multiplier (B in scope question)
- HP-50% phase 2 with faster attacks (C in scope question)
- Replacing the spawned `slow` slimes with a kitchen-themed enemy variant
- Custom death animation / shatter effect for boss death
- Boss music change

If post-merge playtesting shows the boss reads as visually new but plays identically (and that's a problem), open a follow-up issue for B / C as a separate PR.

## Testing

Manual (browser, dev panel):
- Skip to wave 7 → boss phase entered cleanly, model visible, no console errors
- Each of the three attacks plays through telegraph → attack → idle without stalling
- Player can take damage from each attack at the expected position (radial / spike / beam)
- Boss death → victory phase as before
- Idle facing rotates head toward player

Automated:
- `src/__tests__/enemyStore.test.ts` and `gameStore.test.ts` already cover boss spawn / death / victory transitions. Run `npm run test` after `AttackType` rename to confirm no string literals broke.
- `npm run build` — TypeScript check passes (no untyped bone access)
- `npm run lint` — no new warnings

No new unit tests required: all changes are visual / animation, and the underlying state-machine code paths are unchanged.

## Open questions

None. Scope and behaviour are pinned.
