import Scene from './components/Scene'
import { useGameStore } from './stores/gameStore'

export default function App() {
  const phase = useGameStore((s) => s.phase)
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Scene />
      {phase === 'menu' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
          <button onClick={() => useGameStore.getState().startShift()} style={{ padding: '16px 32px', fontSize: '24px', background: '#f59e0b', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
            START SHIFT
          </button>
        </div>
      )}
    </div>
  )
}
