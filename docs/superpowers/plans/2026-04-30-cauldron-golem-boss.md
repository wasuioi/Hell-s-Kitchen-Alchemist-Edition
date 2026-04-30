# Cauldron Golem Boss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder primitive-geometry boss with the rigged Cauldron Golem `.glb` model and re-skin/rename its three attacks while preserving every existing mechanic, damage value, and timing.

**Architecture:** Single-file change to `src/components/Boss.tsx`. Load `public/models/boss/boss.glb` via `useGLTF` (matching the established Player/Enemy pattern), then drive arm and head bones each frame in the existing `useFrame` callback by reading the same state-machine refs (`attackPhase`, `currentAttack`, `attackPhaseTimer`) that already control the attack flow. No store changes, no new tests, no behaviour changes.

**Tech Stack:** React 19 + TypeScript, Three.js via `@react-three/fiber`, `@react-three/drei` `useGLTF`, Vite, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-30-cauldron-golem-boss-design.md](../specs/2026-04-30-cauldron-golem-boss-design.md)

---

## File Map

- **Modify:** `src/components/Boss.tsx` (whole-file rework — JSX return block + animation logic in `useFrame`; state-machine flow preserved)
- **Asset already in place:** `public/models/boss/boss.glb` (14MB, committed in `66dcbba`)

No other files are touched. The current grep shows no external references to `heat_wave` / `salt_rain` / `deep_soak` outside `Boss.tsx`, so renames stay local. Existing tests in `src/__tests__/enemyStore.test.ts` and `gameStore.test.ts` cover boss spawn / death / victory flow; they do not need to be modified.

---

## Verification model

Most of this work is visual. Browser-based verification via the dev panel is the primary check at each step. The verification recipe (used in every task that includes "Verify in browser"):

1. `npm run dev` (if not already running)
2. Open the game in a browser
3. Click **DEV** (bottom-left) → click **"Skip to Boss"** (or pick perks then skip waves until boss spawns)
4. Watch the specified behaviour
5. Watch the JS console — must be free of errors and warnings caused by your change

Type-check and lint gates run after every code change:
- `npm run lint` — must pass
- `npm run build` — must pass (TypeScript strict mode)
- `npm run test` — must pass (regression check; no new tests added)

---

## Task 1: Load the `.glb` model in place of the sphere body and face primitives

**Files:**
- Modify: `src/components/Boss.tsx` (whole file)

- [ ] **Step 1: Add `useGLTF` import + module-scope preload**

At the top of `src/components/Boss.tsx`, after the existing `import * as THREE from 'three'` line, add:

```tsx
import { useGLTF } from '@react-three/drei'
```

At the bottom of the file (after the `export default function Boss() { ... }` block — matching `useGLTF.preload(...)` placement in `Player.tsx:301` and `Enemy.tsx:464`), add:

```tsx
useGLTF.preload('/models/boss/boss.glb')
```

- [ ] **Step 2: Load the model inside the component**

Just under the existing `const boss = useEnemyStore((s) => s.enemies.find((e) => e.type === 'boss'))` line in `Boss.tsx:31`, add:

```tsx
const { scene } = useGLTF('/models/boss/boss.glb')
```

- [ ] **Step 3: Auto-fit the scene to a 3-unit target height**

Add a `useMemo` (import from `react`) just below the `useGLTF` call to compute a uniform scale that maps the model's bounding-box height to 3 world units. This makes the boss visually similar in size to the old sphere boss regardless of how the model was authored.

```tsx
import { useRef, useState, useMemo } from 'react'
// ...

const fittedScale = useMemo(() => {
  const bbox = new THREE.Box3().setFromObject(scene)
  const size = new THREE.Vector3()
  bbox.getSize(size)
  return size.y > 0 ? 3 / size.y : 1
}, [scene])
```

- [ ] **Step 4: Replace the sphere body + face JSX**

In the return block (currently `Boss.tsx:217-260`), delete the existing sphere body, the entire `<group ref={faceGroupRef}>` block (eyes, pupils, mouth, fangs), and the unused `faceGroupRef` declaration at the top of the component. Replace with a single `<primitive>` rendering the loaded model:

```tsx
<primitive
  object={scene}
  position={[boss.position.x, 0, boss.position.z]}
  scale={fittedScale}
/>
```

The model's local origin should be at the rig `Root` (typically at the feet), so position uses `y = 0` rather than the old `y = 1.5` centre-of-sphere offset.

Also delete the `faceGroupRef` declaration (`Boss.tsx:33`) and the `if (faceGroupRef.current) { ... }` block in `useFrame` (`Boss.tsx:64-70`). Head tracking comes back in Task 2.

- [ ] **Step 5: Verify in browser**

`npm run dev` → DEV panel → skip to boss. Expect: the Cauldron Golem mesh visible at boss spawn position, roughly 3 units tall, no console errors. Head will not face the player yet — that comes in Task 2. Telegraph rings, salt pillars, and the rotating beam should all still appear correctly because the model is purely a visual replacement at this stage.

- [ ] **Step 6: Run gates**

```bash
npm run lint
npm run build
npm run test
```

All three must pass with no new warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/Boss.tsx
git commit -m "feat(boss): load Cauldron Golem .glb in place of primitive body"
```

---

## Task 2: Make the head face the player using the `face` bone

**Files:**
- Modify: `src/components/Boss.tsx`

- [ ] **Step 1: Cache the `face` bone on first render**

Inside the component, just below the `useGLTF` line, add a `useRef` for the bone and a `useEffect` (import from `react`) that resolves it once the scene is available:

```tsx
import { useRef, useState, useMemo, useEffect } from 'react'
// ...

const faceBoneRef = useRef<THREE.Object3D | null>(null)

useEffect(() => {
  faceBoneRef.current = scene.getObjectByName('face') ?? null
}, [scene])
```

- [ ] **Step 2: Rotate the bone to face the player every frame**

Inside the existing `useFrame` callback in `Boss.tsx`, just after the early-return `if (!boss || phase !== 'boss') return`, add:

```tsx
const playerPos = usePlayerStore.getState().position
const face = faceBoneRef.current
if (face) {
  face.rotation.y = Math.atan2(
    playerPos.x - boss.position.x,
    playerPos.z - boss.position.z,
  )
}
```

(This replaces the old `faceGroupRef` rotation removed in Task 1.)

- [ ] **Step 3: Verify in browser**

Skip to boss. Move the player around the arena. Expect: the boss's head turns to follow the player on the Y axis. If the head turns but tilts the wrong way (e.g. follows X instead of Y), the bone's local axes are not aligned with world axes — try `face.rotation.x` or `face.rotation.z` instead, or apply the rotation around the bone's up vector. Pin the working axis before moving on.

- [ ] **Step 4: Run gates**

```bash
npm run lint
npm run build
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Boss.tsx
git commit -m "feat(boss): face bone tracks player on Y axis"
```

---

## Task 3: Rename `AttackType` strings

**Files:**
- Modify: `src/components/Boss.tsx`

- [ ] **Step 1: Update the type alias and order array**

`Boss.tsx:11`:

```tsx
type AttackType = 'stone_slam' | 'stone_spikes' | 'hand_lance'
```

`Boss.tsx:39`:

```tsx
const currentAttack = useRef<AttackType>('stone_slam')
```

`Boss.tsx:54`:

```tsx
const ATTACK_ORDER: AttackType[] = ['stone_slam', 'stone_spikes', 'hand_lance']
```

- [ ] **Step 2: Update every string comparison**

Replace each occurrence of the old name with the new one. There are 9 string-literal sites in `Boss.tsx`:

- `Boss.tsx:104` `'heat_wave'` → `'stone_slam'`
- `Boss.tsx:106` `'salt_rain'` → `'stone_spikes'`
- `Boss.tsx:117` `'deep_soak'` → `'hand_lance'`
- `Boss.tsx:130` `'heat_wave'` → `'stone_slam'`
- `Boss.tsx:147` `'salt_rain'` → `'stone_spikes'`
- `Boss.tsx:164` `'heat_wave'` → `'stone_slam'`
- `Boss.tsx:173` `'salt_rain'` → `'stone_spikes'`
- `Boss.tsx:182` `'deep_soak'` → `'hand_lance'`

(Plus the three already changed in steps 1–2. Use a per-string search and update every site explicitly to avoid missing one — TypeScript strict mode will flag any leftover old name as an `AttackType` mismatch.)

- [ ] **Step 3: Run gates**

```bash
npm run lint
npm run build
npm run test
```

A `npm run build` failure here means a string was missed. Find it via:

```bash
grep -n "heat_wave\|salt_rain\|deep_soak" src/components/Boss.tsx
```

The grep must return zero matches before continuing.

- [ ] **Step 4: Verify in browser**

Skip to boss. Watch a full cycle of all three attacks (about 25 seconds). Expect: each attack still plays through telegraph → attack → idle. Damage and timings unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/Boss.tsx
git commit -m "refactor(boss): rename attacks to stone_slam/stone_spikes/hand_lance"
```

---

## Task 4: Re-skin `stone_slam` and animate arms slamming

**Files:**
- Modify: `src/components/Boss.tsx`

- [ ] **Step 1: Cache the upper-arm bones**

Extend the bone-caching `useEffect` from Task 2 to also resolve `upper_arm.L` and `upper_arm.R`:

```tsx
const faceBoneRef = useRef<THREE.Object3D | null>(null)
const upperArmLRef = useRef<THREE.Object3D | null>(null)
const upperArmRRef = useRef<THREE.Object3D | null>(null)

useEffect(() => {
  faceBoneRef.current = scene.getObjectByName('face') ?? null
  upperArmLRef.current = scene.getObjectByName('upper_arm.L') ?? null
  upperArmRRef.current = scene.getObjectByName('upper_arm.R') ?? null
}, [scene])
```

- [ ] **Step 2: Drive arm rotation from the existing slam state**

The existing state machine sets `currentAttack === 'stone_slam'` during telegraph (2s, arms should rear up) and during attack (`heatBlastScale.current` rises 0 → 6 over ~0.75s, arms should snap down on the leading edge then settle).

Inside `useFrame`, after the head-tracking block and before the state-machine block, derive a `slamArmAngle` scalar from `attackPhase` + `attackPhaseTimer`:

```tsx
let slamArmAngle = 0 // 0 = rest (arms down), -1.4 ≈ raised overhead
if (currentAttack.current === 'stone_slam') {
  if (attackPhase.current === 'telegraph') {
    // Lerp 0 → -1.4 over the 2s telegraph
    const t = Math.min(attackPhaseTimer.current / TELEGRAPH_DURATION, 1)
    slamArmAngle = -1.4 * t
  } else if (attackPhase.current === 'attack') {
    // Snap down on the first 0.15s of the blast, then return to rest
    const blastT = heatBlastScale.current / 6
    if (blastT < 0.2) {
      slamArmAngle = -1.4 + 1.4 * (blastT / 0.2) // -1.4 → 0
    } else {
      slamArmAngle = 0
    }
  }
}

const upL = upperArmLRef.current
const upR = upperArmRRef.current
if (upL) upL.rotation.x = slamArmAngle
if (upR) upR.rotation.x = slamArmAngle
```

(`-1.4` rad ≈ 80° — comfortable overhead position for most humanoid rigs. If the actual rest pose has the arms in a different orientation, adjust the sign or axis during browser verification. The pattern stays the same.)

- [ ] **Step 3: Re-skin the telegraph ring (red → dust-brown)**

`Boss.tsx:262-268` — change the ring colour and the emissive colour to a dusty brown:

```tsx
{showHeatRing && (
  <mesh position={[boss.position.x, 0.05, boss.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[5.5, 6.5, 48]} />
    <meshStandardMaterial color="#a16207" transparent opacity={0.6} emissive="#78350f" emissiveIntensity={0.5} />
  </mesh>
)}
```

- [ ] **Step 4: Re-skin the blast effect (orange fire → brown dust)**

`Boss.tsx:278-305` — two stacked meshes form the blast. Change both to a dust-brown palette:

```tsx
{heatBlast && boss && (
  <mesh position={[boss.position.x, 0.3, boss.position.z]}>
    <cylinderGeometry args={[1, 1, 0.5, 32]} />
    <meshStandardMaterial
      color="#92400e"
      transparent
      opacity={Math.max(0, 1 - heatBlastScale.current / 6)}
      emissive="#78350f"
      emissiveIntensity={1.5}
    />
  </mesh>
)}
{heatBlast && boss && (
  <mesh
    position={[boss.position.x, 0.15, boss.position.z]}
    scale={[heatBlastScale.current, 1, heatBlastScale.current]}
  >
    <cylinderGeometry args={[1, 1, 0.2, 32]} />
    <meshStandardMaterial
      color="#a16207"
      transparent
      opacity={Math.max(0, 0.7 - heatBlastScale.current / 8)}
      emissive="#a16207"
      emissiveIntensity={0.6}
    />
  </mesh>
)}
```

- [ ] **Step 5: Verify in browser**

Skip to boss. Watch a full `stone_slam` cycle: arms rise during the 2s telegraph (red ring is now brown), then snap down on the blast frame, then return to rest. The blast itself is now a brown dust shockwave instead of orange fire. Damage and knockback feel identical to before.

- [ ] **Step 6: Run gates**

```bash
npm run lint
npm run build
npm run test
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Boss.tsx
git commit -m "feat(boss): stone_slam arm slam animation + brown dust shockwave"
```

---

## Task 5: Re-skin `stone_spikes` (was `salt_rain`)

**Files:**
- Modify: `src/components/Boss.tsx`

- [ ] **Step 1: Re-skin the telegraph circles (red → orange-glowing)**

`Boss.tsx:271-276` — change the circle material to match the body cracks (orange emissive). The damage circle stays the same shape and radius:

```tsx
{saltCircles.map((c, i) => (
  <mesh key={i} position={[c.x, 0.05, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
    <circleGeometry args={[1.5, 24]} />
    <meshStandardMaterial color="#fb923c" transparent opacity={0.5} emissive="#fb923c" emissiveIntensity={0.6} />
  </mesh>
))}
```

- [ ] **Step 2: Replace salt pillars with stone spikes**

`Boss.tsx:308-319` — the rising "pillars" become narrower, sharper, dark stone spikes with orange-glowing cracks. Use a `coneGeometry` with a small base radius and a tall height for a spike silhouette, with a black-grey base plus an emissive accent that reads as the same crack material as the boss body:

```tsx
{saltImpact.map((c, i) => (
  <mesh key={`impact_${i}`} position={[c.x, saltImpactTimer.current * 3, c.z]}>
    <coneGeometry args={[0.4, 2.4, 6]} />
    <meshStandardMaterial
      color="#3f3f46"
      transparent
      opacity={Math.max(0, 1 - saltImpactTimer.current / 0.8)}
      emissive="#fb923c"
      emissiveIntensity={0.7}
    />
  </mesh>
))}
```

- [ ] **Step 3: Verify in browser**

Skip to boss → wait through `stone_slam` until `stone_spikes` plays. Expect: 3-5 orange circles around the player position, then dark stone cones erupt from each circle. Player still takes 20 dmg if standing on a circle when it rises. Same number of spikes, same positions, same damage.

- [ ] **Step 4: Run gates**

```bash
npm run lint
npm run build
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Boss.tsx
git commit -m "feat(boss): stone_spikes — dark cones with orange cracks + glowing telegraph"
```

---

## Task 6: `hand_lance` — split the single beam into two sync-rotating helicopter beams

**Files:**
- Modify: `src/components/Boss.tsx`

- [ ] **Step 1: Replace the beam JSX with a rotating parent group + two beams**

`Boss.tsx:321-327` (the `{showBeam && ...}` block) — wrap two beam meshes in a rotating group anchored at the boss centre. Each beam is 6m long, positioned 3m to one side of the group origin in local space. The group `ref` replaces the existing `beamRef`.

```tsx
{showBeam && (
  <group ref={beamRef} position={[boss.position.x, 0.3, boss.position.z]}>
    <mesh position={[3, 0, 0]}>
      <boxGeometry args={[6, 0.4, 0.6]} />
      <meshStandardMaterial color="#3b82f6" transparent opacity={0.7} emissive="#3b82f6" emissiveIntensity={0.5} />
    </mesh>
    <mesh position={[-3, 0, 0]}>
      <boxGeometry args={[6, 0.4, 0.6]} />
      <meshStandardMaterial color="#3b82f6" transparent opacity={0.7} emissive="#3b82f6" emissiveIntensity={0.5} />
    </mesh>
  </group>
)}
```

Note: the `boxGeometry` arg order is `[width, height, depth]`. Since each beam now extends along **X** (not Z as before), the geometry args reflect that. Adjust `beamRef`'s typing from `THREE.Mesh` to `THREE.Group`:

```tsx
const beamRef = useRef<THREE.Group>(null)
```

- [ ] **Step 2: Update damage to test both midpoints**

`Boss.tsx:191-201` — the existing single-beam damage check uses one midpoint computed via `Math.sin(beamAngle.current) * 4` / `Math.cos(beamAngle.current) * 4`. The new midpoints sit 3m from boss along the beam line (not 4m), and there are two of them — opposite sides. The beams now extend along X in group-local space, so the world midpoint of the right-hand beam is at angle `beamAngle.current` (rotation around Y rotates X → Z), and the left-hand beam is 180° opposite.

Replace the damage block with:

```tsx
const midRX = bossPos.x + Math.cos(beamAngle.current) * 3
const midRZ = bossPos.z - Math.sin(beamAngle.current) * 3
const midLX = bossPos.x - Math.cos(beamAngle.current) * 3
const midLZ = bossPos.z + Math.sin(beamAngle.current) * 3
const playerPos = usePlayerStore.getState().position
const inRight = isInRange(playerPos, { x: midRX, z: midRZ }, 2)
const inLeft = isInRange(playerPos, { x: midLX, z: midLZ }, 2)
if (inRight || inLeft) {
  usePlayerStore.getState().setStatus('soaked')
  soakDamageTimer.current += delta
  if (soakDamageTimer.current >= 1) {
    soakDamageTimer.current = 0
    usePlayerStore.getState().takeDamage(5)
  }
}
```

(The single-tick clamp via `soakDamageTimer.current >= 1` is preserved, so a player straddling both beams still only takes 5 dmg/s — no double damage.)

- [ ] **Step 3: Verify in browser**

Skip to boss → wait until `hand_lance` plays. Expect: two blue beams 180° apart, both rotating in the same direction over the 3-second sweep. Player takes 5 dmg/s + soaked when standing in either beam at the 3m midpoint. Standing exactly between the beams (90° offset) is safe.

If the beams visibly orbit the boss in a circle but don't sweep through it (i.e. they're trailing the rotation point), the parent group's `rotation.y` is being applied somewhere it shouldn't. Check that `beamRef.current.rotation.y = beamAngle.current` is the only place setting it.

- [ ] **Step 4: Run gates**

```bash
npm run lint
npm run build
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Boss.tsx
git commit -m "feat(boss): hand_lance — two helicopter-blade beams with dual-midpoint damage"
```

---

## Task 7: `hand_lance` — animate arms extending outward to match the beams

**Files:**
- Modify: `src/components/Boss.tsx`

- [ ] **Step 1: Cache forearm and hand bones**

Extend the bone-caching `useEffect` from Task 4:

```tsx
const forearmLRef = useRef<THREE.Object3D | null>(null)
const forearmRRef = useRef<THREE.Object3D | null>(null)

useEffect(() => {
  faceBoneRef.current = scene.getObjectByName('face') ?? null
  upperArmLRef.current = scene.getObjectByName('upper_arm.L') ?? null
  upperArmRRef.current = scene.getObjectByName('upper_arm.R') ?? null
  forearmLRef.current = scene.getObjectByName('forearm.L') ?? null
  forearmRRef.current = scene.getObjectByName('forearm.R') ?? null
}, [scene])
```

- [ ] **Step 2: Drive a `lanceExtendT` scalar from the existing `hand_lance` attack timer**

Add to the same animation block in `useFrame` that already computes `slamArmAngle` (Task 4). Eases the extension over the first 0.4s of the 3s attack, holds for the rest, then snaps back to rest when the attack ends:

```tsx
let lanceExtendT = 0 // 0 = rest, 1 = fully extended
if (
  currentAttack.current === 'hand_lance' &&
  attackPhase.current === 'attack'
) {
  lanceExtendT = Math.min(attackPhaseTimer.current / 0.4, 1)
}
```

- [ ] **Step 3: Apply rotations to upper arms and forearms during the lance**

The Cauldron Golem's rest pose has both arms hanging by the side. To extend horizontally outward (T-pose-like), each upper arm rotates ~90° around its local Z axis, with opposite signs for left vs right. The forearm straightens by clearing its X-axis bend.

Append to the same animation block:

```tsx
const fL = forearmLRef.current
const fR = forearmRRef.current

// Left arm rotates +Z to point outward; right arm rotates -Z (mirror)
if (upL) upL.rotation.z = lanceExtendT * 1.5
if (upR) upR.rotation.z = lanceExtendT * -1.5
if (fL) fL.rotation.x = -lanceExtendT * 0.3 // straighten any natural elbow bend
if (fR) fR.rotation.x = -lanceExtendT * 0.3
```

(Constants `1.5` rad ≈ 86° and `0.3` rad ≈ 17° are starting values. If the resulting pose has the arms pointing wrong (e.g. straight up instead of out), the rig's local axes are oriented differently than expected. Try the X axis instead of Z, or flip the sign — the pattern stays the same.)

- [ ] **Step 4: Reset arm rotations when the lance ends**

When the attack finishes, `lanceExtendT` returns to 0 because `attackPhase.current` switches to `idle`. The same rotations multiplied by 0 give a rest pose — but only on the next frame, not retroactively. To avoid a one-frame snap visible at the transition, the existing zeroing at the start of every frame already covers this: ensure both Task 4's slam rotations and Task 7's lance rotations are written **every frame** (not gated by `if (currentAttack.current === ...)`), then only set non-zero values when the relevant attack is active.

The combined animation block at this point looks like:

```tsx
// Compute targets
let slamArmAngle = 0
if (currentAttack.current === 'stone_slam') {
  /* ... from Task 4 ... */
}

let lanceExtendT = 0
if (
  currentAttack.current === 'hand_lance' &&
  attackPhase.current === 'attack'
) {
  lanceExtendT = Math.min(attackPhaseTimer.current / 0.4, 1)
}

// Apply every frame, regardless of which attack is active
const upL = upperArmLRef.current
const upR = upperArmRRef.current
const fL = forearmLRef.current
const fR = forearmRRef.current
if (upL) {
  upL.rotation.x = slamArmAngle
  upL.rotation.z = lanceExtendT * 1.5
}
if (upR) {
  upR.rotation.x = slamArmAngle
  upR.rotation.z = lanceExtendT * -1.5
}
if (fL) fL.rotation.x = -lanceExtendT * 0.3
if (fR) fR.rotation.x = -lanceExtendT * 0.3
```

- [ ] **Step 5: Verify in browser**

Skip to boss → watch a full cycle. Expect:
- Idle: arms hang at sides, head tracks player
- `stone_slam`: arms rise during 2s telegraph, slam down on blast, return to rest
- `stone_spikes`: arms stay at rest (no arm animation for this attack)
- `hand_lance`: arms snap outward over 0.4s at attack start, hold extended for 3s while beams sweep, return to rest cleanly when attack ends — no visible jitter or one-frame snap at transitions

- [ ] **Step 6: Run gates**

```bash
npm run lint
npm run build
npm run test
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Boss.tsx
git commit -m "feat(boss): hand_lance arm extension to match helicopter beams"
```

---

## Final verification

After Task 7 commits, run the full game start-to-victory once:

- [ ] Start a new run from main menu
- [ ] Take 1–2 perks via reward screen, skip waves via DEV panel until boss spawns
- [ ] Survive a full boss fight: deal damage, take damage from each of the three attacks at least once, kill the boss
- [ ] Verify the victory screen shows
- [ ] Verify no console errors, no console warnings introduced by this branch (`@react-three/drei` will sometimes warn about disposed materials — those are pre-existing if present)

Then:

```bash
git log --oneline main..HEAD
```

Expect 7 commits (one per task) plus the initial spec/asset commit (`66dcbba`). Optionally squash-merge the visual tasks if the PR is going up as a single change, but separate commits make bisection easier if a regression appears later.

---

## Out of scope (do not implement here)

The spec defers these to follow-up PRs if playtesting indicates the boss needs more depth:

- Cauldron-core weak point with damage multiplier
- HP-50% phase 2 (faster attacks, denser slime spawns)
- Replacing the `slow` slimes with a kitchen-themed enemy variant
- Custom death animation / shatter VFX for boss
- Boss music change

If you find yourself reaching for any of these to "polish" the boss, stop and open a separate spec/plan instead.
