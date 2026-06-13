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
  let players: UIPlayer[]

  beforeAll(async () => {
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'bundled')
    const ui = mapPipelineToUI(pipeline)
    players = ui.allPlayers
    lagway = players.find((p) => p.name === 'DJ Lagway')!
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

/**
 * Pilot-deepening (P4 UI): the modal surfaces the golden-master overlay —
 * headshot, bio enrichment (HS / hometown), transfer & walk-on & new-2026 chips,
 * the "data conflict" affordance, and the 2025 production labeling (with an honest
 * empty state for new-in-2026 players). All fixtures are REAL florida-gators
 * players loaded through the pipeline — no fabricated data.
 */
describe('PlayerModal — P4 golden-master overlay', () => {
  let players: UIPlayer[]

  beforeAll(async () => {
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'bundled')
    players = mapPipelineToUI(pipeline).allPlayers
  })

  it('renders a headshot, high school, and 2025-labeled stats for a real contributor', () => {
    // TJ Abrams: has an ESPN headshot, a high school, and 2025 production (8 games).
    const abrams = players.find((p) => p.name === 'TJ Abrams')!
    expect(abrams).toBeDefined()
    expect(abrams.headshotUrl).toBeTruthy()
    expect(abrams.highSchool).toBeTruthy()

    render(<PlayerModal player={abrams} onClose={() => {}} returnFocusEl={null} />)

    // Headshot rendered as an <img> with the player's name in the alt text.
    const img = screen.getByAltText(/tj abrams headshot/i)
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('loading', 'lazy')

    // Bio block surfaces the high school.
    expect(screen.getByText(/high school/i)).toBeInTheDocument()
    expect(screen.getByText(abrams.highSchool!)).toBeInTheDocument()

    // Production is labeled as the 2025 (prior) season.
    expect(screen.getByText(/2025 season stats/i)).toBeInTheDocument()
  })

  it('shows the honest "no 2025 data (new in 2026)" state for a new-2026 player', () => {
    // Dylan Leighton: new in 2026, no 2025 CFBD production.
    const leighton = players.find((p) => p.name === 'Dylan Leighton')!
    expect(leighton).toBeDefined()
    expect(leighton.newIn2026).toBe(true)

    render(<PlayerModal player={leighton} onClose={() => {}} returnFocusEl={null} />)

    expect(screen.getByText(/new 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/no 2025 data \(new in 2026\)/i)).toBeInTheDocument()
    // No fabricated season-stats grid for a player with no production.
    expect(screen.queryByText(/2025 season stats/i)).not.toBeInTheDocument()
  })

  it('shows the data-conflict affordance listing the conflicting fields', () => {
    // Jadan Baugh: sources disagreed on class year.
    const baugh = players.find((p) => p.conflictFields.includes('classYear'))!
    expect(baugh).toBeDefined()

    render(<PlayerModal player={baugh} onClose={() => {}} returnFocusEl={null} />)

    const chip = screen.getByText(/conflict/i)
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveAttribute('title', expect.stringMatching(/sources disagree: .*class year/i))
  })

  it('renders a transfer chip with the origin school for a portal transfer', () => {
    // Harrison Bailey: transfer in from Louisville.
    const bailey = players.find((p) => p.isTransfer && p.fromSchool === 'Louisville')!
    expect(bailey).toBeDefined()

    render(<PlayerModal player={bailey} onClose={() => {}} returnFocusEl={null} />)
    expect(screen.getByText(/transfer · louisville/i)).toBeInTheDocument()
  })

  it('falls back to an initials chip (role=img) when no headshot is present', () => {
    // Brian Case: walk-on with no headshot — graceful fallback, walk-on chip.
    const woNoShot = players.find((p) => p.isWalkOn && !p.headshotUrl)!
    expect(woNoShot).toBeDefined()

    render(<PlayerModal player={woNoShot} onClose={() => {}} returnFocusEl={null} />)
    // Fallback is an accessible role=img (not a broken <img>).
    expect(screen.getByRole('img', { name: /no photo/i })).toBeInTheDocument()
    expect(screen.getByText(/walk-on/i)).toBeInTheDocument()
  })
})
