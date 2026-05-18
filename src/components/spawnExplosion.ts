export function spawnExplosion(x: number, z: number, chainDepth = 0) {
  window.__spawnExplosion?.({ x, z, chainDepth })
}
