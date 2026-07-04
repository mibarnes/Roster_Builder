/**
 * F6 smoke — the two cross-team surfaces render from the committed league
 * artifacts + real team data without throwing (guards against a MetaField/shape
 * leak reaching a React child, which is how the first build broke).
 */
import { render, screen } from '@testing-library/react'
import LeagueView from './league/LeagueView.tsx'
import TeamHQ from './hq/TeamHQ.tsx'
import { loadPlayerPipeline } from '../data/pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from '../data/mapPipelineToUI.ts'

describe('LeagueView', () => {
  it('renders the 54-team board + portal flow', () => {
    render(<LeagueView onBack={() => {}} onTeamClick={() => {}} />)
    expect(screen.getByText('LEAGUE')).toBeInTheDocument()
    expect(screen.getAllByText('Georgia Bulldogs').length).toBeGreaterThan(0)
    expect(screen.getByText(/TRANSFER PORTAL FLOW/)).toBeInTheDocument()
  })
})

describe('TeamHQ', () => {
  it('renders the four intelligence panels for a real team', async () => {
    const { pipeline } = await loadPlayerPipeline('georgia-bulldogs')
    const ui = mapPipelineToUI(pipeline)
    render(<TeamHQ teamId="georgia-bulldogs" uiData={ui} metrics={pipeline.metrics} onPlayerClick={() => {}} />)
    expect(screen.getByText('Strength vs league')).toBeInTheDocument()
    expect(screen.getByText('Roster construction')).toBeInTheDocument()
    expect(screen.getByText('Transfer portal ledger')).toBeInTheDocument()
    expect(screen.getByText('Returning production')).toBeInTheDocument()
  })
})
