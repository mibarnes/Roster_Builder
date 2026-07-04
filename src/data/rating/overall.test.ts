import { describe, expect, it } from 'vitest'
import { computeTeamRatings, RATING_WEIGHTS, type RatingInput } from './overall.ts'
import {
  PRODUCTION_ONLY_WEIGHTS,
  PROJECTION_CLASS_PENALTY,
  PROJECTION_WEIGHTS,
  SUBSCORE_MEAN,
  type LeagueBaselines,
} from './ratingConfig.ts'

/** Convenience builder for a RatingInput with sane defaults. */
const mk = (over: Partial<RatingInput> = {}): RatingInput => ({
  positionGroup: 'WR',
  sideBucket: 'OFF',
  compositeRating: null,
  classYear: 'JR',
  isRedshirt: false,
  production: null,
  isStub: false,
  ...over,
})

describe('computeTeamRatings', () => {
  it('weights are the documented 0.45 / 0.45 / 0.10 single source', () => {
    expect(RATING_WEIGHTS.recruiting).toBe(0.45)
    expect(RATING_WEIGHTS.production).toBe(0.45)
    expect(RATING_WEIGHTS.class).toBe(0.1)
  })

  it('blends when a player has both recruiting and production signal', () => {
    // A group of WRs with both signals → blended; weights honored.
    const team = Array.from({ length: 5 }, (_, i) =>
      mk({
        compositeRating: 0.8 + i * 0.04,
        production: { games: 12, ppaAll: 0.3 + i * 0.1, usageOverall: 0.2 + i * 0.05, stats: { recYds: 400 + i * 150, recTD: i, rec: 30 + i * 5 } },
      }),
    )
    const results = computeTeamRatings(team)
    for (const r of results) {
      expect(r.method).toBe('blended')
      expect(r.overall).not.toBeNull()
      expect(r.weights.recruiting).toBe(0.45)
      expect(r.weights.production).toBe(0.45)
      expect(r.weights.class).toBe(0.1)
      expect(r.components.recruiting).not.toBeNull()
      expect(r.components.production).not.toBeNull()
    }
  })

  it('projects from recruiting only when there is no production', () => {
    const team = Array.from({ length: 4 }, (_, i) => mk({ compositeRating: 0.82 + i * 0.04 }))
    const results = computeTeamRatings(team)
    for (const r of results) {
      expect(r.method).toBe('recruiting-projection')
      expect(typeof r.overall).toBe('number')
      expect(r.components.production).toBeNull()
      expect(r.weights.recruiting).toBeCloseTo(0.82)
    }
  })

  it('rates production-only when there is no recruiting', () => {
    const team = Array.from({ length: 4 }, (_, i) =>
      mk({ compositeRating: null, production: { games: 12, ppaAll: 0.2 + i * 0.1, usageOverall: 0.2, stats: { tackles: 30 + i * 10, tfl: i, sacks: i } }, positionGroup: 'LB', sideBucket: 'DEF' }),
    )
    const results = computeTeamRatings(team)
    for (const r of results) {
      expect(r.method).toBe('production-only')
      expect(typeof r.overall).toBe('number')
      expect(r.components.recruiting).toBeNull()
    }
  })

  it('returns NR (overall=null) when a player has neither signal', () => {
    const [r] = computeTeamRatings([mk({ compositeRating: null, production: null })])
    expect(r!.overall).toBeNull()
    expect(r!.method).toBe('nr')
  })

  it('always NRs depth-chart stubs even if data leaks in', () => {
    const [r] = computeTeamRatings([
      mk({ isStub: true, compositeRating: 0.95, production: { games: 12, ppaAll: 1, usageOverall: 1, stats: { recYds: 1000 } } }),
    ])
    expect(r!.overall).toBeNull()
    expect(r!.method).toBe('nr')
  })

  it('normalizes WITHIN position group: a high-composite WR rates above a low one', () => {
    // Mixed roster; two WRs with clearly different composites + a few peers so
    // the WR group normalizes on its own distribution (n>=3).
    const team: RatingInput[] = [
      mk({ positionGroup: 'WR', compositeRating: 0.97 }), // high WR
      mk({ positionGroup: 'WR', compositeRating: 0.78 }), // low WR
      mk({ positionGroup: 'WR', compositeRating: 0.86 }),
      mk({ positionGroup: 'WR', compositeRating: 0.9 }),
      mk({ positionGroup: 'OL', compositeRating: 0.99 }),
    ]
    const results = computeTeamRatings(team)
    const highWr = results[0]!
    const lowWr = results[1]!
    expect(highWr.overall).not.toBeNull()
    expect(lowWr.overall).not.toBeNull()
    expect(highWr.overall!).toBeGreaterThan(lowWr.overall!)
  })

  it('applies the no-playing-time penalty to upperclass projections (g=0)', () => {
    // Same recruiting group, all zero production → recruiting-projection. A SR who
    // never played must rank below an identical FR (career backup vs unproven recruit).
    const team: RatingInput[] = [
      mk({ positionGroup: 'OL', sideBucket: 'OFF', classYear: 'FR', compositeRating: 0.92 }),
      mk({ positionGroup: 'OL', sideBucket: 'OFF', classYear: 'SR', compositeRating: 0.92 }),
      mk({ positionGroup: 'OL', sideBucket: 'OFF', classYear: 'SO', compositeRating: 0.92 }),
    ]
    const [fr, sr, so] = computeTeamRatings(team)
    expect(fr!.method).toBe('recruiting-projection')
    expect(sr!.method).toBe('recruiting-projection')
    expect(fr!.overall!).toBeGreaterThan(sr!.overall!) // SR penalized
    expect(fr!.overall!).toBeGreaterThanOrEqual(so!.overall!) // monotone by class
  })

  it('ranks a proven starter above a same-class zero-snap recruit', () => {
    const team: RatingInput[] = [
      mk({ positionGroup: 'WR', sideBucket: 'OFF', classYear: 'JR', compositeRating: 0.9, production: { games: 12, ppaAll: 0.4, usageOverall: 0.7, stats: { recYds: 1000, recTD: 9, rec: 70 } } }),
      mk({ positionGroup: 'WR', sideBucket: 'OFF', classYear: 'JR', compositeRating: 0.9, production: null }), // never played
    ]
    const [starter, benchRecruit] = computeTeamRatings(team)
    expect(starter!.overall!).toBeGreaterThan(benchRecruit!.overall!)
  })

  it('produces a spread, not a flat constant, across a varied team', () => {
    const team: RatingInput[] = [
      mk({ positionGroup: 'QB', sideBucket: 'OFF', compositeRating: 0.95, production: { games: 12, ppaAll: 0.5, usageOverall: 0.9, stats: { passYds: 3000, passTD: 28 } } }),
      mk({ positionGroup: 'RB', sideBucket: 'OFF', compositeRating: 0.88, production: { games: 11, ppaAll: 0.3, usageOverall: 0.6, stats: { rushYds: 900, rushTD: 8 } } }),
      mk({ positionGroup: 'WR', sideBucket: 'OFF', compositeRating: 0.8 }),
      mk({ positionGroup: 'LB', sideBucket: 'DEF', compositeRating: null, production: { games: 12, ppaAll: 0.1, usageOverall: 0.3, stats: { tackles: 80, tfl: 9, sacks: 4 } } }),
      mk({ positionGroup: 'CB', sideBucket: 'DEF', compositeRating: null, production: null }),
    ]
    const overalls = computeTeamRatings(team).map((r) => r.overall)
    const rated = overalls.filter((o): o is number => o != null)
    expect(rated.length).toBeGreaterThanOrEqual(4)
    expect(new Set(rated).size).toBeGreaterThan(1) // not all identical
    expect(overalls.some((o) => o === null)).toBe(true) // the unsignaled CB is NR
  })

  it('assigns confidence: blended+played→high, projection→low, stub→low', () => {
    const [played, projection, stub] = computeTeamRatings([
      mk({ compositeRating: 0.9, production: { games: 12, ppaAll: 0.4, usageOverall: 0.5, stats: { recYds: 800, rec: 60 } } }),
      mk({ compositeRating: 0.9, production: null }),
      mk({ isStub: true }),
    ])
    expect(played!.confidence).toBe('high')
    expect(projection!.confidence).toBe('low')
    expect(stub!.confidence).toBe('low')
  })
})

// ── F4/D7 — config surface + league calibration ──────────────────────────────
describe('ratingConfig (documented single source)', () => {
  it('exposes the canonical weight sets + projection penalty', () => {
    expect(RATING_WEIGHTS).toEqual({ recruiting: 0.45, production: 0.45, class: 0.1 })
    expect(PROJECTION_WEIGHTS).toEqual({ recruiting: 0.82, production: 0, class: 0.18 })
    expect(PRODUCTION_ONLY_WEIGHTS).toEqual({ recruiting: 0, production: 0.82, class: 0.18 })
    expect(PROJECTION_CLASS_PENALTY).toEqual({ FR: 0, SO: 4, JR: 9, SR: 14 })
  })
})

describe('OVR monotonicity (recruiting)', () => {
  it('higher composite never yields a lower OVR within one group', () => {
    // Projection players (no production) so only recruiting drives OVR.
    const team = [0.75, 0.8, 0.85, 0.9, 0.95, 1.0].map((c) =>
      mk({ positionGroup: 'WR', sideBucket: 'OFF', classYear: 'FR', compositeRating: c }),
    )
    const ovr = computeTeamRatings(team).map((r) => r.overall!)
    for (let i = 1; i < ovr.length; i++) expect(ovr[i]!).toBeGreaterThanOrEqual(ovr[i - 1]!)
  })
})

describe('league calibration', () => {
  // A single WR with a league-average composite. With league baselines whose WR
  // mean equals his composite, he should score right at SUBSCORE_MEAN-driven OVR;
  // a HIGHER league mean must push his (recruiting) sub-score DOWN vs a lower mean.
  const soloWr = (): RatingInput[] => [
    mk({ positionGroup: 'WR', sideBucket: 'OFF', classYear: 'FR', compositeRating: 0.88, production: null }),
  ]
  const baselines = (wrMean: number): LeagueBaselines => ({
    generatedAt: null,
    teamsIncluded: 54,
    recByGroup: { WR: { mean: wrMean, sd: 0.1, n: 400 } },
    prodByGroup: {},
    recBySide: { OFF: { mean: wrMean, sd: 0.1, n: 1000 } },
    prodBySide: {},
  })

  it('z-scores against the LEAGUE distribution, not the (single-player) team', () => {
    // Team-relative would be undefined (n<3 → absolute fallback); the league
    // baseline gives a real distribution → a real z-score at the mean ≈ SUBSCORE_MEAN.
    const atMean = computeTeamRatings(soloWr(), baselines(0.88))[0]!
    expect(atMean.components.recruiting).toBe(SUBSCORE_MEAN) // z=0 → 73
  })

  it('a stronger league (higher mean) lowers a fixed player vs a weaker league', () => {
    const strong = computeTeamRatings(soloWr(), baselines(0.95))[0]!.components.recruiting!
    const weak = computeTeamRatings(soloWr(), baselines(0.80))[0]!.components.recruiting!
    expect(weak).toBeGreaterThan(strong) // same player looks better in a weaker league
  })
})
