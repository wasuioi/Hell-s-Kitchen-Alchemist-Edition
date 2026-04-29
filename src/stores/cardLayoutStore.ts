import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── cardLayoutStore ─────────────────────────────────────────────────────────
//
// Live tweakable values for <PerkCard>. Lets the dev iterate on padding,
// font sizes, and aspect ratios at runtime without rebuilding — see the
// "Card Layout Tweaker" section in DevPanel.tsx for the slider UI.
//
// The store starts at the same values that are baked into PerkCard as
// defaults. After the dev finds numbers they like:
//   1. Click "Copy values" in DevPanel → get a TS snippet
//   2. Paste into the chat with Claude → Claude updates the `DEFAULTS`
//      below + the matching consts in PerkCard.tsx
//   3. Other users on a fresh build pick up the new defaults
//
// Persistence (localStorage) is intentional — refresh during iteration
// shouldn't reset the dev's in-progress tweaks. In production, users
// who never opened DevPanel have no localStorage entry, so they always
// get the baked-in defaults.
// ────────────────────────────────────────────────────────────────────────────

export interface CardLayoutValues {
  cardWidth: number
  cardHeight: number
  bannerHeight: number
  bannerGap: number
  padX: number
  padTop: number
  padBottom: number
  iconSize: number
  nameSize: number
  bannerSize: number
  // Visual zoom multiplier applied to the whole card via CSS `zoom`.
  // The other values describe the card's INTRINSIC layout; cardScale
  // shrinks/enlarges the rendered output without changing proportions.
  // Useful when the tuned card is too tall for the reward screen to
  // fit its header + footer in the viewport.
  cardScale: number
}

export const CARD_LAYOUT_DEFAULTS: CardLayoutValues = {
  cardWidth: 400,
  cardHeight: 712,
  bannerHeight: 13,
  bannerGap: 0,
  padX: 82,
  padTop: 30,
  padBottom: 74,
  iconSize: 136,
  nameSize: 16,
  bannerSize: 31,
  cardScale: 0.65,
}

interface CardLayoutState extends CardLayoutValues {
  setValue: (key: keyof CardLayoutValues, value: number) => void
  reset: () => void
}

export const useCardLayoutStore = create<CardLayoutState>()(
  persist(
    (set) => ({
      ...CARD_LAYOUT_DEFAULTS,
      // Float steps (e.g. cardScale at 0.05) accumulate FP error fast,
      // so round to 2dp on write — keeps the stored value clean and
      // matches what the slider visually snaps to.
      setValue: (key, value) => set({ [key]: Math.round(value * 100) / 100 }),
      reset: () => set(CARD_LAYOUT_DEFAULTS),
    }),
    { name: 'card-layout-tweaks' },
  ),
)
