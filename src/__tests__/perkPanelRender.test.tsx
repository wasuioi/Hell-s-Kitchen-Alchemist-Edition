import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useGameStore } from '../stores/gameStore'
import { useDeckStore } from '../stores/deckStore'
import PerkPanel from '../ui/PerkPanel'

describe('PerkPanel tier differential', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
    useDeckStore.getState().reset()
  })

  it('renders 1 pick remaining for mild tier (default after startShift)', () => {
    useGameStore.getState().startShift() // currentTier = 'mild'
    render(<PerkPanel />)
    expect(screen.getByText(/Picks remaining: 1 \/ 1/)).toBeInTheDocument()
  })

  it('renders 1 pick remaining for spicy tier', () => {
    useGameStore.setState({ currentTier: 'spicy' })
    render(<PerkPanel />)
    expect(screen.getByText(/Picks remaining: 1 \/ 1/)).toBeInTheDocument()
  })

  it('allows 2 picks remaining for hellfire tier', () => {
    useGameStore.setState({ currentTier: 'hellfire' })
    render(<PerkPanel />)
    expect(screen.getByText(/Picks remaining: 2 \/ 2/)).toBeInTheDocument()
  })
})
