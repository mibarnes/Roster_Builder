import { loadPlayerPipeline } from './pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from './mapPipelineToUI.ts'
import { TEAMS } from './teamRegistry.ts'

/** Broaden check (M5): every registry team loads + maps without throwing. */
describe('all registry teams load (honest-partial)', () => {
  it.each(TEAMS.map((t) => t.id))('%s loads + maps to UI', async (teamId) => {
    const loaded = await loadPlayerPipeline(teamId)
    expect(loaded.warnings).toEqual([]) // all registry teams have real collected data; none should fall back
    const ui = mapPipelineToUI(loaded.pipeline)
    expect(ui.allPlayers.length).toBeGreaterThan(0)
  })
})
