import { useMemo } from 'react'
import * as THREE from 'three'

const SKYDOME_RADIUS = 80
const TEX_W = 1024
const TEX_H = 512

// Procedural panorama drawn into a canvas — same approach as Arena floor/walls,
// no external image assets. Maps onto a back-faced sphere so the player sees
// the inside of a dome painted with a hellscape silhouette.
function createSkydomeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')!

  // Horizon (v=0.5 of texture) maps to the sphere's equator (y=0 in world).
  const HORIZON = TEX_H / 2

  // Upper sky — dark zenith fading to deep blood-red at the horizon
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON)
  skyGrad.addColorStop(0, '#0a0508')
  skyGrad.addColorStop(0.7, '#1a0a06')
  skyGrad.addColorStop(1, '#3a0a02')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, TEX_W, HORIZON)

  // Below-horizon (rarely visible; arena floor covers it) — fade to black
  const groundGrad = ctx.createLinearGradient(0, HORIZON, 0, TEX_H)
  groundGrad.addColorStop(0, '#3a0a02')
  groundGrad.addColorStop(1, '#000000')
  ctx.fillStyle = groundGrad
  ctx.fillRect(0, HORIZON, TEX_W, TEX_H - HORIZON)

  // Bright orange-red horizon glow band (matches FLOOR_BASE_EMISSIVE)
  const glowGrad = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 20)
  glowGrad.addColorStop(0, 'rgba(58, 10, 2, 0)')
  glowGrad.addColorStop(0.6, 'rgba(255, 68, 8, 0.9)')
  glowGrad.addColorStop(1, 'rgba(255, 100, 30, 0.5)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, HORIZON - 30, TEX_W, 50)

  // Silhouettes along the horizon — chimneys, furnaces, towers, with gaps.
  // Stored as draw commands first so we can paint glowing windows after the
  // black silhouette without having the windows clipped by neighbours.
  type Furnace = { x: number; w: number; h: number }
  const furnaces: Furnace[] = []

  ctx.fillStyle = '#000000'
  let x = 0
  while (x < TEX_W) {
    const type = Math.random()
    if (type < 0.4) {
      // Chimney — tall thin rectangle
      const w = 8 + Math.random() * 12
      const h = 60 + Math.random() * 80
      ctx.fillRect(x, HORIZON - h, w, h)
      x += w + 4 + Math.random() * 30
    } else if (type < 0.75) {
      // Furnace — rectangle body with triangular roof
      const w = 40 + Math.random() * 60
      const h = 30 + Math.random() * 40
      ctx.fillRect(x, HORIZON - h, w, h)
      ctx.beginPath()
      ctx.moveTo(x, HORIZON - h)
      ctx.lineTo(x + w / 2, HORIZON - h - 15 - Math.random() * 15)
      ctx.lineTo(x + w, HORIZON - h)
      ctx.closePath()
      ctx.fill()
      furnaces.push({ x, w, h })
      x += w + 6 + Math.random() * 40
    } else {
      // Gap — empty stretch of horizon
      x += 30 + Math.random() * 60
    }
  }

  // Glowing windows on furnaces — radial orange-yellow blobs
  for (const f of furnaces) {
    const wgw = 6 + Math.random() * 8
    const wgh = 8 + Math.random() * 8
    const wgx = f.x + f.w * (0.2 + Math.random() * 0.6)
    const wgy = HORIZON - f.h * (0.3 + Math.random() * 0.4)
    const cx = wgx + wgw / 2
    const cy = wgy + wgh / 2
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, wgw * 1.6)
    grad.addColorStop(0, 'rgba(255, 200, 100, 0.95)')
    grad.addColorStop(0.5, 'rgba(255, 120, 40, 0.6)')
    grad.addColorStop(1, 'rgba(255, 80, 20, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(cx - wgw * 2, cy - wgh * 2, wgw * 4, wgh * 4)
  }

  // Smoke wisps rising from chimney tops — soft vertical ellipses
  for (let i = 0; i < 22; i++) {
    const sx = Math.random() * TEX_W
    const baseY = HORIZON - 70 - Math.random() * 50
    const topY = baseY - 60 - Math.random() * 100
    const w = 20 + Math.random() * 40
    const grad = ctx.createLinearGradient(sx, baseY, sx, topY)
    grad.addColorStop(0, 'rgba(60, 50, 45, 0.45)')
    grad.addColorStop(1, 'rgba(60, 50, 45, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(sx, (baseY + topY) / 2, w, (baseY - topY) / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Embers — tiny orange-yellow sparks scattered through the upper sky
  for (let i = 0; i < 90; i++) {
    const ex = Math.random() * TEX_W
    const ey = Math.random() * (HORIZON - 30)
    const r = 0.5 + Math.random() * 1.5
    const alpha = 0.35 + Math.random() * 0.55
    const g = 140 + Math.floor(Math.random() * 80)
    ctx.fillStyle = `rgba(255, ${g}, 60, ${alpha})`
    ctx.beginPath()
    ctx.arc(ex, ey, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

export default function Skydome() {
  const tex = useMemo(() => createSkydomeTexture(), [])
  return (
    <mesh>
      <sphereGeometry args={[SKYDOME_RADIUS, 32, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} />
    </mesh>
  )
}
