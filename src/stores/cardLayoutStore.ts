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
}

export const CARD_LAYOUT_DEFAULTS: CardLayoutValues = {
  cardWidth: 340,
  cardHeight: 564,
  bannerHeight: 16,
  bannerGap: 0,
  padX: 80,
  padTop: 80,
  padBottom: 74,
  iconSize: 82,
  nameSize: 17,
  bannerSize: 24,
}

interface CardLayoutState extends CardLayoutValues {
  setValue: (key: keyof CardLayoutValues, value: number) => void
  reset: () => void
}

export const useCardLayoutStore = create<CardLayoutState>()(
  persist(
    (set) => ({
      ...CARD_LAYOUT_DEFAULTS,
      setValue: (key, value) => set({ [key]: value }),
      reset: () => set(CARD_LAYOUT_DEFAULTS),
    }),
    { name: 'card-layout-tweaks' },
  ),
)
