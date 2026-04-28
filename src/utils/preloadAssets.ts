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
  const urls = new Set<string>()
  for (const perk of PERK_POOL) {
    if (perk.icon.startsWith('/')) urls.add(perk.icon)
    if (perk.vfxSprite) urls.add(`/vfx/${perk.vfxSprite}.png`)
  }
  for (const url of urls) {
    const img = new Image()
    img.src = url
  }
}
