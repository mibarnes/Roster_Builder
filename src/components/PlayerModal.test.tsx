import { render, screen, within } from '@testing-library/react'
import PlayerModal from './PlayerModal.tsx'
import { loadPlayerPipeline } from '../data/pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from '../data/mapPipelineToUI.ts'
import type { UIPlayer } from '../data/schema/ui.ts'

/**
 * Render test: the modal surfaces H1.2 (full usage/PPA detail) + H1.3 (game log)
 * for a real pilot contributor (DJ Lagway, florida-gators) without throwing, and
 * renders nothing extra (no crash) for a player with no advanced/per-game data.
 */
describe('PlayerModal — H1 surfaced sections', () => {
  let lagway: UIPlayer

  beforeAll(async () => {
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'bundled')
    const ui = mapPipelineToUI(pipeline)
    lagway = ui.allPlayers.find((p) => p.name === 'DJ Lagway')!
  })

  it('renders usage-by-situation + PPA splits + a game log for a contributor', () => {
    expect(lagway).toBeDefined()
    render(<PlayerModal player={lagway} onClose={() => {}} returnFocusEl={null} />)

    // H1.2 — full usage splits + PPA detail headings.
    expect(screen.getByText(/usage by situation/i)).toBeInTheDocument()
    // PPA columns (Avg / Total) present in the splits block.
    expect(screen.getByText('Avg')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()

    // H1.3 — game log table with one row per game.
    const heading = screen.getByText(/game log/i)
    expect(heading).toBeInTheDocument()
    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row')
    // header row + N game rows; Lagway played 12 games.
    expect(bodyRows.length).toBeGreaterThan(1)

    // Modal accessibility intact.
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('renders without the new sections (no crash) for a player lacking advanced/per-game data', () => {
    const bare: UIPlayer = { ...lagway, usage: null, ppa: null, perGame: null, usageOverall: null, ppaAll: null }
    render(<PlayerModal player={bare} onClose={() => {}} returnFocusEl={null} />)
    expect(screen.queryByText(/usage by situation/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/game log/i)).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
