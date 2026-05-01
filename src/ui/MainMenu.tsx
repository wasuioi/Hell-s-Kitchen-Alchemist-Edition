import { useDeckStore } from '../stores/deckStore'
import { useGameStore } from '../stores/gameStore'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'

export default function MainMenu() {
  function handleStart() {
    usePlayerStore.getState().reset()
    useEnemyStore.getState().reset()
    useDeckStore.getState().reset()
    useDeckStore.getState().initHand()
    useGameStore.getState().startShift()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)',
      zIndex: 10,
      gap: '16px',
    }}>
      <img
        src="/ui/logo.png"
        alt="Hell's Kitchen: Alchemist Edition"
        style={{
          width: 'min(640px, 80vw)',
          height: 'auto',
          mixBlendMode: 'screen',
          filter: 'drop-shadow(0 0 30px rgba(245, 158, 11, 0.4))',
        }}
      />

      <p style={{
        color: '#9ca3af',
        fontSize: '14px',
        maxWidth: '380px',
        textAlign: 'center',
        lineHeight: '1.6',
        margin: '8px 0',
      }}>
        Combine ingredients in your cauldron to unleash magical recipes. Survive wave after wave, defeat the Hungry Golem, and prove your alchemical mastery.
      </p>

      <div style={{ display: 'flex', gap: '20px', margin: '4px 0' }}>
        <img src="/icons/chili.png" alt="Chili" title="Chili" width={56} height={56} style={{ objectFit: 'contain' }} />
        <img src="/icons/bottle.png" alt="Bottle" title="Bottle" width={56} height={56} style={{ objectFit: 'contain' }} />
        <img src="/icons/salt.png" alt="Salt" title="Salt" width={56} height={56} style={{ objectFit: 'contain' }} />
      </div>

      <button
        onClick={handleStart}
        style={{
          marginTop: '8px',
          padding: '14px 40px',
          fontSize: '20px',
          fontWeight: 'bold',
          background: '#f59e0b',
          border: 'none',
          borderRadius: '8px',
          color: '#1c1917',
          cursor: 'pointer',
          letterSpacing: '2px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#d97706' }}
        onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#f59e0b' }}
      >
        START SHIFT
      </button>

      <p style={{
        color: '#6b7280',
        fontSize: '12px',
        marginTop: '12px',
        letterSpacing: '1px',
      }}>
        WASD to move &nbsp;·&nbsp; 1/2/3 or J/K/L to slot ingredients &nbsp;·&nbsp; Space to cook
      </p>
    </div>
  )
}
