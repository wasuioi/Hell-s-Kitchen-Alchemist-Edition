# CLAUDE.md

## Project

Hell's Kitchen Alchemist Edition — a 3D action roguelike where you slot ingredients into a cauldron, cook spells, and fight waves of enemies + a final boss.

## Tech Stack

- React 19 + TypeScript (strict mode)
- Three.js via @react-three/fiber + @react-three/drei
- Zustand for state management (one store per domain: game, deck, player, enemy, vfx)
- Vite for dev/build
- Vitest + @testing-library/react for tests

## Commands

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + production build
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint
```

## Project Structure

```
src/
  components/   # 3D scene components (Player, Enemy, Boss, Spell, ParticleSystem,
                # ExplosionEffect, SpriteVfxEffect, etc.)
  ui/           # React UI (HUD, MainMenu, RewardScreen, DeathScreen, VictoryScreen,
                # CardHand, CauldronUI, DevPanel, PerkIcon, TierDots, TierDiff)
  stores/       # Zustand stores (gameStore, deckStore, playerStore, enemyStore, vfxStore)
  data/         # Game config (recipes.ts, perks.ts)
  utils/        # castSpell.ts, collision.ts, perkTriggers.ts, spawnVfx.ts, preloadAssets.ts
  __tests__/    # Unit tests
  types.ts      # Shared types
  App.tsx       # Main app with keyboard controls
public/
  icons/        # Per-perk icon PNGs — referenced by perk.icon = '/icons/<slug>.png'
  vfx/          # Per-perk sprite-sheet VFX (6×4 grid, 24 frames, 128×128 per cell)
.claude/
  routine-prompts/  # Canonical prompts for Claude Code Routines (see perk-ideation.md)
.github/workflows/
  save-icon.yml     # Auto-PR icon: comment "/save-icon <slug>" + attached image
  save-vfx.yml      # Auto-PR sprite sheet: comment "/save-vfx <slug>" + attached MP4
  claude.yml        # @claude mention handler
```

## Key Patterns

- **State**: Zustand stores with `create<Type>((set, get) => ({ ... }))`. Components subscribe via hooks like `useGameStore((s) => s.phase)`.
- **3D positions**: Stored as `{ x, z }` (top-down view). Y is up.
- **Game flow**: `menu` -> `combat` (7 waves) -> `reward` (between waves) -> `boss` -> `victory` / `death`
- **Spells**: Ingredients (CHILI, BOTTLE, SALT) combine via recipe matrix in `data/recipes.ts`. Perks modify spell behavior at cast time in `utils/castSpell.ts`.
- **Enemies**: Types are `slow`, `fast`, `tanky`, `boss`, `exploder`. Status effects: knocked back, stunned, soaked.

## Perk system (post-PR #22)

- **PerkDefinition** in `data/perks.ts` carries `rarity`, optional `vfxSprite` slug, and optional `tiers: [PerkTierStats, PerkTierStats, PerkTierStats]` for the 3-tier upgrade UI.
- **`MAX_PERK_TIER = 3`** — extra stacks beyond T3 still apply (typically `+x damage` per stack), but the dot indicator caps at T3 and shows `+N` for overflow.
- **`RARITY_COLOR`** maps `common | rare | epic | legendary` to gray / blue / purple / gold. Used by RewardScreen + DevPanel for card border + glow.
- **Reactive triggers** (e.g. `triggerOnDamageTaken` in `utils/perkTriggers.ts`) read stacks → tier → fire `damageEnemy` per enemy in radius + `setEnemyHitFlash` + `spawnDamageNumberVfx` + `spawnSpriteVfx(slug, x, z)` for the perk's bespoke VFX. Always check `enemy.dying || enemy.detonating` before damaging, and run the death-check loop (mark dying / queue exploder detonation / trigger boss victory) after damage so the perk doesn't leave enemies stuck at HP 0.
- **Tier diff text**: when the player would upgrade a perk they already own, the reward / dev card uses `<TierDiff>` to show `Damage 15 → 25` with the new value in red plus a `+ <new effect>` line for the gameplay added at that tier.
- **Tier-dot blink**: `<TierDots>` accepts `current` / `preview` / `hovered` — on hover the dots between current and preview blink to tease the upgrade. Static everywhere else (HUD).

## VFX system

- **Sprite-sheet VFX**: `SpriteVfxEffect.tsx` plays a 6×4 / 24-frame PNG sheet from `/vfx/<slug>.png` on a flat-on-ground plane with additive blending (pure-black source background ⇒ transparent automatically). Phase-split timing — 40% expand → 5% peak transit → 55% fade — at 0.9s total.
- **Generic explosion**: `ExplosionEffect.tsx` exposes `spawnExplosion(x, z, chainDepth)` for the existing 5 hand-coded variants (FIREBURST / SHOCKWAVE / HELLFIRE / PILLAR / SUPERNOVA) used by spells, exploders, and as the fallback when a perk doesn't define `vfxSprite`.
- **Spawn helpers in `utils/spawnVfx.ts`** (`spawnExplosionVfx`, `spawnSpriteVfx`, `spawnDamageNumberVfx`) are no-ops when `window` is undefined, so unit tests don't need to load the 3D scene.
- **Asset preload** at `utils/preloadAssets.ts` runs once on App mount, warming the browser image cache for every perk icon and `vfxSprite` so the first reward / first trigger doesn't flicker.

## Asset auto-pipelines (GitHub Actions)

- **`/save-icon <slug>`** — comment with attached PNG → workflow downloads, commits to `public/icons/<slug>.png`, opens PR.
- **`/save-vfx <slug>`** — comment with attached MP4 → ffmpeg centre-crops + tiles into 6×4 / 24-frame sprite sheet (fps adapts to source duration), commits to `public/vfx/<slug>.png`, opens PR.
- Both use the `ICON_DOWNLOAD_TOKEN` PAT secret because GitHub user-attachments require a user token (private repos).

## Dev cheat panel

- `<DevPanel>` mounts only in `import.meta.env.DEV`. Floating "DEV" button bottom-left → opens a reward-screen-style perk picker with unlimited rerolls + clear-perks. Use it to skip waves while iterating on perk balance, VFX, or UI.

## Routine prompts (canonical)

- `.claude/routine-prompts/perk-ideation.md` — paste into the "Perk ideation" Claude Code Routine at [claude.ai/code/routines](https://claude.ai/code/routines) when this file changes. The routine generates one perk issue per run, including a `## VFX assets required` section with separate slug + MP4 prompt blocks per VFX. Worked examples in the file cover all four rarities (common / rare / epic / legendary) so the routine knows what each tier should look like.

## Rules

- Keep it simple — this is a learning project
- Don't add abstractions, helpers, or "improvements" beyond what's asked
- Never swallow errors — no empty catch blocks
- Run `npm run test` after changes that touch stores, utils, or game logic
- Run `npm run lint` before committing
