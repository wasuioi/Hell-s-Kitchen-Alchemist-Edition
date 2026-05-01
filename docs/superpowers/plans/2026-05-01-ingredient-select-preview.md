# Ingredient Select Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split ingredient selection from commitment — clicking a card lifts it into the cauldron as a preview while glowing in hand; clicking again unselects it; only Space (cook) consumes the cards and draws replacements.

**Architecture:** Store the source hand index inside each cauldron slot (`{ ingredient, fromHandIndex }`) so "is this hand card selected?" is derived from cauldron state — single source of truth. `slotIngredient(i)` becomes a toggle. `cook()` draws fresh ingredients only at the recorded `fromHandIndex` positions.

**Tech Stack:** Zustand store, React 19, TypeScript strict, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-01-ingredient-select-preview-design.md](../specs/2026-05-01-ingredient-select-preview-design.md)

---

### Task 1: Update deckStore tests for new behavior

We TDD the store first. Existing tests reference the old `cauldron.slotA: Ingredient | null` shape and need to assert against the new `{ ingredient, fromHandIndex } | null` shape. We also add tests for the new toggle / unselect / partial-refill behavior.

**Files:**
- Modify: `src/__tests__/deckStore.test.ts`

- [ ] **Step 1: Replace the deckStore.test.ts file with the new tests**

Open `src/__tests__/deckStore.test.ts` and replace the entire file with this content:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useDeckStore } from '../stores/deckStore'

describe('useDeckStore', () => {
  beforeEach(() => { useDeckStore.getState().reset() })

  it('initializes with 3 ingredients in hand', () => {
    useDeckStore.getState().initHand()
    expect(useDeckStore.getState().hand).toHaveLength(3)
  })

  it('each hand ingredient is CHILI, BOTTLE, or SALT', () => {
    useDeckStore.getState().initHand()
    for (const card of useDeckStore.getState().hand) {
      expect(['CHILI', 'BOTTLE', 'SALT']).toContain(card)
    }
  })

  it('slotIngredient places hand card into slot A and tags fromHandIndex', () => {
    useDeckStore.getState().initHand()
    const firstCard = useDeckStore.getState().hand[0]
    useDeckStore.getState().slotIngredient(0)
    const { slotA, slotB } = useDeckStore.getState().cauldron
    expect(slotA).toEqual({ ingredient: firstCard, fromHandIndex: 0 })
    expect(slotB).toBeNull()
  })

  it('slotIngredient does NOT mutate the hand on selection', () => {
    useDeckStore.getState().initHand()
    const handBefore = [...useDeckStore.getState().hand]
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().hand).toEqual(handBefore)
  })

  it('slotIngredient fills slot B when A is full and indices differ', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(1)
    const { slotA, slotB } = useDeckStore.getState().cauldron
    expect(slotA?.fromHandIndex).toBe(0)
    expect(slotB?.fromHandIndex).toBe(1)
  })

  it('slotIngredient on the same index that fills slot A unselects it (toggle)', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(0)
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
  })

  it('slotIngredient on the same index that fills slot B unselects only B', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(1)
    useDeckStore.getState().slotIngredient(1)
    const { slotA, slotB } = useDeckStore.getState().cauldron
    expect(slotA?.fromHandIndex).toBe(0)
    expect(slotB).toBeNull()
  })

  it('slotIngredient does nothing when both slots filled by other indices', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().slotIngredient(1)
    const handBefore = [...useDeckStore.getState().hand]
    const cauldronBefore = useDeckStore.getState().cauldron
    useDeckStore.getState().slotIngredient(2)
    expect(useDeckStore.getState().hand).toEqual(handBefore)
    expect(useDeckStore.getState().cauldron).toEqual(cauldronBefore)
  })

  it('cook returns spell type and clears cauldron', () => {
    useDeckStore.getState().initHand()
    useDeckStore.setState({
      cauldron: {
        slotA: { ingredient: 'CHILI', fromHandIndex: 0 },
        slotB: { ingredient: 'CHILI', fromHandIndex: 1 },
      },
    })
    expect(useDeckStore.getState().cook()).toBe('INFERNO')
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
  })

  it('cook draws fresh ingredients ONLY at the fromHandIndex positions', () => {
    useDeckStore.setState({
      hand: ['CHILI', 'BOTTLE', 'SALT'],
      cauldron: {
        slotA: { ingredient: 'CHILI', fromHandIndex: 0 },
        slotB: { ingredient: 'BOTTLE', fromHandIndex: 1 },
      },
    })
    useDeckStore.getState().cook()
    const hand = useDeckStore.getState().hand
    expect(hand).toHaveLength(3)
    // index 2 was untouched
    expect(hand[2]).toBe('SALT')
    // indices 0 and 1 are valid ingredients (might equal old by chance)
    expect(['CHILI', 'BOTTLE', 'SALT']).toContain(hand[0])
    expect(['CHILI', 'BOTTLE', 'SALT']).toContain(hand[1])
  })

  it('cook returns null when cauldron is not full', () => {
    useDeckStore.getState().initHand()
    useDeckStore.setState({
      cauldron: {
        slotA: { ingredient: 'CHILI', fromHandIndex: 0 },
        slotB: null,
      },
    })
    expect(useDeckStore.getState().cook()).toBeNull()
  })

  it('addPerk adds to activePerks', () => {
    useDeckStore.getState().addPerk({ id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'test', stackCount: 1 })
    expect(useDeckStore.getState().activePerks).toHaveLength(1)
  })

  it('addPerk increments stackCount for duplicate perks', () => {
    const perk = { id: 'extra_spicy', name: 'Extra Spicy', icon: '🌶️', description: 'test', stackCount: 1 }
    useDeckStore.getState().addPerk(perk)
    useDeckStore.getState().addPerk(perk)
    expect(useDeckStore.getState().activePerks).toHaveLength(1)
    expect(useDeckStore.getState().activePerks[0].stackCount).toBe(2)
  })

  it('reset clears everything', () => {
    useDeckStore.getState().initHand()
    useDeckStore.getState().slotIngredient(0)
    useDeckStore.getState().addPerk({ id: 'x', name: 'x', icon: 'x', description: 'x', stackCount: 1 })
    useDeckStore.getState().reset()
    expect(useDeckStore.getState().hand).toHaveLength(0)
    expect(useDeckStore.getState().cauldron.slotA).toBeNull()
    expect(useDeckStore.getState().cauldron.slotB).toBeNull()
    expect(useDeckStore.getState().activePerks).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail (compile errors expected)**

Run: `npm run test -- src/__tests__/deckStore.test.ts`

Expected: FAIL. The store still uses the old `Ingredient | null` shape, so `setState({ cauldron: { slotA: { ingredient: ..., fromHandIndex: ... } } })` is a type error and runtime equality assertions also fail. This is the right kind of failing — proceed to Task 2.

---

### Task 2: Rewrite deckStore to support new cauldron shape + toggle

**Files:**
- Modify: `src/stores/deckStore.ts`

- [ ] **Step 1: Replace the deckStore.ts file with the new implementation**

Open `src/stores/deckStore.ts` and replace the entire file with this content:

```ts
import { create } from 'zustand'
import type { Ingredient, Perk, SpellType } from '../types'
import { getRecipe } from '../data/recipes'

const INGREDIENTS: Ingredient[] = ['CHILI', 'BOTTLE', 'SALT']
function drawRandomIngredient(): Ingredient {
  return INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]
}

export interface CauldronSlot {
  ingredient: Ingredient
  fromHandIndex: number
}

interface DeckState {
  hand: Ingredient[]
  cauldron: { slotA: CauldronSlot | null; slotB: CauldronSlot | null }
  activePerks: Perk[]
  cookCooldown: number
  cookCooldownDuration: number
  initHand: () => void
  slotIngredient: (handIndex: number) => void
  cook: () => SpellType | null
  addPerk: (perk: Perk) => void
  clearPerks: () => void
  setCookCooldown: (timestamp: number, duration: number) => void
  reset: () => void
}

export const useDeckStore = create<DeckState>((set, get) => ({
  hand: [],
  cauldron: { slotA: null, slotB: null },
  activePerks: [],
  cookCooldown: 0,
  cookCooldownDuration: 1.5,

  initHand: () => set({
    hand: [drawRandomIngredient(), drawRandomIngredient(), drawRandomIngredient()],
    cauldron: { slotA: null, slotB: null },
  }),

  slotIngredient: (handIndex) => {
    const state = get()
    if (handIndex < 0 || handIndex >= state.hand.length) return
    const { slotA, slotB } = state.cauldron
    // Toggle off: clicking the index that fills A or B unselects it.
    if (slotA?.fromHandIndex === handIndex) {
      set({ cauldron: { slotA: null, slotB } })
      return
    }
    if (slotB?.fromHandIndex === handIndex) {
      set({ cauldron: { slotA, slotB: null } })
      return
    }
    // Place into next empty slot.
    const ingredient = state.hand[handIndex]
    if (slotA === null) {
      set({ cauldron: { slotA: { ingredient, fromHandIndex: handIndex }, slotB } })
      return
    }
    if (slotB === null) {
      set({ cauldron: { slotA, slotB: { ingredient, fromHandIndex: handIndex } } })
      return
    }
    // Both slots full and clicked index isn't selected — do nothing.
  },

  cook: () => {
    const state = get()
    const { slotA, slotB } = state.cauldron
    if (slotA === null || slotB === null) return null
    const spell = getRecipe(slotA.ingredient, slotB.ingredient)
    const newHand = [...state.hand]
    newHand[slotA.fromHandIndex] = drawRandomIngredient()
    newHand[slotB.fromHandIndex] = drawRandomIngredient()
    set({ hand: newHand, cauldron: { slotA: null, slotB: null } })
    return spell
  },

  addPerk: (perk) => set((state) => {
    const existing = state.activePerks.find((p) => p.id === perk.id)
    if (existing) {
      return {
        activePerks: state.activePerks.map((p) =>
          p.id === perk.id ? { ...p, stackCount: p.stackCount + 1 } : p
        ),
      }
    }
    return { activePerks: [...state.activePerks, { ...perk, stackCount: 1 }] }
  }),

  clearPerks: () => set({ activePerks: [] }),

  setCookCooldown: (timestamp, duration) => set({
    cookCooldown: timestamp,
    cookCooldownDuration: duration,
  }),

  reset: () => set({
    hand: [],
    cauldron: { slotA: null, slotB: null },
    activePerks: [],
    cookCooldown: 0,
    cookCooldownDuration: 1.5,
  }),
}))
```

- [ ] **Step 2: Run the deckStore tests to confirm they pass**

Run: `npm run test -- src/__tests__/deckStore.test.ts`

Expected: all 14 tests in `useDeckStore` pass.

- [ ] **Step 3: Run the full test suite to see what else breaks**

Run: `npm run test`

Expected: Other tests likely still pass (most don't touch cauldron). However `npm run build` (TS check) will fail on `CauldronUI.tsx` because it reads `slotA` / `slotB` as `Ingredient | null`. We'll fix it in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/deckStore.test.ts src/stores/deckStore.ts
git commit -m "refactor(deck): cauldron slot stores fromHandIndex for select preview"
```

---

### Task 3: Update CauldronUI to read slot.ingredient

The cauldron UI already shows the ingredient image inside each slot — it just needs to read from `slot.ingredient` instead of treating the slot itself as the ingredient.

**Files:**
- Modify: `src/ui/CauldronUI.tsx`

- [ ] **Step 1: Update the destructuring + reads**

In `src/ui/CauldronUI.tsx`, line 23 currently is:

```ts
  const { slotA, slotB } = cauldron
  const ready = slotA !== null && slotB !== null
```

Keep that — `null` check still works on the new shape.

Line ~41 currently is:

```ts
  const spellPreview = ready
    ? (SPELL_LABELS[getRecipe(slotA!, slotB!)] ?? getRecipe(slotA!, slotB!))
    : null
```

Replace with:

```ts
  const spellPreview = ready
    ? (SPELL_LABELS[getRecipe(slotA!.ingredient, slotB!.ingredient)] ?? getRecipe(slotA!.ingredient, slotB!.ingredient))
    : null
```

Lines ~71 and ~75 currently are:

```tsx
        <div style={slotStyle(slotA !== null)}>
          {slotA ? <img src={ICON[slotA]} alt={slotA} width={42} height={42} style={{ objectFit: 'contain' }} /> : 'A'}
        </div>
```

```tsx
        <div style={slotStyle(slotB !== null)}>
          {slotB ? <img src={ICON[slotB]} alt={slotB} width={42} height={42} style={{ objectFit: 'contain' }} /> : 'B'}
        </div>
```

Replace both with `slot{A,B}.ingredient` for the ICON / alt lookups:

```tsx
        <div style={slotStyle(slotA !== null)}>
          {slotA ? <img src={ICON[slotA.ingredient]} alt={slotA.ingredient} width={42} height={42} style={{ objectFit: 'contain' }} /> : 'A'}
        </div>
```

```tsx
        <div style={slotStyle(slotB !== null)}>
          {slotB ? <img src={ICON[slotB.ingredient]} alt={slotB.ingredient} width={42} height={42} style={{ objectFit: 'contain' }} /> : 'B'}
        </div>
```

- [ ] **Step 2: Run TS build to confirm CauldronUI compiles**

Run: `npm run build`

Expected: build succeeds. (If any other file errors, address inline — but a grep earlier showed only CauldronUI / deckStore touch the cauldron object directly.)

- [ ] **Step 3: Run full test suite**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/CauldronUI.tsx
git commit -m "refactor(ui): cauldron reads slot.ingredient for new slot shape"
```

---

### Task 4: Add glow on selected cards in CardHand

CardHand currently doesn't know about the cauldron. Subscribe to it, derive `isSelected(i)`, and apply a gold-bordered glow when the card is selected.

**Files:**
- Modify: `src/ui/CardHand.tsx`

- [ ] **Step 1: Replace the CardHand.tsx file**

Open `src/ui/CardHand.tsx` and replace the entire file with this content:

```tsx
import { useDeckStore } from '../stores/deckStore'
import type { Ingredient } from '../types'

const ICON: Record<Ingredient, string> = {
  CHILI: '/icons/chili.png',
  BOTTLE: '/icons/bottle.png',
  SALT: '/icons/salt.png',
}
const LABEL: Record<Ingredient, string> = { CHILI: 'Chili', BOTTLE: 'Bottle', SALT: 'Salt' }
const GRADIENT: Record<Ingredient, string> = {
  CHILI: 'linear-gradient(135deg, #7f1d1d, #ef4444)',
  BOTTLE: 'linear-gradient(135deg, #1e3a5f, #3b82f6)',
  SALT: 'linear-gradient(135deg, #374151, #9ca3af)',
}

export default function CardHand() {
  const hand = useDeckStore((s) => s.hand)
  const cauldron = useDeckStore((s) => s.cauldron)

  const isSelected = (i: number) =>
    cauldron.slotA?.fromHandIndex === i || cauldron.slotB?.fromHandIndex === i

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {hand.map((ingredient, i) => {
        const selected = isSelected(i)
        return (
          <button
            key={i}
            onClick={() => useDeckStore.getState().slotIngredient(i)}
            style={{
              width: '80px', height: '110px',
              border: selected ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.3)',
              borderRadius: '10px', background: GRADIENT[ingredient], color: 'white',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '6px',
              transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
              fontFamily: 'inherit',
              transform: selected ? 'translateY(-6px)' : 'translateY(0)',
              boxShadow: selected ? '0 0 16px rgba(251, 191, 36, 0.7)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!selected) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={(e) => {
              if (!selected) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            }}
          >
            <img src={ICON[ingredient]} alt={LABEL[ingredient]} width={48} height={48} style={{ objectFit: 'contain' }} />
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{LABEL[ingredient]}</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>[{i + 1}/{['J','K','L'][i]}]</span>
          </button>
        )
      })}
    </div>
  )
}
```

The notable additions vs the original:
- Subscribe to `cauldron`.
- `isSelected(i)` derives from `fromHandIndex`.
- Border / `boxShadow` / `transform` swap to gold when selected; `translateY(-6px)` sits 2px higher than the existing 4px hover.
- Hover handlers no-op on selected cards so hover doesn't fight the lifted state.

- [ ] **Step 2: TS build**

Run: `npm run build`

Expected: success.

- [ ] **Step 3: Run full test suite + lint**

Run: `npm run test`
Run: `npm run lint`

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/CardHand.tsx
git commit -m "feat(ui): glow selected hand cards (gold border + bloom + lift)"
```

---

### Task 5: Manual browser verification

Code-level verification can't catch UI feel. Run the dev server and play through the new flow.

**Files:** None.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Open the URL printed in the terminal.

- [ ] **Step 2: Click "Start" and verify the flow**

Walk through this checklist:

1. **Click hand[0]** → that card lifts + glows gold; cauldron slot A shows the ingredient. Hand still shows the same 3 ingredients (no random redraw).
2. **Click hand[0] again** → glow gone, card drops back; cauldron slot A clears. Hand still has the same 3 ingredients.
3. **Click hand[0]** then **click hand[1]** → both glow; cauldron has both slots filled; spell preview text shows.
4. **Click hand[1] again** → only slot B clears, slot A keeps slot A's ingredient. hand[0] still glows.
5. **With both slots full, click hand[2]** → nothing happens (hand[2] doesn't glow, no cauldron change).
6. **Press Space** → spell fires; cauldron clears; hand[0] and hand[1] get fresh random ingredients (might happen to roll the same ingredient — that's fine); hand[2] is unchanged.
7. **Use J / K / L on the keyboard** instead of click → same toggle behavior.
8. **Cook cooldown:** after a fast cook, while the cooldown bar is visible, selection still works (clicking lifts the card / toggles glow); only Space is gated.

If any step misbehaves, fix the offending file and recommit before continuing.

- [ ] **Step 3: Stop dev server and confirm clean state**

Stop the dev server. Run:

```bash
git status
npm run test
npm run lint
npm run build
```

Expected: clean working tree, all green.

- [ ] **Step 4: Final cleanup commit (if any small fixes)**

Only needed if Step 2 surfaced anything. Otherwise skip.

---

## Spec Coverage

- ✅ Click hand[i] → glow + ingredient enters cauldron, no hand mutation: Tasks 2 + 4
- ✅ Click same hand[i] → unselect: Tasks 1 + 2 (toggle tests + impl)
- ✅ Click hand[i] when both slots full → no-op: Task 1 test, Task 2 impl
- ✅ Cook draws only at fromHandIndex positions: Task 1 test, Task 2 impl
- ✅ Keyboard parity (J/K/L): unchanged — App.tsx already calls `slotIngredient(i)` and the store handles toggle uniformly. Manual verification covers it (Task 5, step 7)
- ✅ Cook cooldown unchanged + selecting during cooldown allowed: cook cooldown lives in `App.tsx` / `CauldronUI.tsx`, not touched. Manual verification covers it (Task 5, step 8)
- ✅ Spell preview text uses slot.ingredient: Task 3
- ✅ Glow style (gold border + bloom + lift): Task 4
