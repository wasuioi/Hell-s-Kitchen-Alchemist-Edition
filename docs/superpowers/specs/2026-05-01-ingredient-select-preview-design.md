# Ingredient Selection — Preview-Before-Cook Design

## Problem

Today, clicking a card in hand instantly:

1. Places the ingredient in the next empty cauldron slot, AND
2. Replaces that hand position with a fresh random ingredient.

There is no "thinking" step. If the player misclicks or changes their mind, the original card is already lost — they have to commit to whatever the new random card is. The cauldron and hand feel like one fused action instead of two distinct decisions.

## Goal

Split selection from commitment. The player should be able to:

- **Select** ingredients into the cauldron as a preview (see what spell would be made).
- **Unselect** any selected card to put it back, with the original card still in hand.
- **Cook** with Space to actually consume the ingredients and draw replacements.

The hand stays untouched until cook fires.

## Behavior

### Selection states

| Action | Cauldron | Hand |
|---|---|---|
| Click `hand[i]` (unselected, slot free) | ingredient appears in next empty slot, tagged with `fromHandIndex: i` | `hand[i]` glows; value unchanged |
| Click `hand[i]` (already selected) | the slot referencing `i` clears | `hand[i]` stops glowing; value unchanged |
| Click `hand[i]` (unselected, both slots full) | no change | no change |
| Press `Space` (both slots filled) | cooks → spell fires → both slots clear | the two `fromHandIndex` positions get fresh random ingredients |
| Press `Space` (cauldron not full) | no change | no change |

### Keyboard parity

`J` / `K` / `L` (and `1` / `2` / `3`) behave exactly like clicking `hand[0]` / `hand[1]` / `hand[2]` — including the toggle (press the same key again to unselect).

### Edge cases

- **Duplicate ingredients in hand** (e.g. two CHILIs at indices 0 and 1): selection is by index, not by ingredient type. Selecting hand[0] glows only hand[0]; the second CHILI in hand[1] stays unglowed.
- **Selecting then unselecting the slot-A card while slot-B is filled**: slot A becomes empty, slot B keeps its content. The next selection goes back into slot A.
- **Spell preview text** (`= Inferno 🔥`): already driven by `slotA && slotB`, so it shows the moment 2 cards are selected — this becomes more useful, not less, since the player can now decide whether to commit.
- **Cook cooldown**: unchanged. The cooldown still gates the cook action, not the selection action. Selecting / unselecting during cooldown is allowed.

## State change

Single source of truth: store the source hand index inside the cauldron slot.

```ts
// before
cauldron: {
  slotA: Ingredient | null
  slotB: Ingredient | null
}

// after
cauldron: {
  slotA: { ingredient: Ingredient; fromHandIndex: number } | null
  slotB: { ingredient: Ingredient; fromHandIndex: number } | null
}
```

A hand index `i` is "selected" iff `slotA?.fromHandIndex === i || slotB?.fromHandIndex === i`. The CardHand component derives the glow state from this — no separate `selectedIndices` array, no sync risk.

### `slotIngredient(handIndex)` new logic

```
if cauldron.slotA?.fromHandIndex === handIndex:
    clear slotA
    return
if cauldron.slotB?.fromHandIndex === handIndex:
    clear slotB
    return
if cauldron.slotA === null:
    set slotA = { ingredient: hand[handIndex], fromHandIndex: handIndex }
    return
if cauldron.slotB === null:
    set slotB = { ingredient: hand[handIndex], fromHandIndex: handIndex }
    return
// both slots full and the clicked card isn't selected — do nothing
```

The hand array is **never mutated** by `slotIngredient`. Random replacement only happens in `cook()`.

### `cook()` new logic

```
if slotA === null or slotB === null: return null
spell = getRecipe(slotA.ingredient, slotB.ingredient)
indicesToRefill = [slotA.fromHandIndex, slotB.fromHandIndex]
newHand = [...hand]
for each i in indicesToRefill: newHand[i] = drawRandomIngredient()
set { hand: newHand, cauldron: { slotA: null, slotB: null } }
return spell
```

If both slots happen to reference the same hand index — they can't, because slotIngredient guards that — but defensively the loop handles it idempotently.

### Other store methods

- `initHand` / `reset`: cauldron shape changes from `{ slotA: null, slotB: null }` to the same `{ slotA: null, slotB: null }` (the `null` sentinel is identical, only the non-null shape grew). Initialization unchanged.
- `addPerk` / `clearPerks` / `setCookCooldown`: untouched.

## Visual

### Glow style on selected hand cards

Add to `CardHand.tsx` per-card style when the index is selected:

- Border: `2px solid #fbbf24` (the same gold the cook button uses, for visual consistency).
- Box-shadow: `0 0 16px rgba(251, 191, 36, 0.7)` — soft golden bloom.
- Slight upward translate: `translateY(-6px)` (currently hover translates by 4px; selected sits 2px higher than hover).

No pulse animation in v1 — keep it static and clear. Can add pulse later if it feels flat.

### Cauldron

No visual change. `CauldronUI.tsx` already shows the ingredient image inside each slot; it just needs to read `slot.ingredient` instead of `slot` directly.

## Files touched

| File | Change |
|---|---|
| `src/stores/deckStore.ts` | New cauldron type; rewrite `slotIngredient` and `cook` per logic above. |
| `src/ui/CardHand.tsx` | Subscribe to cauldron; derive `isSelected(i)`; apply glow style. |
| `src/ui/CauldronUI.tsx` | Read `slot.ingredient` instead of `slot`. Spell preview uses `slot.ingredient`. |
| `src/__tests__/deckStore.test.ts` | Update existing tests to match new shape; add tests for selection toggle, cook drawing only at fromHandIndex, click-when-full no-op. |

## Out of scope

- Any change to the recipe matrix, ingredient set, or spell list.
- Animation / transition on the ingredient travelling from hand to cauldron.
- Sound effects.
- Pulse / shimmer on the glow.
- Touch-and-drag interaction.
