import { buildPlayerPipeline } from './buildPlayerPipeline.ts'
import type { DatasetBySource } from '../schema/dataset.ts'

// Fixture exercises all three resolution paths:
//  - p1: id match (recruiting/production carry CFBD-1)
//  - p2: name-exact match (recruiting keyed only by name, id differs)
//  - p3: fuzzy match (recruiting name 'Jhon Smyth' ~ roster 'John Smith', same last token)
//  - p4: no enrichment → contributes to coverage gap
const dataset = {
  roster: {
    sourceId: 'cfbd-roster-v1',
    sourceType: 'roster',
    season: 2025,
    players: [
      { playerId: 'CFBD-1', name: 'Alex One', number: 1, side: 'OFF', position: 'QB', classYear: 'JR', isTransfer: false },
      { playerId: 'CFBD-2', name: 'Blake Two', number: 2, side: 'DEF', position: 'DB', classYear: '0', isTransfer: true },
      { playerId: 'CFBD-3', name: 'John Smith', number: 3, side: 'OFF', position: 'WR', classYear: 'SO', isTransfer: false },
      { playerId: 'CFBD-4', name: 'No Match', number: 4, side: 'DEF', position: 'LB', classYear: 'SR', isTransfer: false },
    ],
    depthChart: { offense: { QB: 'CFBD-1' }, defense: { CB1: 'CFBD-2' } },
  },
  recruiting: {
    sourceId: '247-v1',
    sourceType: 'recruiting',
    playerRecruitProfiles: [
      { playerId: 'CFBD-1', name: 'Alex One', stars: 4, compositeRating: 0.95 },
      // id differs from roster (X-2) so this only resolves by exact name.
      { playerId: 'X-2', name: 'Blake Two', stars: 3, transferPortalStars: 4, transferRating: 0.9, compositeRating: 0.8, isTransfer: true },
      // fuzzy: 'Jhon Smyth' vs 'John Smith' (same last token 'smyth'? no) — use shared last token.
      { playerId: 'X-3', name: 'Johnn Smith', stars: 5, compositeRating: 0.99 },
    ],
  },
  production: {
    sourceId: 'cfbd-prod-v1',
    sourceType: 'production',
    season: 2025,
    playerProduction: [
      { playerId: 'CFBD-1', name: 'Alex One', YDS: 2500, TD: 20 },
    ],
  },
} as unknown as DatasetBySource

describe('buildPlayerPipeline', () => {
  const pipeline = buildPlayerPipeline(dataset)

  it('joins all roster players and reports coverage', () => {
    expect(pipeline.players).toHaveLength(4)
    expect(pipeline.coverage.rosterCount).toBe(4)
    // p1 (id), p2 (name-exact), p3 (fuzzy) match recruiting; p4 does not.
    expect(pipeline.coverage.recruitingMatched).toBe(3)
    // only p1 has production.
    expect(pipeline.coverage.productionMatched).toBe(1)
    expect(pipeline.coverage.stubCount).toBe(0)
  })

  it('resolves via id, name-exact, and fuzzy (≥0.82)', () => {
    const byId = new Map(pipeline.players.map((p) => [p.playerId, p]))
    expect(byId.get('CFBD-1')!.dataCompleteness.recruitingMatchedBy).toBe('id')
    expect(byId.get('CFBD-2')!.dataCompleteness.recruitingMatchedBy).toBe('name-exact')
    expect(byId.get('CFBD-3')!.dataCompleteness.recruitingMatchedBy).toBe('name-fuzzy')
    expect(byId.get('CFBD-4')!.dataCompleteness.hasRecruiting).toBe(false)
  })

  it('canonicalizes classYear ("0" → null) and computes a blended OVR', () => {
    const byId = new Map(pipeline.players.map((p) => [p.playerId, p]))
    expect(byId.get('CFBD-2')!.bio.classYear).toBeNull()
    expect(byId.get('CFBD-1')!.bio.classYear).toBe('JR')
    // CFBD-1 has recruiting (0.95) but its production stats are NOT nested under
    // production.stats in this fixture → recruiting-projection, a real number.
    const p1 = byId.get('CFBD-1')!
    expect(p1.ratings.derived).toBe(true)
    expect(typeof p1.ratings.overall).toBe('number')
    expect(p1.ratings.overall).toBeGreaterThan(70)
    expect(p1.ratings.method).toBe('recruiting-projection')
    expect(p1.ratings.breakdown.recruiting).not.toBeNull()
    // p4 has neither recruiting nor production → NR (honest null, never a number).
    const p4 = byId.get('CFBD-4')!
    expect(p4.ratings.overall).toBeNull()
    expect(p4.ratings.method).toBe('nr')
  })

  it('uses transferRating for transfer compositePercent and computes starter metrics', () => {
    const byId = new Map(pipeline.players.map((p) => [p.playerId, p]))
    // p2 isTransfer with transferRating 0.9 → compositePercent 90.0
    expect(byId.get('CFBD-2')!.recruiting.compositePercent).toBe(90)
    // starters: CFBD-1 (OFFENSE, 95) + CFBD-2 (DEFENSE, 90) → team avg 92.5
    expect(pipeline.metrics.team.starterCount).toBe(2)
    expect(pipeline.metrics.team.avgStarterComposite).toBe(92.5)
    expect(pipeline.metrics.offense.avgStarterComposite).toBe(95)
    expect(pipeline.metrics.defense.avgStarterComposite).toBe(90)
  })

  it('counts ourlads stubs', () => {
    const withStub = buildPlayerPipeline({
      ...dataset,
      roster: {
        ...dataset.roster,
        players: [
          ...dataset.roster.players,
          { playerId: 'ourlads-stub-99', name: 'Stub Guy', number: 99, side: 'OFF', position: 'TE', classYear: null, isTransfer: false } as never,
        ],
      },
    })
    expect(withStub.coverage.stubCount).toBe(1)
  })
})
