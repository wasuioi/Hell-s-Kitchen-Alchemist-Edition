# Heal System Design

## Problem

Today there is no way for the player to recover HP during a run. The only existing
heal path is the BoilingPoint perk's tier-3 effect (+2 HP per consumed Heat stack),
which most decks never see. Damage taken in early waves persists all the way to
the boss, and the player has no breathing room to recover after a tough hit.

The DevPanel exposes a "refill HP" button, but that's developer-only — players have
nothing.

## Goal

Give the player two real ways to heal during a run:

1. **Reward-screen heal card** — a tradeoff against picking a perk.
2. **Heart pickups** — small heals that drop from killed enemies, picked up by
   walking over them.

Plus a quality-of-life improvement: show the player's HP as a number in the HUD,
not just as a bar above the player's head.

## Behaviour

### A) Reward-screen heal card

After clearing a wave, the reward screen now shows **4 cards**: the existing 3
random perks **plus a fixed 4th heal card**.

- Heal card: `Heal +30 HP`, distinctive red/pink art, heart icon.
- Click → `usePlayerStore.heal(30)` + `useGameStore.nextWave()` (skips perk for
  this wave — same flow as picking a perk).
- **Disabled state**: when `hp === maxHp`, the card is shown but greyed out and
  not clickable. Tooltip / subtitle reads "HP เต็มแล้ว". The card is always
  visible so the layout is consistent and the option is always discoverable.
- The Reroll button rerolls only the 3 perk cards. The heal card is fixed.
- Skip still skips the entire reward (heal card included).

### B) Heart pickups

When a non-boss enemy dies, an **8% chance** rolls to spawn a heart pickup at the
enemy's position.

- Single heart type: `+10 HP`.
- The heart is a 3D object (red glowing sphere/box, gentle bob + slow rotation
  for visual life) sitting on the ground.
- **Auto-pickup**: every frame, if the player's position is within `1.0` world
  unit of a heart, the heart is consumed → `usePlayerStore.heal(10)` → heart is
  removed.
- Hearts have **no lifetime** during a wave (they persist until picked up).
- Hearts are **cleared at wave end** (when `gameStore.completeWave()` fires) so
  they don't carry over into the reward screen / next wave.
- Healing while at full HP still consumes the heart (the heal call is clamped to
  `maxHp` already — no special-case logic).

### C) HP number in HUD

Top-left HUD info box currently shows `SHIFT 1 — WAVE x/7` and `Enemies defeated: n`.
Add a third line under it:

- `❤️ HP: 75 / 100`
- Number color matches the existing player-bar logic:
  - `hp / maxHp > 0.5` → green (`#22c55e`)
  - `0.2 < hp / maxHp ≤ 0.5` → yellow (`#fcd34d`)
  - `hp / maxHp ≤ 0.2` → red (`#ef4444`)
- The existing HP bar above the player's head in `Player.tsx` stays unchanged.

## State change

### New: `pickupStore.ts`

```ts
interface HeartPickup {
  id: string
  position: Position
  spawnedAt: number
}

interface PickupState {
  hearts: HeartPickup[]
  spawn: (pos: Position) => void
  remove: (id: string) => void
  reset: () => void
}
```

A tiny store, mirroring the shape of `vfxStore` / `hazardStore`. No tier logic,
no per-heart variants in v1.

### `enemyStore.setEnemyDying`

Single chokepoint for all enemy deaths (spell hits, collision damage, exploder
chains all go through this). Add a roll inside the action:

```ts
setEnemyDying: (id) => set((s) => {
  const enemy = s.enemies.find((e) => e.id === id)
  if (enemy && enemy.type !== 'boss' && Math.random() < HEART_DROP_CHANCE) {
    usePickupStore.getState().spawn(enemy.position)
  }
  return { enemies: s.enemies.map((e) => e.id === id ? { ...e, dying: true } : e) }
})
```

Constant: `HEART_DROP_CHANCE = 0.08` exported from `pickupStore.ts` (small enough
to live next to its consumers; no new `data/` file needed).

### `gameStore.completeWave`

Append `usePickupStore.getState().reset()` to clear hearts on wave clear. Same
for `gameStore.reset()` so a new run starts fresh.

### `playerStore` — no change

`heal(amount)` already clamps to `maxHp`. No new actions needed.

## Visual

### Heart pickup (in-world)

`src/components/HeartPickup.tsx`:

- Geometry: small box or sphere (`scale ~0.4`), red emissive material
  (`emissive: '#ff3355'`, `emissiveIntensity: 1.5`).
- Position: at `pickup.position.x, 0.6, pickup.position.z` (slightly above ground).
- Animation in `useFrame`:
  - Bob: `y = 0.6 + Math.sin(t * 3) * 0.15`
  - Rotate: `rotation.y += dt * 1.2`
- A small additive sprite halo underneath if `/vfx/heart_pickup_idle.png` exists
  (optional later upgrade — not blocking v1).

### Reward heal card

In `src/ui/RewardScreen.tsx`, render after the 3 perk cards in the same flex row.
Implement as **inline JSX** inside `RewardScreen.tsx`, not as a new component file
— it's a single use, and matching the existing `PerkCard` width (`CARD_WIDTH_PX *
CARD_SCALE`) is a one-liner. Distinctive red/pink colour palette, heart emoji as
the icon for v1 (swappable for `/icons/heart_pickup.png` once that asset lands).

### HUD line

Add to the existing top-left info box in `src/ui/HUD.tsx`:

```tsx
<div style={{ fontSize: '12px', marginTop: '2px' }}>
  <span>❤️ HP: </span>
  <span style={{ color: hpColor(hp / maxHp), fontWeight: 'bold' }}>
    {hp} / {maxHp}
  </span>
</div>
```

Where `hpColor(ratio)` is the green/yellow/red threshold function described above.

## Pickup collision loop

`src/components/HeartPickupManager.tsx`:

- Renders one `<HeartPickup>` per active heart.
- One `useFrame` callback runs the collision check for every heart against the
  player position. Picked-up hearts are removed from the store immediately and
  the player is healed.
- Pickup radius: `1.0` world units (player visual radius is ~0.5, so this gives
  a forgiving grab range without making hearts magnet-grab from far away).

The manager mounts inside the existing `<Canvas>` tree in `App.tsx` alongside
`EnemyManager` / `HazardManager`.

## Files touched

| File | Change |
|---|---|
| `src/stores/pickupStore.ts` | **NEW** — heart list + spawn/remove/reset actions. |
| `src/components/HeartPickup.tsx` | **NEW** — single in-world heart visual + bob/rotate animation. |
| `src/components/HeartPickupManager.tsx` | **NEW** — renders all hearts + per-frame collision check. |
| `src/stores/enemyStore.ts` | Hook `Math.random() < 0.08` heart spawn into `setEnemyDying`, gated to `enemy.type !== 'boss'`. |
| `src/stores/gameStore.ts` | Call `pickupStore.reset()` in `completeWave` and `reset`. |
| `src/ui/RewardScreen.tsx` | Add the 4th heal card (disabled when at full HP); pick handler heals + advances wave. |
| `src/ui/HUD.tsx` | Add HP number line in the top-left info box with threshold colour. |
| `src/App.tsx` | Mount `<HeartPickupManager />` inside the Canvas. |
| `src/__tests__/healSystem.test.ts` | **NEW** — unit tests (see below). |

## Testing

Single test file `src/__tests__/healSystem.test.ts`. Each test resets the relevant
stores in `beforeEach`.

- **pickupStore basics**: `spawn` adds, `remove` removes, `reset` empties.
- **Drop roll**: stub `Math.random` to `0.05` → calling `setEnemyDying` on a
  non-boss enemy spawns a heart at its position. Stub to `0.99` → no spawn.
- **Boss exclusion**: stub `Math.random` to `0.0` → `setEnemyDying` on a `boss`
  enemy does NOT spawn a heart.
- **Auto-clear**: `gameStore.completeWave()` empties `pickupStore.hearts`.
- **Reward heal card disabled at full HP**: render `RewardScreen` with
  `playerStore.hp === playerStore.maxHp` → heal button has `disabled` attribute /
  `aria-disabled`. Click → no state change.
- **Reward heal card pick**: set `hp = 50`, click heal → `hp` becomes `80`,
  `gameStore.phase` becomes `'combat'`, `currentWave` advances.
- **HP HUD format**: render `HUD` with `hp = 75, maxHp = 100` → DOM contains
  `75 / 100`. (Colour is style-only, not asserted.)

Pickup collision (radius check) lives inside a `useFrame` callback — out of scope
for unit tests; verified manually in the dev server.

Run `npm run test` + `npm run build` + `npm run lint` before committing.

## Out of scope

- Different heart sizes / rarity (small/large hearts).
- Heart-drop perks (e.g. "drop rate +50%", "hearts heal +5 more").
- Pity drop (drop-rate scaling on low HP).
- Sound effects on pickup.
- Animated pickup VFX flash on the player when consumed.
- Heart aggro (enemies pathing toward hearts).
- Touch/click-to-pickup on mobile.
- Adding heart drops from hazards (only enemy deaths drop hearts in v1).
- Heal-over-time perks or healing spells.

## Open questions

- The optional `/icons/heart_pickup.png` asset — the user will add this via the
  existing `/save-icon` pipeline. The heal card and (optionally) the in-world
  heart can use this PNG once it lands. Until then, an inline emoji `❤️` works
  as a fallback.
