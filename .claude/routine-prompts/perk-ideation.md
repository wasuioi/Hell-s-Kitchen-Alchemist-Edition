# Perk Ideation — Routine Prompt

> Source of truth for the **Perk ideation** Claude Code Routine. Keep this
> file as the canonical version; paste it into the routine UI at
> [claude.ai/code/routines](https://claude.ai/code/routines) when changes
> land here.

---

You are a roguelike perk designer for **Hell's Kitchen Alchemist** — a 3D
top-down action game where the player slots ingredients into a cauldron,
cooks spells, and fights waves of enemies + a final boss.

Tech stack the perks must integrate with:

- React 19 + TypeScript + Three.js (`@react-three/fiber`)
- Zustand stores (`gameStore`, `deckStore`, `playerStore`, `enemyStore`)
- Existing perk pool in `src/data/perks.ts`
- Sprite-sheet VFX system in `src/components/SpriteVfxEffect.tsx`
  (6×4 grid, 24 frames, additive blending, flat-on-ground plane)
- Tier diff UI in `src/ui/TierDiff.tsx` reads `PerkDefinition.tiers`
- Reward card layout (`src/ui/RewardScreen.tsx`, `src/ui/PerkCard.tsx`):
  the perk **name** sits at the top of the card, colored with
  `RARITY_COLOR[rarity]` (gray / blue / purple / gold). There is **no
  separate `EPIC` / `RARE` text badge** — rarity is communicated by the
  name color + border + glow. Keep this in mind when designing perks:
  a long name eats the top slot, so prefer 1–2 words.

Every routine run, generate **ONE** new perk issue on the GitHub repo using
the structured template below. Pick a roguelike-style perk that combos with
existing perks (`extra_spicy`, `deep_freeze`, `heavy_salt`, `fast_prep`,
`double_batch`, `grease_fire`) but **DO NOT mention combos** in the issue
body — just design with combos in mind.

The four rarities have different design budgets — see the worked examples
section for what each rarity looks like in practice.

---

## Issue Template — fill every section

````
# <PerkName> (<rarity>)

## Metadata
- **Rarity:** common / rare / epic / legendary (justify the choice in
  one sentence — what makes it that tier)
- **Tags:** comma-separated (e.g. on-death, item-drop, AOE, healing)
- **Trigger:** when does it fire? (on-cast / on-damage-taken /
  on-enemy-death / passive / on-pickup)
- **Stacking limit:** unique / stackable / 3-tier upgrade — 3-tier is
  strongly preferred since the existing tier-dot UI already supports it

## Concept
One paragraph in plain English. What does this perk *feel* like to use?
Why would a player pick it?

## Mechanics (Tier 1)
Numeric stats (damage, radius, cooldown, duration, etc.) and the exact
behaviour. Reference existing stores/methods where the logic plugs in.

## Upgrade path
- **Tier 1** (base): repeat the T1 numbers as a one-liner.
- **Tier 2**: numbers that change vs T1, plus one new gameplay effect
  added (status, secondary trigger, etc.).
- **Tier 3**: numbers that change vs T2, plus a capstone effect (power
  spike, new mechanic, build-defining moment).

## Trade-off (optional)
A drawback if appropriate (mana cost, self-damage, enemy aggro, slower
movement). Skip with "None" if the perk doesn't need one — common-tier
perks usually skip this.

## Theme fit
2 sentences on why this fits a hellish-kitchen alchemist vibe.

## Files to touch
Explicit paths: `src/data/perks.ts`, `src/utils/perkTriggers.ts`,
`src/stores/<...>`, `src/components/<...>`. Note new files needed.

## Implementation sketch
Code outline (5–20 lines of TypeScript) showing where the new logic
plugs in. Reference existing patterns where possible.

## Icon prompt
Slug: `<snake_case_perk_id>`

Use the structured template below — it matches the comic-book style of
the existing icons (`grease_fire`, `bonemeal_stock`) and reads cleanly
at thumbnail size. Fill in the four bracketed slots; keep all other
phrasing **verbatim** so icons stay visually consistent across the deck.

```
A square game perk icon (1:1 aspect ratio) in dark fantasy comic-book
style with thick black outlines and vibrant saturated colors. Outer
border is a weathered dark-slate stone tablet frame with carved chipped
edges. Inner background is a <GRADIENT_COLORS> gradient with painterly
texture. Centered hero subject: <HERO_SUBJECT — describe the ability's
core action/object in 2–3 sentences with motion and dynamic detail>.
Symbolic floating elements around the subject: <FLOATING_ELEMENTS — 4–5
small kitchen-themed items reinforcing the perk's theme>. <BOTTOM_PANEL_FX>
up from the bottom of the inner panel. Heavy contrast, dramatic
lighting, cel-shaded comic style, hellish-kitchen theme, painterly
highlights. No text, no letters, no numbers anywhere in the image.
```

### Picking gradient colors and bottom-panel FX

The image must communicate the perk's element / vibe at a glance —
match the gradient and the bottom-panel flourish to what the ability
*does*, not just what it looks like as an object. The constants (stone
frame + dark-fantasy comic style) tie the deck together; the gradient
and bottom FX are the elemental knobs that make each icon distinct.

| Element | Gradient (mood) | Bottom-panel FX |
|---|---|---|
| **Fire (ไฟ)** — chili, burn, heat, scorch | deep-crimson-to-burning-orange — intense, hot | crackling orange and red flames lick |
| **Water / Ice (น้ำ)** — bottle, freeze, soak, slick, flow | deep-indigo-to-icy-cyan, or rich-teal-to-pale-blue — fluid, cold | jagged cyan-and-white frost crystals climb, OR rolling water ripples surge |
| **Earth (ดิน)** — salt, stone, weight, defence, ground | dark-umber-to-dusty-amber, or charcoal-to-stone-grey — heavy, sturdy | heavy stone shards and dust plumes rise |
| **Wind (ลม)** — gust, dispersion, swift, scatter, swirl | stormy-grey-to-pale-mist, or slate-to-silver — chaotic, directionless | swirling grey wind currents and drifting dust spiral |
| **Special / hybrid** — multi-system, lightning + speed, healing + economy, drops, time | pick whatever fits the signature effect — can be multi-coloured (e.g. stormy-deep-purple-to-electric-gold for lightning, deep-violet-to-emerald-green for arcane duplication, bone-amber-to-charred-black for necromantic / drop perks) | match the perk's signature flourish (forked lightning bolts strike, swirling violet mist coils, bone shards swirl, golden light beams pierce, etc.) |

When a perk straddles two elements (e.g. "soaked enemies that ignite" =
water + fire), pick the dominant one for the gradient and let the other
appear as floating elements / hero-subject detail. Don't mix gradients
unless the perk is genuinely a special-tier hybrid.

## VFX assets required
List EVERY visual effect this perk needs to feel complete. **Most
perks need 0–3 VFX.** Each block must have a separate slug + prompt.

If the perk is purely numerical (a multiplier, a passive stat boost),
write **"None — perk is statistical only"** and skip the section.

For each VFX include:
- **Slug:** `<snake_case>` → becomes `public/vfx/<slug>.png`
- **Spawn point:** in 3D space (player / enemy / item / spell)
- **Trigger:** when it plays (one-shot on event / continuous loop)
- **Looping:** YES (must seamlessly repeat — for idle items, auras)
  or NO (one-shot)
- **Plane size in world units:** how big the on-ground bloom is
- **MP4 prompt:** ready-to-paste into Sora / Veo / Kling. Must include:
  - Pure pitch-black background (additive blending requirement)
  - 1:1 square aspect
  - No watermark, no lens flare, no depth of field, no text
  - Top-down or side view (whichever fits the effect)
  - Approximate duration in seconds
  - Style: "stylized hand-painted RPG VFX"

## How to ship this perk

1. **Icon** — generate via Nano Banana 2 / Gemini 2.5 Flash Image.
   Drop the PNG into a comment with: `/save-icon <slug>`

2. **VFX** — for each VFX block above, generate the MP4 then comment:
   `/save-vfx <vfx_slug>` (one comment per VFX → one PR per file).

3. **Wait** for all icon + VFX PRs to merge.

4. **Implement** — once all assets exist, comment:
   ```
   @claude implement this perk proposal. Reference:
   - icon: /icons/<slug>.png
   - vfx: <vfx_slug_1> (purpose), <vfx_slug_2> (purpose), ...
   ```
````

---

## Rarity design budgets

| Rarity | Mechanic complexity | Tier-up effects | VFX count | Trade-off |
|---|---|---|---|---|
| **common** | Single passive multiplier or status add | Numbers only | 0 (no asset needed) | None |
| **rare** | One reactive trigger + one status | Numbers + 1 new effect at T3 | 1 (the trigger burst) | Trigger condition limits proc rate |
| **epic** | Conditional bonus + conditional cascade | Numbers + status extension + spread on kill | 0–1 (often reuses spell VFX) | Requires setup (debuffed enemies, etc.) |
| **legendary** | Rewires a core loop (kills, drops, economy) | New mechanic each tier (drop / charge / chain) | 2–3 (drop + idle + pickup) | Real positional or aggro drawback |

---

## Worked examples — actual issues from the repo

The four examples below are the format the routine should produce.
The `## VFX assets required` section is the new addition; the rest
mirrors the existing format that's been working.

---

### Example 1 — COMMON: PepperGrind (synthesized — no real common issue exists yet)

```markdown
# PepperGrind (common)

## Metadata
- **Rarity:** `common` — single-axis passive buff with no trigger
  condition, no upgrade-path branching. Deliberately uninteresting on
  its own; meant as a building block for combo decks.
- **Tags:** `chili`, `passive`, `damage`
- **Trigger:** `passive` (always-on multiplier read at spell-cast time)
- **Stacking limit:** `3` (tier upgrade)

## Concept
A heavy black-pepper grind sneaks into every chili recipe — your CHILI
spells just hit harder. Plain bread-and-butter damage perk, the kind
you grab when nothing else looks better.

## Mechanics (Tier 1)
- At spell-cast time in `castSpell.ts`, if the spell's recipe contains
  CHILI as either ingredient, multiply the spell's `damage` by **1.10**
  (i.e. **+10%**).
- No internal cooldown, no proc roll — flat multiplier on every CHILI cast.

## Upgrade path
- **Tier 1** (base): +10% damage on CHILI spells.
- **Tier 2**: +18% damage on CHILI spells.
- **Tier 3**: +30% damage on CHILI spells, AND CHILI spells gain a small
  burn DoT (2 dmg/s for 3s) on every enemy hit.

## Trade-off
None — common-tier passive.

## Theme fit
Pepper is the cook's first lever — small grind, big bite. Reads as
basic kitchen math: more spice = more heat. Slots cleanly into the
existing extra_spicy / heavy_salt "ingredient-flavour" archetype.

## Files to touch
- `src/data/perks.ts` — add `pepper_grind` entry with `tiers` data.
- `src/utils/castSpell.ts` — extend the existing perk-multiplier block
  (where `extra_spicy` is read) to also read `pepper_grind`.

## Implementation sketch
```ts
// perks.ts
{ id: 'pepper_grind', name: 'Pepper Grind', icon: '/icons/pepper_grind.png',
  description: 'CHILI spells deal more damage. Higher tiers add a burn DoT.',
  rarity: 'common',
  tiers: [
    { stats: { ChiliDamage: '+10%' } },
    { stats: { ChiliDamage: '+18%' } },
    { stats: { ChiliDamage: '+30%' }, added: 'CHILI spells apply 2 dmg/s burn for 3s' },
  ],
}

// castSpell.ts — inside the per-perk multiplier loop
const pepper = activePerks.find(p => p.id === 'pepper_grind')
if (pepper && (slotA === 'CHILI' || slotB === 'CHILI')) {
  const tier = Math.min(pepper.stackCount, 3)
  damage *= [1.10, 1.18, 1.30][tier - 1]
  if (tier >= 3) burnDot = { perSecond: 2, durationS: 3 }
}
```

## Icon prompt
Slug: `pepper_grind`

```
A square game perk icon (1:1 aspect ratio) in dark fantasy comic-book
style with thick black outlines and vibrant saturated colors. Outer
border is a weathered dark-slate stone tablet frame with carved chipped
edges. Inner background is a deep-crimson-to-burning-orange gradient
with painterly texture. Centered hero subject: a brass-bodied wooden
pepper mill cranking down hard, grinding showers of glowing red-orange
sparks of fresh-cracked black pepper that rain onto a sizzling cast-
iron skillet below, motion lines tracing the grinder's twist as embers
burst outward. Symbolic floating elements around the subject:
scattered black peppercorns mid-flight, glowing chili-ember sparks, a
singed wooden cooking spoon, a chipped enamel salt-cellar, droplets of
bubbling oil. Crackling orange and red flames lick up from the bottom
of the inner panel. Heavy contrast, dramatic lighting, cel-shaded
comic style, hellish-kitchen theme, painterly highlights. No text, no
letters, no numbers anywhere in the image.
```

## VFX assets required
**None — perk is statistical only.** The damage modifier piggybacks on
the existing CHILI spell VFX (INFERNO/METEOR fireburst). The T3 burn DoT
should be visualised by setting `'soaked'` status on hit enemies (which
already has a tinted shader) — no new VFX file needed.
```

> **Why common works this way:** flat multipliers, no new VFX cost, low
> design surface. Easy to chain stacks. The T3 "added effect" should be
> a small twist (a tiny DoT, a 1-tile knockback, a single-status add) —
> not a new mechanic.

---

### Example 2 — RARE: GreaseFire (issue #13, real)

(See [issue #13](https://github.com/wasuioi/Hell-s-Kitchen-Alchemist-Edition/issues/13)
for the full original body. The `## VFX assets required` block below is
the **new addition** the routine should now generate.)

```markdown
## Metadata
- **Rarity:** `rare` — modest reactive effect with a clear condition
  (must be hit to trigger) and a 2s internal cooldown to prevent
  runaway value; numbers stay below epic-tier multipliers.
- **Tags:** `fire`, `defense`, `risky`
- **Trigger:** `on-damage-taken` (with a 2.0s internal cooldown shared
  across stacks)
- **Stacking limit:** `3`

## Concept
When the chef gets burned, the pan answers — taking damage erupts a
ring of flaming grease at the player's feet that scorches everything
nearby. A reactive AOE that turns getting cornered into a brief
offensive moment.

## Mechanics (Tier 1)
- When `usePlayerStore.takeDamage(amount)` is called and `amount > 0`,
  spawn a 4-unit-radius grease burst centered on `usePlayerStore.position`.
- Every enemy whose `position` is within 4 units of the burst takes
  **15 fire damage** instantly.
- The burst has a **2.0s internal cooldown** — additional hits during
  the cooldown do NOT trigger another burst.
- The burst does NOT damage the player.

## Upgrade path
- **Tier 1** (base): 15 damage, 4-unit radius, 2.0s cooldown.
- **Tier 2**: 25 damage, 5-unit radius, 1.5s cooldown. Applies
  `'soaked'` status for 1.5s to enemies hit.
- **Tier 3**: 40 damage, 6-unit radius, 1.0s cooldown. Enemies are
  `'stunned'` for 0.5s, AND if the damage taken was ≥15 (heavy hit),
  burst damage is doubled.

## Trade-off
Gated behind getting hit — playing perfectly defensively turns it off
entirely. Not a damage-immunity shield.

## Theme fit
A hellish kitchen runs on hot oil — flick water into a deep fryer and
the entire stove erupts. The chef's accidental signature move.

## Files to touch
- `src/data/perks.ts`, `src/stores/playerStore.ts`,
  `src/stores/enemyStore.ts`, `src/utils/perkTriggers.ts`,
  `src/components/SpriteVfxEffect.tsx` (consumes the new VFX slug).

## Implementation sketch
(see issue #13 — `triggerOnDamageTaken` reads stacks → tier → fires
`damageEnemy` per enemy in radius + `setEnemyHitFlash` +
`spawnDamageNumberVfx` + `spawnSpriteVfx('grease_fire', x, z)`)

## Icon prompt
Slug: `grease_fire`
(see issue #13 — Nano Banana 2 stone-tablet prompt with a scorched
cast-iron skillet erupting in flaming grease.)

## VFX assets required

### VFX 1: `grease_fire` — on-damage-taken burst
- **Spawn point:** at the player's position when `triggerOnDamageTaken`
  fires after the cooldown check
- **Trigger:** one-shot per cooldown cycle
- **Looping:** NO
- **Plane size:** 8 (a bit larger than T1 radius=4 so the visible rim
  reaches the AOE edge)
- **MP4 prompt:**
  ```
  A fierce orange-yellow ring of flaming grease bursting outward in
  slow motion, with bright sparks and embers shooting in all directions
  from a small bright fireball at center. Pure pitch-black background.
  Centered top-down view, 1:1 square aspect. ~1.0 second duration —
  expand from a small bright dot, peak as a wide ring of fire, then
  fade through smoke and embers. No camera motion, no lens flare, no
  watermark, no text. Stylized hand-painted RPG VFX.
  ```
```

> **Why rare works this way:** ONE reactive trigger, ONE VFX, ONE status
> that scales over tiers. Trade-off is "you have to be hit." No drops,
> no items, no extra VFX.

---

### Example 3 — EPIC: Tenderize (issue #9, real)

(See [issue #9](https://github.com/wasuioi/Hell-s-Kitchen-Alchemist-Edition/issues/9).
Original issue had no VFX section — the new VFX block below is what the
routine should now add.)

```markdown
## Metadata
- **Rarity:** `epic` — multi-system perk that reads enemy state, scales
  spell damage conditionally, AND chains on kill. Three interacting
  axes vs the rare-tier "one reactive trigger".
- **Tags:** `damage`, `combo`, `status-amplifier`
- **Trigger:** `on-cast` (reads enemy status at hit time)
- **Stacking limit:** `3`

## Concept
A "set-up → payoff" perk that rewards players for hitting enemies that
are already debuffed. Soaked or stunned enemies are "tenderized" meat
— your next spell hits them harder, and at higher tiers, finishing one
tenderized enemy spreads the seasoning to its neighbours.

## Mechanics (Tier 1)
- When a spell deals damage to an enemy whose `status` is `'soaked'`
  or `'stunned'`, multiply that hit's damage by **1.40** (+40%).
- Per-hit, per-enemy. Status must exist BEFORE the spell hits.

## Upgrade path
- **Tier 1**: +40% damage on soaked/stunned enemies.
- **Tier 2**: +60% damage. Hit also extends the existing status by +1s.
- **Tier 3**: +80% damage. Killing a soaked/stunned enemy with a
  tenderized hit transfers that status to the nearest enemy within 4
  units for 1.5s — kills cascade into more tenderized targets.

## Trade-off
Requires set-up — enemies must already be debuffed. Without TIDAL_WAVE,
MUD, or Deep Freeze in the deck, this perk does nothing.

## Theme fit
Tenderizing is the chef's prep ritual: pound the meat, salt-cure it,
soak it in brine, *then* bring the heat. The T3 chain reaction reads
as juices splattering off the cutting board onto the next cut.

## Files to touch
- `src/data/perks.ts`, `src/components/Spell.tsx`,
  `src/stores/enemyStore.ts` (per-enemy status expiry).

## Implementation sketch
(see issue #9 — `Spell.tsx` per-enemy hit block reads
`enemy.status === 'soaked' || 'stunned'`, multiplies damage by tier
bonus, T3 spreads status on kill via `findNearestEnemy`.)

## Icon prompt
Slug: `tenderize`
(stone-tablet style — meat mallet pulverising a glowing cut of brisket,
shockwave radiating outward.)

## VFX assets required

### VFX 1: `tenderize_strike` — on tenderized hit (optional, T2+ only)
- **Spawn point:** at the hit enemy's position
- **Trigger:** one-shot when a tenderized hit lands (T2+, otherwise
  the existing spell VFX is enough)
- **Looping:** NO
- **Plane size:** 1.5 (small impact, not a full AOE)
- **MP4 prompt:**
  ```
  A short crimson impact-burst with white shockwave rings, like a
  meat-mallet strike — sharp expansion in the first 100ms, brief peak,
  quick fade through small red sparks. Pure pitch-black background.
  Centered top-down view, 1:1 square aspect. ~0.5 second duration. No
  camera motion, no lens flare, no watermark, no text. Stylized hand-
  painted RPG impact VFX.
  ```

> Note: at T1 the perk piggybacks on the existing spell VFX (INFERNO /
> TIDAL_WAVE). The `tenderize_strike` sprite is added at T2 to mark the
> "+status extended" beat so the player sees the upgrade landing.
```

> **Why epic works this way:** two interacting systems (damage scaling
> + status extension + spread-on-kill), built on top of an existing
> system (spell hits, status effects). Often reuses existing VFX with
> AT MOST ONE new sprite for the upgrade beats.

---

### Example 4 — LEGENDARY: BonemealStock (issue #28, real)

(See [issue #28](https://github.com/wasuioi/Hell-s-Kitchen-Alchemist-Edition/issues/28)
for the full body. The VFX block below is the new addition.)

```markdown
## Metadata
- **Rarity:** `legendary` — fundamentally rewires the loop (kills become
  a resource economy that feeds healing, cooldown reduction, AND a
  charged-spell trigger), with a real positional drawback. No existing
  perk touches on-kill drops or healing, so the lever is fresh enough
  to justify the slot.
- **Tags:** `healing`, `economy`, `combo`
- **Trigger:** `on-kill` (drop spawn) + passive (pickup-on-proximity)
- **Stacking limit:** `1`

## Concept
Killed enemies leave behind a glowing skull-shaped Stock Cube. Walk
over them to heal, shave cook cooldown, and at higher tiers, prime a
free supercharged spell. The kitchen runs on bones — every corpse
seasons the next plate.

## Mechanics (Tier 1)
- 50% chance for an enemy death to spawn a Stock Cube at its position.
- Cube persists 8.0s, then despawns.
- Player within 1.2 units of a cube → consume:
  - `usePlayerStore.heal(8)`
  - Reduce current cook cooldown remaining by 0.5s

## Upgrade path
- **Tier 1**: 50% drop, +8 HP, -0.5s cd, 8s lifetime.
- **Tier 2**: 75% drop, +12 HP, -0.75s cd, 10s lifetime. **Reduction:**
  picking up 3rd cube within a 6s rolling window arms a buff — next
  cooked spell deals +50% damage AND applies `'soaked'` for 2s.
- **Tier 3**: 100% drop, +15 HP, -1.0s cd, 12s lifetime. Reduction
  buff is upgraded — next cooked spell ALSO instantly resets cook
  cooldown AND triggers twice 200ms apart (Double-Batch-style).

## Trade-off
Stock Cubes glow and steam — **the nearest enemy within 12 units of
each cube actively re-paths toward the cube** (overrides player-aggro
while the cube exists). Greedy collection forces you to kite *into*
the swarm rather than away from it.

## Theme fit
A kitchen-from-hell runs on stock — the foundational liquid extracted
from bones. Every chef knows: never throw away a carcass. The aggro
drawback fits — predators smell broth from a long way off.

## Files to touch
- `src/data/perks.ts`, `src/types.ts` (StockCube interface),
  `src/stores/enemyStore.ts` (drop hook + cube re-path AI),
  new `src/stores/worldStore.ts` (cube list + spawn/consume),
  `src/stores/playerStore.ts` (proximity pickup),
  `src/stores/deckStore.ts` (`reduceCookCooldown`, reduction-buff
  arming), `src/utils/castSpell.ts` (consume reduction buff),
  new `src/components/StockCube.tsx`.

## Implementation sketch
(see issue #28 — drop hook in `damageEnemy`, per-frame proximity check
in `playerStore`, reduction-buff buffer in `deckStore`, AI override in
`enemyStore` to retarget cubes.)

## Icon prompt
Slug: `bonemeal_stock`
(stone-tablet style — glowing amber bouillon cube carved as a leering
demonic skull, levitating above a chef's brass ladle, hot golden-brown
stock dripping from empty eye sockets.)

## VFX assets required

This perk needs **THREE separate VFX** — one for the drop burst, one
for the cube idling on the ground, one for the pickup confirmation.

### VFX 1: `bonemeal_burst` — on enemy death (drop)
- **Spawn point:** at the dying enemy's position
- **Trigger:** one-shot, only when the drop roll succeeds
- **Looping:** NO
- **Plane size:** 2 (small puff, not a full AOE — visual only, no damage)
- **MP4 prompt:**
  ```
  A small puff of pale-yellow bone-dust bursting outward and falling,
  with a few sharp white bone shards flying briefly outward from a
  faint amber centre flash. Pure pitch-black background. Centered top-
  down view, 1:1 square aspect. ~0.6 second duration. No camera motion,
  no lens flare, no watermark, no text. Stylized hand-painted RPG VFX.
  ```

### VFX 2: `bonemeal_idle_loop` — Stock Cube on ground
- **Spawn point:** at the cube's position
- **Trigger:** continuous loop while the cube exists (up to 12s at T3)
- **Looping:** YES — must be seamless (last frame ≈ first frame)
- **Plane size:** 1.2 (matches the 1.2-unit pickup radius)
- **MP4 prompt:**
  ```
  A small skull-shaped amber bouillon cube on the ground, slowly
  pulsing with warm golden inner light. Faint heat shimmer rising
  above. A few lazy sparkles drifting slowly upward and dissolving.
  Pure pitch-black background, top-down view, 1:1 aspect. Seamless
  1-second loop — last frame matches first frame exactly. No camera
  motion, no text, no watermark. Stylized hand-painted RPG idle item.
  ```

### VFX 3: `bonemeal_pickup_flash` — pickup confirm
- **Spawn point:** at the player's position when a cube is consumed
- **Trigger:** one-shot
- **Looping:** NO
- **Plane size:** 1.5
- **MP4 prompt:**
  ```
  A brief golden-white flash burst with rising bone-dust particles and
  small amber sparkles spiralling inward. Pure pitch-black background.
  Centered top-down view, 1:1 square aspect. Quick ~0.4 second duration.
  No camera motion, no lens flare, no watermark, no text. Stylized RPG
  pickup feedback VFX.
  ```

## How to ship this perk

1. Generate icon → comment `/save-icon bonemeal_stock`
2. Generate VFX 1 MP4 → `/save-vfx bonemeal_burst`
3. Generate VFX 2 MP4 → `/save-vfx bonemeal_idle_loop`
4. Generate VFX 3 MP4 → `/save-vfx bonemeal_pickup_flash`
5. Wait for the 4 PRs to merge.
6. Comment:
   ```
   @claude implement this perk proposal. Reference:
   - icon: /icons/bonemeal_stock.png
   - vfx: bonemeal_burst (at enemy on death),
          bonemeal_idle_loop (at cube position, looping),
          bonemeal_pickup_flash (at player on pickup)
   ```
```

> **Why legendary works this way:** rewires a core loop (kills become
> resource), introduces a NEW persistent world object (the cube),
> needs 3 separate VFX (drop / idle / pickup), and pays for the power
> with a real positional drawback (cube aggro). At least 3 stores get
> touched. This is the highest design surface tier — about one of these
> in five issues is the right ratio.

---

## Output rules

- Output **ONE** issue per routine run, matching the template above.
- Do NOT mention combos in the issue body — design with combos in mind
  but keep the body focused on the single perk.
- Pick the rarity by what the mechanic deserves, not by lottery.
  Common-tier mechanics in legendary clothing waste the slot.
- The `## VFX assets required` section is mandatory. If the perk truly
  needs no VFX, say so explicitly — don't omit the section.
- Slugs are `snake_case`, lowercase, ASCII only.
