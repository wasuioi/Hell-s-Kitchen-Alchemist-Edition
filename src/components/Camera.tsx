import { useFrame, useThree } from '@react-three/fiber'
import { usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import * as THREE from 'three'

const CAMERA_HEIGHT = 18
const CAMERA_OFFSET_Z = 10
const CAMERA_LERP_SPEED = 0.08
const DEFAULT_FOV = 75
const FREEZE_FOV = 68

export default function Camera() {
  const { camera } = useThree()
  useFrame(() => {
    const { position } = usePlayerStore.getState()
    const { shakeIntensity, shakeEndTime, checkHitFreezeExpiry, freezeUntil, timeScale } = useGameStore.getState()

    // Check if hit freeze should expire (uses real-world time)
    checkHitFreezeExpiry()

    // Adaptive zoom: zoom in during hit freeze, spring back out
    const perspCam = camera as THREE.PerspectiveCamera
    const isFrozen = timeScale === 0.05 && freezeUntil > 0
    const targetFov = isFrozen ? FREEZE_FOV : DEFAULT_FOV
    const zoomLerp = isFrozen ? 0.15 : 0.06
    if (Math.abs(perspCam.fov - targetFov) > 0.01) {
      perspCam.fov += (targetFov - perspCam.fov) * zoomLerp
      perspCam.updateProjectionMatrix()
    }

    // Smooth follow
    camera.position.x += (position.x - camera.position.x) * CAMERA_LERP_SPEED
    camera.position.z += (position.z + CAMERA_OFFSET_Z - camera.position.z) * CAMERA_LERP_SPEED
    camera.position.y = CAMERA_HEIGHT

    // Screen shake offset
    const now = performance.now()
    if (now < shakeEndTime && shakeIntensity > 0) {
      const remaining = (shakeEndTime - now) / 300 // decay over max duration
      const decay = Math.min(1, remaining)
      const offsetX = (Math.random() - 0.5) * 2 * shakeIntensity * decay
      const offsetZ = (Math.random() - 0.5) * 2 * shakeIntensity * decay
      camera.position.x += offsetX
      camera.position.z += offsetZ
    }

    camera.lookAt(new THREE.Vector3(position.x, 0, position.z))
  })
  return null
}
