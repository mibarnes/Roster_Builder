import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { loadPlayerPipeline } from '../../data/pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from '../../data/mapPipelineToUI.ts'
import { buildPosGroupRows, computeGroupWins } from './comparisonMath.ts'
import { groupPlayersBySide } from './positionGrouping.ts'
import PositionDepthView from './PositionDepthView.tsx'

describe('comparison on real pilot data (florida vs miami)', () => {
  it('computes position-group rows + group wins without throwing', async () => {
    const [fl, mia] = await Promise.all([
      loadPlayerPipeline('florida-gators', 'bundled'),
      loadPlayerPipeline('miami-hurricanes', 'bundled'),
    ])
    const left = mapPipelineToUI(fl.pipeline)
    const right = mapPipelineToUI(mia.pipeline)

    const rows = buildPosGroupRows(left, right)
    expect(rows).toHaveLength(9)
    // At least some groups have real rated starters on both pilots.
    const rated = rows.filter((r) => r.lStarterOvr != null && r.rStarterOvr != null)
    expect(rated.length).toBeGreaterThan(0)

    const wins = computeGroupWins(rows)
    expect(wins.l + wins.r + wins.e).toBe(9)
  })

  it('groups a pilot roster by position side for the depth view', async () => {
    const fl = await loadPlayerPipeline('florida-gators', 'bundled')
    const ui = mapPipelineToUI(fl.pipeline)
    const offGroups = groupPlayersBySide(ui.allPlayers, 'ALL_OFFENSE')
    expect(offGroups.some((g) => g.players.length > 0)).toBe(true)
  })

  it('renders PositionDepthView groups for a pilot', async () => {
    const fl = await loadPlayerPipeline('florida-gators', 'bundled')
    const ui = mapPipelineToUI(fl.pipeline)
    render(<PositionDepthView allPlayers={ui.allPlayers} onPlayerClick={() => {}} side="ALL_OFFENSE" />)
    // Group headers render (QB / OL labels are always present as panels).
    expect(screen.getAllByText('QB').length).toBeGreaterThan(0)
    expect(screen.getAllByText('OL').length).toBeGreaterThan(0)
  })
})
