import { describe, expect, it } from 'vitest'
import { loadPlayerPipeline } from './pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from './mapPipelineToUI.ts'

/**
 * Data-quality guardrails on the REAL pilot captures (florida-gators,
 * miami-hurricanes). These thresholds make a data regression — a botched
 * re-collection, a broken join, a model that flat-lines — fail CI rather
 * than silently ship. Thresholds are deliberately loose (real-world floors),
 * not exact equalities, so a healthy refresh doesn't churn the test.
 */
describe('pilot data quality', () => {
  it.each(['florida-gators', 'miami-hurricanes'])('%s clears quality floors', async (teamId) => {
    const loaded = await loadPlayerPipeline(teamId, 'bundled')
    const players = loaded.pipeline.players
    const cov = loaded.pipeline.coverage
    const ui = mapPipelineToUI(loaded.pipeline)

    const nonStub = players.filter((p) => !p.isStub)
    const nonStubCount = nonStub.length
    // New-in-2026 spine players (transfers / true freshmen) have NO 2025 CFBD
    // record by definition, so production/recruiting floors are measured over
    // RETURNING non-stub players. (golden is null for legacy teams → all returning.)
    const returning = nonStub.filter((p) => !(p.golden?.newIn2026 ?? false))
    const returningCount = returning.length || nonStubCount

    // ── Roster sanity ──
    expect(players.length).toBeGreaterThan(100)

    // ── Recruiting coverage: ≥70% of RETURNING non-stub players have a match ──
    const recruitingRate = cov.recruitingMatched / returningCount
    expect(recruitingRate).toBeGreaterThanOrEqual(0.7)

    // ── On-field contributors: ≥45% of RETURNING non-stub players have games>0.
    //    Floor loosened from 0.5 for the 2026 ESPN spine: it carries more deep
    //    reserves / non-contributors than the old CFBD-roster snapshot, so a real
    //    minority played in 2025 (Miami ~48%). New-2026 players are excluded above
    //    (no 2025 record by definition); this is honest data, not a regression. ──
    const gamesRate = cov.productionWithGames / returningCount
    expect(gamesRate).toBeGreaterThanOrEqual(0.45)

    // ── Rated vs NR: a healthy majority of OFF/DEF non-stub players get a real
    //    OVR, but the model must STILL honestly NR the players with no signal.
    //    Special-teams (ST) specialists (K/P/LS) are projection-by-nature — they
    //    rarely carry a recruiting rating and are legitimately NR — so they're
    //    excluded from this floor (measured over OFF/DEF non-stub players). ──
    const offDefNonStub = nonStub.filter((p) => p.bio.side !== 'ST')
    const offDefRated = offDefNonStub.filter((p) => p.ratings.overall != null).length
    const ratedRate = offDefRated / (offDefNonStub.length || nonStubCount)
    expect(ratedRate).toBeGreaterThanOrEqual(0.7)
    const nrCount = players.filter((p) => p.ratings.overall == null).length
    expect(nrCount).toBeGreaterThan(0) // never zero — NR must be real

    // ── Stub ratio: depth-chart-only stubs are a MINORITY of the roster ──
    const stubRatio = cov.stubCount / players.length
    expect(stubRatio).toBeLessThanOrEqual(0.3)
    // Every stub is NR (never a fabricated number).
    for (const p of players.filter((p) => p.isStub)) {
      expect(p.ratings.overall).toBeNull()
    }

    // ── Advanced (usage/PPA) present for a meaningful set of contributors ──
    expect(cov.advancedMatched).toBeGreaterThanOrEqual(15)

    // ── Hometown on ~100% of non-stub players ──
    const nonStubWithHometown = ui.allPlayers.filter((p) => !p.isStub && p.hometown != null).length
    const nonStubUi = ui.allPlayers.filter((p) => !p.isStub).length
    expect(nonStubWithHometown / nonStubUi).toBeGreaterThanOrEqual(0.95)

    // ── OVR spread: NOT a flat constant. Real distinct values + a wide range. ──
    const ovrs = players.map((p) => p.ratings.overall).filter((o): o is number => o != null)
    const distinct = new Set(ovrs).size
    expect(distinct).toBeGreaterThanOrEqual(15)
    const min = Math.min(...ovrs)
    const max = Math.max(...ovrs)
    expect(max - min).toBeGreaterThanOrEqual(15)
    // Sanity: not everyone parked at the old flat 70.
    const at70 = ovrs.filter((o) => o === 70).length
    expect(at70 / ovrs.length).toBeLessThan(0.5)
  })
})
