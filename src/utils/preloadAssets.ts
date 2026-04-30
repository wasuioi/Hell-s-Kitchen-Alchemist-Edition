import { PERK_POOL } from '../data/perks'

// Pre-warm the browser image cache for everything the game references at
// runtime — icons that the reward screen / HUD pull from `/icons/<slug>.png`
// and sprite-sheet VFX that perk triggers pull from `/vfx/<slug>.png`.
//
// Without this, those PNGs only load when first referenced (when a reward
// shows or a perk fires), which causes a visible flicker the first time.
// Running this on app mount turns those into instant cache hits.
//
// new Image() warms both the regular browser cache *and* Three.js's
// TextureLoader cache, since TextureLoader internally uses HTMLImageElement.
export function preloadGameAssets(): void {
  const urls = new Set<string>([
    // Reward / dev card stone-tablet frame — first reward screen shows 3
    // copies at once, so a cold cache here is especially noticeable.
    '/ui/card_frame.png',
  ])
  for (const perk of PERK_POOL) {
    if (perk.icon.startsWith('/')) urls.add(perk.icon)
    if (perk.vfxSprite) urls.add(`/vfx/${perk.vfxSprite}.png`)
  }
  // Secondary VFX sprites not bound to a perk's `vfxSprite` field.
  // BoilingPoint spawns TWO sprites on consume: `boiling_point_consume`
  // (covered by the perk.vfxSprite loop above) and `boiling_point_spell`
  // (only spawned at trigger time in castSpell.ts). Mirror it here so the
  // browser cache + Three.js warmup paths stay consistent.
  urls.add('/vfx/boiling_point_spell.png')
  for (const url of urls) {
    const img = new Image()
    img.src = url
  }
}
