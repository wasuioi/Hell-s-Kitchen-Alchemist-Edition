import { useGameStore } from '../stores/gameStore'
import PerkPanel from './PerkPanel'
import TierPanel from './TierPanel'
import RecipeBookPanel from './RecipeBookPanel'
import BeginWaveButton from './BeginWaveButton'

export default function RestRoom() {
  const currentWave = useGameStore((s) => s.currentWave)
  const isPreBoss = currentWave >= 7

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', zIndex: 20,
      overflowY: 'auto', padding: '24px 16px', gap: '24px',
    }}>
      <h1 style={{ color: '#fcd34d', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>
        REST ROOM — Wave {currentWave} cleared
      </h1>

      <div style={{
        display: 'flex', gap: '40px', alignItems: 'flex-start',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <PerkPanel />
        <RecipeBookPanel variant="rest-room" />
      </div>

      {!isPreBoss && <TierPanel />}

      <BeginWaveButton />
    </div>
  )
}
