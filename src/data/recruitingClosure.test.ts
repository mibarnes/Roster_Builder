/**
 * C2 — CFBD-native recruiting-closure unit tests.
 *
 *  - national recruiting index builder (by athleteId + by stdName, best-first)
 *  - portal incoming filter (destination === team, highest-rated per name)
 *  - full-spine recruiting precedence in the crosswalk:
 *      • a transfer with NO team recruiting gets cfbd-natl-name or cfbd-portal
 *      • an official-only / freshman spine player gets rated cross-school
 *      • an UNRATED (empty) cfbd-team record does NOT block the fallback
 *  - OurLads stub reduction against the national index (real id, not a stub)
 *
 * These gate the closure against the no-fabrication + 100%-spine-coverage
 * invariants (every value still traces to a CFBD-native feed).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildNationalIndex,
  type NatlRecruit,
} from '../../scripts/collect/sources/cfbdRecruitingIndex.ts'
import { incomingTransfers } from '../../scripts/collect/sources/cfbdPortal.ts'
import type { CfbdRecruitRow, CfbdPortalRow } from '../../scripts/collect/cfbd.ts'
import {
  normalizeEspnAthlete,
  type EspnAthlete,
} from '../../scripts/collect/sources/espn.ts'
import { buildCrosswalk, type CfbdEnrichment } from '../../scripts/collect/reconcile/crosswalk.ts'
import { buildMaster } from '../../scripts/collect/reconcile/buildMaster.ts'
import type { EspnPlayer } from './schema/espnRoster.ts'
import type { RecruitProfile } from '../../scripts/collect/recruiting.ts'
import type { NationalRecruitingIndex } from '../../scripts/collect/sources/cfbdRecruitingIndex.ts'

const rawAthlete = (over: Partial<EspnAthlete> = {}): EspnAthlete => ({
  id: '5079555',
  firstName: 'DJ',
  lastName: 'Lagway',
  fullName: 'DJ Lagway',
  jersey: '2',
  weight: 240,
  height: 75,
  displayHeight: "6' 3\"",
  position: { abbreviation: 'QB', parent: { abbreviation: 'OFF' } },
  experience: { years: 2, abbreviation: 'SO' },
  status: { type: 'active' },
  birthPlace: { city: 'Willis', state: 'TX', country: 'USA' },
  headshot: { href: 'https://a.espncdn.com/x.png' },
  injuries: [],
  ...over,
})

const emptyEnrichment = (): CfbdEnrichment => ({
  recruitingByPlayerId: new Map(),
  productionByPlayerId: new Map(),
  advancedByPlayerId: new Map(),
  cfbdRosterIds: new Set(),
})

const emptyNatl = (): NationalRecruitingIndex => ({
  byAthleteId: new Map(),
  byStdName: new Map(),
  stats: { rows: 0, withAthleteId: 0, years: [] },
})

// ── National recruiting index builder ───────────────────────────────────────
describe('national recruiting index builder', () => {
  it('indexes by athleteId AND by stdName; sorts each name bucket best-first', () => {
    const rows: CfbdRecruitRow[] = [
      { athleteId: '111', name: 'Jordan Smith', position: 'DE', stars: 4, rating: 0.93, ranking: 80, committedTo: 'Florida', year: 2024, city: 'Miami', stateProvince: 'FL' },
      // same stdName, lower rating → loses the byAthleteId race for its own id but both stay in byStdName
      { athleteId: '222', name: 'Jordan Smith', position: 'WR', stars: 3, rating: 0.84, committedTo: 'Georgia', year: 2024 },
      { athleteId: null, name: 'Caleb Banks', position: 'DT', stars: 4, rating: 0.9, committedTo: 'Louisville', year: 2022 },
    ]
    const idx = buildNationalIndex(new Map([[2024, rows.slice(0, 2)], [2022, rows.slice(2)]]))

    // by athleteId — each id present, mapped to its own record
    expect(idx.byAthleteId.get('CFBD-111')?.committedTo).toBe('Florida')
    expect(idx.byAthleteId.get('CFBD-222')?.committedTo).toBe('Georgia')
    // athleteId-null row is NOT in byAthleteId
    expect([...idx.byAthleteId.keys()].some((k) => k.includes('Banks'))).toBe(false)

    // by stdName — both Jordan Smiths bucketed, highest composite first
    const bucket = idx.byStdName.get('jordan smith')!
    expect(bucket).toHaveLength(2)
    expect(bucket[0]!.compositeRating).toBeCloseTo(0.93) // best-first
    expect(idx.byStdName.get('caleb banks')![0]!.compositeRating).toBeCloseTo(0.9)

    expect(idx.stats.rows).toBe(3)
    expect(idx.stats.withAthleteId).toBe(2)
    expect(idx.stats.years).toEqual([2022, 2024])
  })

  it('clamps a stray out-of-range composite to 0–1 and skips nameless rows', () => {
    const idx = buildNationalIndex(
      new Map([[2025, [
        { athleteId: '1', name: 'Over Rated', rating: 1.4, stars: 5 },
        { athleteId: '2', name: '', rating: 0.5, stars: 3 }, // nameless → skipped
      ] as CfbdRecruitRow[]]]),
    )
    expect(idx.byAthleteId.get('CFBD-1')?.compositeRating).toBe(1) // clamped
    expect(idx.stats.rows).toBe(1) // nameless skipped
  })
})

// ── Portal incoming filter ──────────────────────────────────────────────────
describe('portal incoming filter', () => {
  const rows: CfbdPortalRow[] = [
    { firstName: 'Tony', lastName: 'Transfer', position: 'WR', origin: 'Old State', destination: 'Florida', rating: 0.88, stars: 4, eligibility: 'Junior', season: 2025 },
    // wrong destination → excluded
    { firstName: 'Not', lastName: 'Ours', destination: 'Georgia', rating: 0.9, stars: 5, season: 2025 },
    // same name to Florida, lower rating → loses
    { firstName: 'Tony', lastName: 'Transfer', destination: 'Florida', rating: 0.5, stars: 2, season: 2024 },
  ]

  it('keeps only destination===team and the highest-rated record per name', () => {
    const inc = incomingTransfers(rows, 'Florida')
    expect(inc).toHaveLength(1)
    expect(inc[0]!.name).toBe('Tony Transfer')
    expect(inc[0]!.rating).toBeCloseTo(0.88) // higher-rated record wins
    expect(inc[0]!.origin).toBe('Old State')
    expect(inc[0]!.eligibility).toBe('Junior')
  })

  it('returns [] when no entry targets the team', () => {
    expect(incomingTransfers(rows, 'Miami')).toEqual([])
  })
})

// ── Full-spine recruiting precedence (the closure) ──────────────────────────
describe('full-spine recruiting precedence (crosswalk)', () => {
  it('rates a transfer with no team recruiting via cfbd-natl-name (cross-school HS)', () => {
    const espn: EspnPlayer[] = [
      normalizeEspnAthlete(rawAthlete({ id: '900', fullName: 'Cross School', position: { abbreviation: 'CB', parent: { abbreviation: 'DEF' } } }))!,
    ]
    const natl = emptyNatl()
    const rec: NatlRecruit = { athleteId: '900', name: 'Cross School', position: 'CB', stars: 4, compositeRating: 0.92, nationalRank: 50, committedTo: 'Old State', recruitYear: 2023, homeCity: null, homeState: null }
    // present by name only (athleteId mismatch to spine forces the name path)
    natl.byStdName.set('cross school', [{ ...rec, athleteId: null }])

    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment: emptyEnrichment(), nationalIndex: natl })
    const r = rows[0]!.recruiting!
    expect(r.stars).toBe(4)
    expect(r.source).toBe('cfbd-natl-name')
    expect(r.recruitedSchool).toBe('Old State')
    expect(r.recruitYear).toBe(2023)
  })

  it('rates a transfer with no team recruiting via cfbd-portal (origin + eligibility)', () => {
    const espn: EspnPlayer[] = [
      normalizeEspnAthlete(rawAthlete({ id: '901', fullName: 'Portal Pete', position: { abbreviation: 'WR', parent: { abbreviation: 'OFF' } } }))!,
    ]
    const portalIncoming = [
      { name: 'Portal Pete', stdName: 'portal pete', position: 'WR', origin: 'Prev U', destination: 'Florida', rating: 0.87, stars: 4, eligibility: 'Senior', transferDate: null, season: 2025 },
    ]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment: emptyEnrichment(), portalIncoming })
    const r = rows[0]!.recruiting!
    expect(r.source).toBe('cfbd-portal')
    expect(r.isTransfer).toBe(true)
    expect(r.transferRating).toBeCloseTo(0.87)
    expect(r.origin).toBe('Prev U')
    expect(r.eligibility).toBe('Senior')
    expect(r.stars).toBe(4) // no longer unrated
  })

  it('an UNRATED (empty) cfbd-team record does NOT block the national fallback', () => {
    const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete({ id: '5079555' }))!]
    const enrichment = emptyEnrichment()
    // an EMPTY team record (preferred walk-on listed by the team feed, no stars)
    const empty: RecruitProfile = {
      playerId: 'CFBD-5079555', name: 'DJ Lagway', stars: null, compositeRating: null,
      nationalRank: null, positionRank: null, transferPortalStars: null, transferRating: null,
      fromSchool: null, isTransfer: false, years: [], matchMethod: 'none', matches: [],
      homeCity: null, homeState: null, homeLat: null, homeLon: null,
    }
    enrichment.recruitingByPlayerId.set('CFBD-5079555', empty)
    enrichment.cfbdRosterIds.add('CFBD-5079555')
    const natl = emptyNatl()
    natl.byAthleteId.set('CFBD-5079555', { athleteId: '5079555', name: 'DJ Lagway', position: 'QB', stars: 5, compositeRating: 0.99, nationalRank: 7, committedTo: 'Florida', recruitYear: 2024, homeCity: null, homeState: null })

    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment, nationalIndex: natl })
    const r = rows[0]!.recruiting!
    expect(r.stars).toBe(5) // the empty record did NOT block national-id
    expect(r.source).toBe('cfbd-natl-id')
  })

  it('a RATED cfbd-team record is NOT overridden by the national index', () => {
    const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete({ id: '5079555' }))!]
    const enrichment = emptyEnrichment()
    const rated: RecruitProfile = {
      playerId: 'CFBD-5079555', name: 'DJ Lagway', stars: 5, compositeRating: 0.9964,
      nationalRank: 7, positionRank: 1, transferPortalStars: null, transferRating: null,
      fromSchool: null, isTransfer: false, years: [2024], matchMethod: 'cfbd-id', matches: [],
      homeCity: 'Willis', homeState: 'TX', homeLat: null, homeLon: null,
    }
    enrichment.recruitingByPlayerId.set('CFBD-5079555', rated)
    const natl = emptyNatl()
    natl.byAthleteId.set('CFBD-5079555', { athleteId: '5079555', name: 'DJ Lagway', position: 'QB', stars: 2, compositeRating: 0.5, nationalRank: 999, committedTo: 'Elsewhere', recruitYear: 2024, homeCity: null, homeState: null })

    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment, nationalIndex: natl })
    const r = rows[0]!.recruiting!
    expect(r.stars).toBe(5) // team record preserved
    expect(r.source).toBe('cfbd-team')
  })

  it('exposes per-source counts + a full-spine name index', () => {
    const espn: EspnPlayer[] = [
      normalizeEspnAthlete(rawAthlete({ id: '901', fullName: 'Portal Pete', position: { abbreviation: 'WR', parent: { abbreviation: 'OFF' } } }))!,
      normalizeEspnAthlete(rawAthlete({ id: '902', fullName: 'Plain Walkon', experience: { abbreviation: 'FR' }, position: { abbreviation: 'WR', parent: { abbreviation: 'OFF' } } }))!,
    ]
    const portalIncoming = [
      { name: 'Portal Pete', stdName: 'portal pete', position: 'WR', origin: 'Prev U', destination: 'Florida', rating: 0.87, stars: 4, eligibility: 'Senior', transferDate: null, season: 2025 },
    ]
    const res = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment: emptyEnrichment(), portalIncoming })
    expect(res.recruitSourceCounts['cfbd-portal']).toBe(1)
    expect(res.recruitSourceCounts['none']).toBe(1) // the genuine walk-on
    expect(res.spineIndex.rosterNamePairs.length).toBe(2) // full spine indexed
  })
})

// ── Stub reduction against the national index ───────────────────────────────
describe('OurLads stub reduction (national index)', () => {
  // The real OurLads fixture references depth players. With an empty ESPN spine
  // they all mint ourlads-stub-*; once the national index knows a depth name
  // (e.g. "Dallas Wilson"), it resolves to a real CFBD id with a recruiting
  // record instead of a synthetic stub.
  const ourladsHtml = readFileSync(join(process.cwd(), 'scripts/collect/parsers/__fixtures__/ourlads-florida.html'), 'utf8')
  const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete())!] // DJ Lagway only

  const baseInput = {
    teamLabel: 'Test',
    rosterSeason: 2026,
    productionSeason: 2025,
    espnPlayers: espn,
    officialPlayers: [],
    officialDegraded: true,
    on3Players: [],
    on3Degraded: true,
    recruitingProfiles: [] as RecruitProfile[],
    productionEntries: [],
    advancedEntries: [],
    cfbdRosterIds: new Set<string>(),
    returningProduction: null,
    provenance: {
      sources: [], collectedAt: '2026-06-13T00:00:00Z', collectorVersion: 'test',
      dataSeason: 2026, dataCutoff: null, rosterSeason: 2026, productionSeason: 2025,
    },
  }

  it('reduces a stub to a real CFBD id when the national index knows the name', () => {
    const natl = emptyNatl()
    const rec: NatlRecruit = { athleteId: '770', name: 'Dallas Wilson', position: 'WR', stars: 4, compositeRating: 0.94, nationalRank: 40, committedTo: 'Florida', recruitYear: 2025, homeCity: null, homeState: null }
    natl.byStdName.set('dallas wilson', [rec])
    natl.byAthleteId.set('CFBD-770', rec)

    const withReduction = buildMaster({ ...baseInput, ourladsHtml, nationalIndex: natl })
    const noReduction = buildMaster({ ...baseInput, ourladsHtml, nationalIndex: emptyNatl() })
    // one fewer stub once the depth name resolves to a real id
    expect(withReduction.stubReduction.after).toBeLessThan(noReduction.stubReduction.after)
    const resolved = withReduction.master.players.find((p) => p.playerId === 'CFBD-770')
    expect(resolved).toBeDefined()
    expect(resolved!.recruiting.stars).toBe(4)
    expect(resolved!.recruiting.recruitSource).toBe('cfbd-natl-id')
    expect(resolved!.flags.isStub).toBe(false)
    // no ourlads-stub-* minted for this resolved name
    expect(withReduction.master.players.some((p) => p.playerId.startsWith('ourlads-stub-dallas-wilson'))).toBe(false)
  })

  it('leaves a genuine unknown depth name as a stub (never invents a player)', () => {
    const { master } = buildMaster({ ...baseInput, ourladsHtml, nationalIndex: emptyNatl() })
    expect(master.players.some((p) => p.playerId.startsWith('ourlads-stub-'))).toBe(true)
  })
})
