// Thin wrapper around the global VFX spawn hooks set up by 3D components.
// Kept in its own file so utilities (e.g. perkTriggers.ts) can call it
// without dragging the whole Three.js dependency tree into unit tests.
//
// In a unit-test environment the global is undefined and these calls become
// safe no-ops.

declare global {
  interface Window {
    __spawnExplosion?: (arg: { x: number; z: number; chainDepth?: number }) => void
  }
}

export function spawnExplosionVfx(x: number, z: number, chainDepth = 0): void {
  if (typeof window === 'undefined') return
  window.__spawnExplosion?.({ x, z, chainDepth })
}
