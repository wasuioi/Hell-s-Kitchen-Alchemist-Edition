import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../stores/gameStore'

describe('gameStore juice', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
  })

  it('triggerScreenShake sets shake state', () => {
    useGameStore.getState().triggerScreenShake(0.6, 200)
    const state = useGameStore.getState()
    expect(state.shakeIntensity).toBe(0.6)
    expect(state.shakeEndTime).toBeGreaterThan(0)
  })

  it('stronger shake overrides weaker one', () => {
    useGameStore.getState().triggerScreenShake(0.3, 150)
    const firstEnd = useGameStore.getState().shakeEndTime
    useGameStore.getState().triggerScreenShake(0.6, 200)
    expect(useGameStore.getState().shakeIntensity).toBe(0.6)
    expect(useGameStore.getState().shakeEndTime).toBeGreaterThanOrEqual(firstEnd)
  })

  it('weaker shake does not override stronger one', () => {
    useGameStore.getState().triggerScreenShake(0.6, 200)
    const strongEnd = useGameStore.getState().shakeEndTime
    useGameStore.getState().triggerScreenShake(0.3, 150)
    expect(useGameStore.getState().shakeIntensity).toBe(0.6)
    expect(useGameStore.getState().shakeEndTime).toBe(strongEnd)
  })

  it('triggerHitFreeze sets timeScale and freezeUntil', () => {
    useGameStore.getState().triggerHitFreeze(60)
    const state = useGameStore.getState()
    expect(state.timeScale).toBe(0.05)
    expect(state.freezeUntil).toBeGreaterThan(0)
  })

  it('triggerScreenFlash sets flash state', () => {
    useGameStore.getState().triggerScreenFlash()
    expect(useGameStore.getState().screenFlashUntil).toBeGreaterThan(0)
  })

  it('reset clears juice state', () => {
    useGameStore.getState().triggerScreenShake(1, 300)
    useGameStore.getState().triggerScreenFlash()
    useGameStore.getState().reset()
    const state = useGameStore.getState()
    expect(state.shakeIntensity).toBe(0)
    expect(state.shakeEndTime).toBe(0)
    expect(state.freezeUntil).toBe(0)
    expect(state.screenFlashUntil).toBe(0)
  })
})

describe('useGameStore', () => {
  beforeEach(() => { useGameStore.getState().reset() })
  it('starts in menu phase', () => { expect(useGameStore.getState().phase).toBe('menu') })
  it('startShift transitions to combat phase and resets wave to 1', () => {
    useGameStore.getState().startShift()
    expect(useGameStore.getState().phase).toBe('combat')
    expect(useGameStore.getState().currentWave).toBe(1)
  })
  it('completeWave goes to reward phase', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    expect(useGameStore.getState().phase).toBe('reward')
    expect(useGameStore.getState().stats.wavesCleared).toBe(1)
  })
  it('nextWave transitions from reward to combat', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    useGameStore.getState().nextWave()
    expect(useGameStore.getState().phase).toBe('combat')
    expect(useGameStore.getState().currentWave).toBe(2)
  })
  it('triggerDeath sets phase to death and timeScale to 0.2', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().triggerDeath()
    expect(useGameStore.getState().phase).toBe('death')
    expect(useGameStore.getState().timeScale).toBe(0.2)
  })
  it('startBoss sets phase to boss', () => {
    useGameStore.getState().startShift()
    useGameStore.setState({ currentWave: 7 })
    useGameStore.getState().startBoss()
    expect(useGameStore.getState().phase).toBe('boss')
  })
  it('tracks enemiesDefeated stat', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().recordEnemyDefeated()
    useGameStore.getState().recordEnemyDefeated()
    expect(useGameStore.getState().stats.enemiesDefeated).toBe(2)
  })
  it('tracks ingredientsUsed stat', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().recordIngredientUsed()
    expect(useGameStore.getState().stats.ingredientsUsed).toBe(1)
  })
  it('skipReward advances wave and returns to combat without applying perk', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    const waveBefore = useGameStore.getState().currentWave
    useGameStore.getState().skipReward()
    expect(useGameStore.getState().phase).toBe('combat')
    expect(useGameStore.getState().currentWave).toBe(waveBefore + 1)
  })
  it('skipReward from reward phase increments wave by 1 (same as nextWave)', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().completeWave()
    const waveAfterSkip = useGameStore.getState().currentWave + 1
    useGameStore.getState().skipReward()
    expect(useGameStore.getState().currentWave).toBe(waveAfterSkip)
  })
  it('reset returns to initial state', () => {
    useGameStore.getState().startShift()
    useGameStore.getState().recordEnemyDefeated()
    useGameStore.getState().reset()
    expect(useGameStore.getState().phase).toBe('menu')
    expect(useGameStore.getState().currentWave).toBe(0)
    expect(useGameStore.getState().stats.enemiesDefeated).toBe(0)
  })
})
