import { describe, expect, it } from 'vitest'
import { computeTeamRatings, RATING_WEIGHTS, type RatingInput } from './overall.ts'

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
})
