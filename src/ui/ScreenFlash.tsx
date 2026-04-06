import { useRef, useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'

export default function ScreenFlash() {
  const screenFlashUntil = useGameStore((s) => s.screenFlashUntil)
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (screenFlashUntil <= 0 || !divRef.current) return
    const el = divRef.current
    el.style.opacity = '0.15'
    const remaining = screenFlashUntil - performance.now()
    if (remaining <= 0) { el.style.opacity = '0'; return }
    const timer = setTimeout(() => { el.style.opacity = '0' }, remaining)
    return () => clearTimeout(timer)
  }, [screenFlashUntil])

  return (
    <div
      ref={divRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'white', opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 80ms ease-out',
      }}
    />
  )
}
