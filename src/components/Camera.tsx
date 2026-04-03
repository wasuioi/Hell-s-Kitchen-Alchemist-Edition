import { useFrame, useThree } from '@react-three/fiber'
import { usePlayerStore } from '../stores/playerStore'
import * as THREE from 'three'

const CAMERA_HEIGHT = 18
const CAMERA_OFFSET_Z = 10
const CAMERA_LERP_SPEED = 0.08

export default function Camera() {
  const { camera } = useThree()
  useFrame(() => {
    const { position } = usePlayerStore.getState()
    camera.position.x += (position.x - camera.position.x) * CAMERA_LERP_SPEED
    camera.position.z += (position.z + CAMERA_OFFSET_Z - camera.position.z) * CAMERA_LERP_SPEED
    camera.position.y = CAMERA_HEIGHT
    camera.lookAt(new THREE.Vector3(position.x, 0, position.z))
  })
  return null
}
