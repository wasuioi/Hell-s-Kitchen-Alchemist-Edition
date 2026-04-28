// Thin wrapper around the global VFX spawn hooks set up by 3D components.
// Kept in its own file so utilities (e.g. perkTriggers.ts) can call it
// without dragging the whole Three.js dependency tree into unit tests.
//
// In a unit-test environment the global is undefined and these calls become
// safe no-ops.

declare global {
  interface Window {
    __spawnExplosion?: (arg: { x: number; z: number; chainDepth?: number }) => void
    __spawnSpriteVfx?: (arg: { x: number; z: number; spriteSlug: string }) => void
  }
}

export function spawnExplosionVfx(x: number, z: number, chainDepth = 0): void {
  if (typeof window === 'undefined') return
  window.__spawnExplosion?.({ x, z, chainDepth })
}

// Plays a sprite-sheet VFX at the given position. The sprite sheet must
// live at `public/vfx/<slug>.png` and follow the 4×4 / 16-frame format
// expected by SpriteVfxEffect (see that file for details).
export function spawnSpriteVfx(slug: string, x: number, z: number): void {
  if (typeof window === 'undefined') return
  window.__spawnSpriteVfx?.({ x, z, spriteSlug: slug })
}
