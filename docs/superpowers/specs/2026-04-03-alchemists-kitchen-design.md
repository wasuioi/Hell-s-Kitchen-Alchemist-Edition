# The Alchemist's Kitchen — MVP Design Spec

## Overview

A 3D top-down rogue-like deckbuilder where the player is an alchemist in a kitchen, combining base ingredients (Chili, Bottle, Salt) in a cauldron to cast spells against waves of enemies. Tactical and deliberate pacing — every card combo matters.

**Tech Stack:** React, Three.js, React Three Fiber (R3F), Zustand

## Game Feel

- **Tactical & deliberate** — fewer enemies but tougher, card choices matter, think about combos
- **Spells auto-target** — no manual aiming. Strategy is about *which* combo, not aiming skill
- **Kitchen theme throughout** — waves are "Shifts", death is "Kitchen Closed", upgrades are "Kitchen Perks"

---

## 1. State Architecture (Zustand-First)

All game state lives in Zustand stores. R3F renders reactively from state. `useFrame()` only for movement, collisions, and VFX.

### 4 Stores

#### useGameStore — Game Flow
- `phase`: `'menu'` | `'combat'` | `'reward'` | `'boss'` | `'death'`
- `currentWave`: number
- `timeScale`: number (1.0 normal, 0.2 for death slo-mo)
- `stats`: `{ enemiesDefeated, ingredientsUsed, wavesCleared }`
- Actions: `startShift()`, `nextWave()`, `triggerDeath()`

#### useDeckStore — Cards & Cauldron
- `hand`: `Ingredient[3]` (always 3 ingredients: CHILI, BOTTLE, or SALT)
- `cauldron`: `{ slotA: Ingredient | null, slotB: Ingredient | null }`
- `activePerks`: `Perk[]` (collected this shift — **perks can stack**, same perk picked multiple times compounds the effect)
- Actions: `drawIngredient()`, `slotIngredient(index)`, `cook()`
- `cook()` looks up Recipe Matrix → returns spell type, applies perk modifiers

#### usePlayerStore — Player State
- `position`: `{ x, z }` (y is fixed for top-down)
- `rotation`: number (facing direction)
- `hp`, `maxHp`: number
- `status`: `'normal'` | `'soaked'` | `'stunned'`
- Actions: `move()`, `takeDamage()`, `heal()`

#### useEnemyStore — Enemies & Spawning
- `enemies`: `Enemy[]` (id, position, hp, type, status)
- `spawnTimer`: number
- Enemy types: `'slow'` | `'fast'` | `'tanky'`
- Boss stored as special enemy with `type: 'boss'`
- Actions: `spawnEnemy()`, `damageEnemy(id)`, `removeEnemy(id)`

### Data Flow

```
Player presses 1/2/3 or clicks card
  → useDeckStore.slotCard(index)
  → Card moves from hand to cauldron slot
  → New card drawn into hand

Both slots full → Player presses Space or clicks Cook
  → useDeckStore.cook()
  → Recipe Matrix lookup → e.g. "Steam" spell
  → Perk modifiers applied (stacked)
  → Spell spawns at player position (auto-target)
  → useFrame() checks distance to each enemy
  → Hit enemies take damage / get status effect
  → useEnemyStore.damageEnemy(id)

Enemy HP ≤ 0
  → useEnemyStore.removeEnemy(id)
  → useGameStore.stats.enemiesDefeated++

Wave end (60s elapsed OR 20 enemies defeated)
  → useGameStore.phase = 'reward'
  → Show 3 random perks → player picks 1
  → useDeckStore.activePerks.push(perk)
  → useGameStore.nextWave()
```

---

## 2. Card & Deck System

### Deck
- Infinite deck containing 3 base ingredient types:
  - `CHILI` 🌶️ — the Fire element. Spicy, explosive, deals damage
  - `BOTTLE` 🧴 — the Water element. Liquid-based, pushes and slows
  - `SALT` 🧂 — the Stone element. Solid, defensive, heavy impact
- Cards drawn randomly with equal probability

### Hand
- Always 3 cards
- When a card is slotted into the cauldron, a new card is immediately drawn

### Cauldron (2-Slot Buffer)
- Slot A fills first, then Slot B
- When both full, Cook button activates (Spacebar or click)
- Order doesn't matter: CHILI+BOTTLE = BOTTLE+CHILI

### Recipe Matrix

| Combo | Spell | Effect |
|-------|-------|--------|
| CHILI + CHILI | **Inferno** | Large fire AOE circle at player. High damage, large radius |
| BOTTLE + BOTTLE | **Tidal Wave** | Expanding water ring from player. Large knockback |
| SALT + SALT | **Fortress** | Salt walls rise around player. Blocks enemies 4s. Player shielded |
| CHILI + BOTTLE | **Steam** | Steam cloud at player. Stuns/slows all enemies in radius 3s |
| CHILI + SALT | **Meteor** | Single massive rock on nearest enemy. Highest single-target damage |
| BOTTLE + SALT | **Mud** | Mud zone at player position. Enemies inside move 50% speed for 5s |

### Controls
- **Number keys (1, 2, 3):** Slot corresponding card from hand into cauldron
- **Click card:** Same as number key — slot into cauldron
- **Spacebar or click Cook:** Trigger the recipe when both slots are full. Base cooldown: 1.5 seconds before another cook can happen
- **WASD / Arrow keys:** Move player in 3D space

---

## 3. The 3D Scene

### Arena (Kitchen Floor)
- Simple 3D plane with tiled kitchen floor texture
- 4 boundary walls (kitchen countertops/walls)
- Fixed top-down camera (~60° angle looking down)
- Camera follows player smoothly

### Player
- 3D capsule or simple humanoid model
- Faces mouse cursor or movement direction
- HP bar floats above in 3D (R3F Html component or sprite)

### Collision Detection
- Simple **distance-based checks** in `useFrame()` — no physics library
- AOE spells: `distance(enemy, spellCenter) < spellRadius`
- Meteor: `distance(enemy, impactPoint) < meteorRadius`
- Contact damage: `distance(player, enemy) < contactRadius`
- Boss telegraphs: circle-based checks on warning zones

---

## 4. Wave System ("Shifts")

### Structure
- **Combat phase:** Survive 60 seconds OR defeat 20 enemies
- **Reward phase:** Game pauses, pick 1 of 3 Kitchen Perks
- **Permadeath:** HP hits 0 → "Kitchen Closes" → restart from Wave 1

### Difficulty Scaling

| Waves | Enemy Type | Behavior |
|-------|-----------|----------|
| 1–3 | Slow Slime | Small, low HP, slow. Contact damage |
| 4–6 | Fast Slime | 2x speed, more spawns per wave |
| 7+ | Tanky Slime | Larger, 3x HP, slow. Mixed with fast slimes |

### Boss: The Hungry Golem (after Wave 7+)
- **Appearance:** 3x larger slime or giant stone oven with arms
- **HP:** 10–20x normal enemy
- **Movement:** Very slow — commands space, doesn't chase
- **Small slimes spawn during the fight** to keep pressure

#### Boss Attack Patterns (Telegraphed)

**Heat Wave (Fire):**
- Boss glows red for 2 seconds
- Red circle appears on ground around it
- Massive fire blast pushes player back

**Salt Rain (Stone):**
- 3–5 small red circles appear randomly near player
- Salt crystals fall from sky into those circles

**Deep Soak (Water):**
- Sprays water stream in straight line while rotating slowly
- Hit = Soaked (50% slow for 3 seconds)

Boss cycles through attacks with ~5s pause between each.

---

## 5. Perk System (Kitchen Perks)

### How It Works
- Curated pool of predefined perks
- After each wave, 3 random perks shown
- Player picks 1
- **Perks stack** — picking the same perk again compounds the effect (e.g., Extra Spicy ×2 = +40% fire damage)

### MVP Perk Pool

| Perk | Effect |
|------|--------|
| 🌶️ Extra Spicy | Chili spells +20% damage, smaller AOE |
| 🧊 Deep Freeze | Bottle spells stun enemies 2 seconds |
| 🪨 Heavy Salt | Salt spells push enemies 2x further |
| ⚡ Fast Prep | Cook (Spacebar) cooldown reduced by 0.5s |
| 🧪 Double Batch | 10% chance spell triggers twice |

---

## 6. UI Layer (HTML/CSS Overlay)

All UI is 2D HTML/CSS overlay on top of the 3D scene (not rendered in 3D). Only exception: player HP bar floats in 3D space.

### In-Game HUD

- **Top-left:** Wave info — "SHIFT 1 — WAVE 3/7", enemy count, timer
- **Top-right:** Active perks list with icons
- **Bottom-center:** Card hand (3 cards with [1][2][3] key hints), Cauldron (2 circle slots + "+" between them), Cook button [Space]
- **Recipe preview:** When both cauldron slots full, show resulting spell name before cooking (e.g., "= Inferno 🔥")
- Cook button grays out until both slots filled, then glows amber

### Reward Screen
- "WAVE X CLEARED!" header
- 3 perk cards laid out horizontally
- Each shows icon, name, description
- Click to select and proceed

### Death Screen — "The Final Bill"
Receipt/check themed:
- Header: "KITCHEN CLOSED" with closed sign
- Stats as receipt line items:
  - Waves Survived: X
  - Ingredients Used: Y
  - Enemies Defeated: Z
  - Best Combo: spell name × count
- "ONE MORE RUN" button (prominent)
- "Back to Menu" button (subtle)

### Death Sequence
1. `timeScale` drops to 0.2 for 2 seconds (slow motion)
2. Scene desaturates (grayscale via post-processing or light intensity change)
3. The Final Bill fades in as overlay

### Animation (Minimal for MVP)
- Card slides from hand to cauldron slot when played
- New card fades into hand
- Simple fade-in for reward and death screens
- No complex animations

---

## 7. Project Structure

```
src/
├── App.tsx                  # Root — Canvas + HUD overlay
├── stores/
│   ├── gameStore.ts         # Game phase, wave, stats, timeScale
│   ├── deckStore.ts         # Hand, cauldron, recipes, perks
│   ├── playerStore.ts       # Position, HP, status
│   └── enemyStore.ts        # Enemy list, spawning
├── components/
│   ├── Scene.tsx            # R3F Canvas wrapper
│   ├── Arena.tsx            # Kitchen floor + walls
│   ├── Player.tsx           # Player mesh + movement
│   ├── Enemy.tsx            # Single enemy mesh + AI
│   ├── EnemyManager.tsx     # Spawning logic, renders Enemy list
│   ├── Boss.tsx             # Hungry Golem + attack patterns
│   ├── Spell.tsx            # Spell effect rendering + collision
│   └── Camera.tsx           # Follow camera
├── ui/
│   ├── HUD.tsx              # Wave info, perk list
│   ├── CardHand.tsx         # 3 cards at bottom
│   ├── Cauldron.tsx         # 2 slots + cook button
│   ├── RewardScreen.tsx     # Pick-a-perk between waves
│   ├── DeathScreen.tsx      # The Final Bill
│   └── MainMenu.tsx         # Title screen
├── data/
│   ├── recipes.ts           # Recipe Matrix lookup
│   └── perks.ts             # Perk pool definitions
└── utils/
    └── collision.ts         # Distance-based hit detection
```

---

## 8. Out of Scope (Not for MVP)

- No meta-progression shop / permanent upgrades
- No high score leaderboard (best wave stored in memory only)
- No complex animations beyond simple fades and slides
- No sound/music (can be added later)
- No multiple shift/level designs
- No save/load system
