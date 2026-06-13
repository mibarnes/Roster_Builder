import { loadPlayerPipeline } from './pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from './mapPipelineToUI.ts'

/**
 * H1 hardening — surface already-collected, zod-validated data:
 *  H1.1 team returning-production summary (context.json)
 *  H1.2 full usage/PPA detail on the UI player (advanced.json)
 *  H1.3 per-game log threaded to the UI player (production.json)
 *
 * Pilot under test: florida-gators (ships the enriched context/advanced/perGame).
 * DJ Lagway (CFBD-5079555) is a known contributor with all three.
 */
describe('H1 surfaced data (florida-gators pilot)', () => {
  it('H1.1 — exposes the team returning-production summary for a pilot', async () => {
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'bundled')
    const rp = pipeline.returningProduction
    expect(rp).not.toBeNull()
    // Real file value (CFBD /player/returning): 0.55 overall PPA.
    expect(rp!.percentPPA).toBeCloseTo(0.55, 5)
    expect(rp!.percentPassingPPA).toBeCloseTo(0.73, 5)
    expect(typeof rp!.percentReceivingPPA).toBe('number')
    expect(typeof rp!.usage).toBe('number')

    // And it threads onto the UI dataset.
    const ui = mapPipelineToUI(pipeline)
    expect(ui.returningProduction).not.toBeNull()
    expect(ui.returningProduction!.percentPPA).toBeCloseTo(0.55, 5)
  })

  it('H1.2 — threads full usage + PPA splits to the UI for a contributor', async () => {
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'bundled')
    const ui = mapPipelineToUI(pipeline)
    const lagway = ui.allPlayers.find((p) => p.name === 'DJ Lagway')
    expect(lagway).toBeDefined()
    // Summary fields still present (backward-compat).
    expect(lagway!.usageOverall).not.toBeNull()
    expect(lagway!.ppaAll).not.toBeNull()
    // Full usage splits — QB has heavy pass usage + down situations.
    expect(lagway!.usage).not.toBeNull()
    expect(typeof lagway!.usage!.pass).toBe('number')
    expect(lagway!.usage!.pass!).toBeGreaterThan(0.5)
    expect(typeof lagway!.usage!.thirdDown).toBe('number')
    // Full PPA: avg + total, all/pass/rush splits.
    expect(lagway!.ppa).not.toBeNull()
    expect(typeof lagway!.ppa!.averagePPA!.all).toBe('number')
    expect(typeof lagway!.ppa!.totalPPA!.all).toBe('number')
    expect(typeof lagway!.ppa!.averagePPA!.pass).toBe('number')
  })

  it('H1.3 — threads a non-empty per-game log to the UI for a contributor', async () => {
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'bundled')
    const ui = mapPipelineToUI(pipeline)
    const lagway = ui.allPlayers.find((p) => p.name === 'DJ Lagway')!
    expect(Array.isArray(lagway.perGame)).toBe(true)
    expect(lagway.perGame!.length).toBeGreaterThan(0)
    const first = lagway.perGame![0]!
    expect(first.gameId).toBeDefined()
    expect(typeof first.stats).toBe('object')
    expect(Object.keys(first.stats).length).toBeGreaterThan(0)
  })

  it('renders null returning-production + null detail for a team without context', async () => {
    // 'mock' mode ships no context/advanced/perGame → all the new fields are null.
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'mock')
    expect(pipeline.returningProduction).toBeNull()
    const ui = mapPipelineToUI(pipeline)
    expect(ui.returningProduction).toBeNull()
    for (const p of ui.allPlayers) {
      expect(p.usage).toBeNull()
      expect(p.ppa).toBeNull()
      expect(p.perGame).toBeNull()
    }
  })
})
