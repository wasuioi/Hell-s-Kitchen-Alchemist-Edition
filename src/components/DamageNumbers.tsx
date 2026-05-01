import { useRef, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type { DamageNumber } from '../types'

declare global {
  interface Window {
    __spawnDamageNumber?: (dmg: DamageNumber) => void
  }
}

const MAX_NUMBERS = 10
const LIFETIME = 0.8
const RISE_SPEED = 2

let nextDmgId = 0

export function spawnDamageNumber(x: number, z: number, amount: number, color: string, y: number = 1.5) {
  window.__spawnDamageNumber?.({ id: `dmg_${nextDmgId++}`, position: { x, y, z }, amount, color, createdAt: performance.now() })
}

interface DmgEntry extends DamageNumber {
  age: number
}

export default function DamageNumbers() {
  const [numbers, setNumbers] = useState<DmgEntry[]>([])
  const numbersRef = useRef<DmgEntry[]>([])

  // Register global spawner
  const addNumber = useCallback((dmg: DamageNumber) => {
    const entry: DmgEntry = { ...dmg, age: 0 }
    numbersRef.current = [...numbersRef.current, entry].slice(-MAX_NUMBERS)
    setNumbers([...numbersRef.current])
  }, [])

  // Set up global callback
  useFrame(() => {
    if (!(window as any).__spawnDamageNumber) {
      (window as any).__spawnDamageNumber = addNumber
    }
  })

  // Animate positions
  useFrame((_, delta) => {
    let changed = false
    const alive: DmgEntry[] = []
    for (const n of numbersRef.current) {
      n.age += delta
      n.position.y += RISE_SPEED * delta
      if (n.age < LIFETIME) {
        alive.push(n)
      } else {
        changed = true
      }
    }
    if (changed || alive.some((n) => n.age > 0)) {
      numbersRef.current = alive
      setNumbers([...alive])
    }
  })

  return (
    <>
      {numbers.map((n) => {
        const opacity = Math.max(0, 1 - n.age / LIFETIME)
        return (
          <Text
            key={n.id}
            position={[n.position.x, n.position.y, n.position.z]}
            fontSize={0.5}
            color={n.color}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            fillOpacity={opacity}
            outlineWidth={0.03}
            outlineColor="black"
          >
            {Math.round(n.amount)}
          </Text>
        )
      })}
    </>
  )
}
