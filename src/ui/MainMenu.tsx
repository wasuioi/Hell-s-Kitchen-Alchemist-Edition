import type { ReactNode } from 'react'
import { useDeckStore } from '../stores/deckStore'
import { useGameStore } from '../stores/gameStore'
import { usePlayerStore } from '../stores/playerStore'
import { useEnemyStore } from '../stores/enemyStore'
import { getRecipe } from '../data/recipes'
import type { Ingredient } from '../types'

const INGREDIENT_ICON: Record<Ingredient, string> = {
  CHILI: '/icons/chili.png',
  BOTTLE: '/icons/bottle.png',
  SALT: '/icons/salt.png',
}

const SPELL_LABEL: Record<string, string> = {
  INFERNO: 'Inferno 🔥', TIDAL_WAVE: 'Tidal Wave 🌊', SALT_SPEED: 'Salt Speed 👟',
  STEAM: 'Steam 💨', METEOR: 'Meteor ☄️', MUD: 'Mud 🟫',
}

const RECIPES: Array<[Ingredient, Ingredient]> = [
  ['CHILI', 'CHILI'],
  ['BOTTLE', 'BOTTLE'],
  ['SALT', 'SALT'],
  ['CHILI', 'BOTTLE'],
  ['CHILI', 'SALT'],
  ['BOTTLE', 'SALT'],
]

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-block',
      minWidth: '64px',
      padding: '3px 10px',
      background: 'rgba(245, 158, 11, 0.12)',
      border: '1px solid rgba(245, 158, 11, 0.35)',
      borderRadius: '4px',
      color: '#fbbf24',
      fontSize: '11px',
      fontWeight: 600,
      textAlign: 'center',
      fontFamily: 'inherit',
      letterSpacing: '1px',
    }}>{children}</kbd>
  )
}

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

      <div style={{
        marginTop: '16px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        columnGap: '16px',
        rowGap: '6px',
        color: '#9ca3af',
        fontSize: '12px',
        letterSpacing: '1px',
        alignItems: 'center',
      }}>
        <Key>WASD</Key><span>Move</span>
        <Key>Shift</Key><span>Dash <span style={{ color: '#6b7280' }}>— dodges through enemies</span></span>
        <Key>1 / 2 / 3</Key><span>Slot ingredient <span style={{ color: '#6b7280' }}>(or J / K / L)</span></span>
        <Key>Space</Key><span>Cook the cauldron</span>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '12px 18px',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '8px',
      }}>
        <div style={{
          color: '#fbbf24',
          fontSize: '11px',
          fontWeight: 'bold',
          letterSpacing: '2px',
          textAlign: 'center',
          marginBottom: '8px',
        }}>
          RECIPE BOOK
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, auto)',
          columnGap: '24px',
          rowGap: '6px',
          color: '#d1d5db',
          fontSize: '12px',
        }}>
          {RECIPES.map(([a, b]) => (
            <div key={`${a}+${b}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <img src={INGREDIENT_ICON[a]} alt={a} width={22} height={22} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>+</span>
              <img src={INGREDIENT_ICON[b]} alt={b} width={22} height={22} style={{ objectFit: 'contain' }} />
              <span style={{ color: '#6b7280' }}>=</span>
              <span style={{ color: '#fcd34d', fontWeight: 'bold' }}>
                {SPELL_LABEL[getRecipe(a, b)] ?? getRecipe(a, b)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p style={{
        color: '#6b7280',
        fontSize: '11px',
        marginTop: '12px',
        letterSpacing: '1px',
      }}>
        Survive 7 waves &nbsp;·&nbsp; pick a perk between each &nbsp;·&nbsp; defeat the Hungry Golem
      </p>
    </div>
  )
}
