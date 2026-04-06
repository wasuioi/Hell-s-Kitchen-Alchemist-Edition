import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'

export default function ScreenFlash() {
  const screenFlashUntil = useGameStore((s) => s.screenFlashUntil)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (screenFlashUntil <= 0) return
    setVisible(true)
    const remaining = screenFlashUntil - performance.now()
    if (remaining <= 0) { setVisible(false); return }
    const timer = setTimeout(() => setVisible(false), remaining)
    return () => clearTimeout(timer)
  }, [screenFlashUntil])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'white', opacity: 0.15,
      pointerEvents: 'none',
      transition: 'opacity 80ms ease-out',
    }} />
  )
}
