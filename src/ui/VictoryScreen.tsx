import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'

export default function VictoryScreen() {
  const stats = useGameStore((s) => s.stats)
  const currentWave = useGameStore((s) => s.currentWave)

  const bestCombo = Math.max(0, ...Object.values(stats.spellsCast))

  function resetAll() {
    useGameStore.getState().reset()
    useDeckStore.getState().reset()
    usePlayerStore.getState().reset()
    useEnemyStore.getState().reset()
  }

  function oneMoreRun() {
    resetAll()
    useDeckStore.getState().initHand()
    useGameStore.getState().startShift()
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px dashed rgba(0,0,0,0.3)', gap: '48px',
  }

  const labelStyle: React.CSSProperties = { fontSize: '14px', color: '#374151' }
  const valueStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 'bold', color: '#111827' }

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.9)', zIndex: 20,
      animation: 'fadeIn 0.6s ease-in',
    }}>
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {/* Receipt card */}
      <div style={{
        background: '#fefce8', borderRadius: '4px', padding: '32px 40px',
        minWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        fontFamily: 'monospace',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px' }}>* * *</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a', marginTop: '4px' }}>
            SHIFT COMPLETE
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>The Hungry Golem has been defeated!</div>
        </div>

        {/* Stats rows */}
        <div>
          <div style={rowStyle}>
            <span style={labelStyle}>Waves Cleared</span>
            <span style={valueStyle}>{currentWave}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Ingredients Used</span>
            <span style={valueStyle}>{stats.ingredientsUsed}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Enemies Defeated</span>
            <span style={valueStyle}>{stats.enemiesDefeated}</span>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <span style={labelStyle}>Best Combo</span>
            <span style={valueStyle}>{bestCombo}x</span>
          </div>
        </div>

        <div style={{ borderTop: '2px solid #111827', marginTop: '16px', paddingTop: '12px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
          Congratulations, Chef!
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
        <button
          onClick={oneMoreRun}
          style={{
            padding: '14px 28px', background: '#f59e0b', border: 'none', borderRadius: '8px',
            color: 'white', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 0 16px rgba(245,158,11,0.5)',
          }}
        >
          ONE MORE RUN
        </button>
        <button
          onClick={resetAll}
          style={{
            padding: '14px 28px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '16px', cursor: 'pointer',
          }}
        >
          Back to Menu
        </button>
      </div>
    </div>
  )
}
