import { loadPlayerPipeline } from './data/pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from './data/mapPipelineToUI.ts'

/**
 * End-to-end data path: loadPlayerPipeline drives the real lazy per-team JSON
 * loader (import.meta.glob, Vite-powered under vitest) → buildPlayerPipeline →
 * mapPipelineToUI. Proves both pilots produce a populated UI dataset from their
 * real committed data.
 */
describe('pilot data path (bundled)', () => {
  it.each(['florida-gators', 'miami-hurricanes'])(
    '%s loads real players, starters, and a UI formation',
    async (teamId) => {
      const loaded = await loadPlayerPipeline(teamId, 'bundled')
      expect(loaded.warnings).toEqual([])
      expect(loaded.pipeline.players.length).toBeGreaterThan(80)
      expect(loaded.pipeline.starters.length).toBeGreaterThan(20)
      // Derived OVR present on at least some players.
      expect(loaded.pipeline.players.some((p) => typeof p.ratings.overall === 'number')).toBe(true)

      const ui = mapPipelineToUI(loaded.pipeline)
      expect(ui.allPlayers.length).toBe(loaded.pipeline.players.length)
      const offenseFilled = Object.values(ui.offensiveStarters).some((slot) => slot.length > 0)
      const defenseFilled = Object.values(ui.defensiveStarters).some((slot) => slot.length > 0)
      expect(offenseFilled).toBe(true)
      expect(defenseFilled).toBe(true)
    },
  )
})
