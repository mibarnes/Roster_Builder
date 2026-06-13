/**
 * Pilot-deepening reconciliation unit tests:
 *  - ESPN normalize (raw athlete → flat EspnPlayer; id namespace; side/class)
 *  - crosswalk DIRECT id join (CFBD-2025 ↔ ESPN by CFBD-<espnId>)
 *  - merge precedence (official → ESPN → CFBD) + conflict detection (value+alt)
 *  - report coverage (masterCount === spineCount; flags counted, never dropped)
 *  - official-site Nuxt parser (devalue-ref resolution → HS/prev/hometown)
 *
 * These gate the golden-record engine against its zod schemas + the no-fabrication
 * + 100%-spine-coverage invariants.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mapEspnAthletes,
  normalizeEspnAthlete,
  type EspnAthlete,
} from '../../scripts/collect/sources/espn.ts'
import {
  extractPrestoPlayerPaths,
  parseNuxtRoster,
  parseOfficialHtml,
  parsePrestoPlayerPage,
} from '../../scripts/collect/sources/officialSite.ts'
import { buildCrosswalk, type CfbdEnrichment } from '../../scripts/collect/reconcile/crosswalk.ts'
import { mergePlayer, type ConflictTally } from '../../scripts/collect/reconcile/merge.ts'
import { buildReport } from '../../scripts/collect/reconcile/report.ts'
import { buildMaster } from '../../scripts/collect/reconcile/buildMaster.ts'
import { buildIncomingRecruits, type IncomingRecruit, type TransferOverlayRecord } from '../../scripts/collect/recruiting.ts'
import { EspnPlayerSchema, PlayerMasterSchema } from './schema/index.ts'
import type { EspnPlayer } from './schema/espnRoster.ts'
import type { RecruitProfile } from '../../scripts/collect/recruiting.ts'

// ── helpers ───────────────────────────────────────────────────────────────────
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
  headshot: { href: 'https://a.espncdn.com/i/headshots/college-football/players/full/5079555.png' },
  injuries: [],
  ...over,
})

const recruit = (over: Partial<RecruitProfile> = {}): RecruitProfile => ({
  playerId: 'CFBD-5079555',
  name: 'DJ Lagway',
  stars: 5,
  compositeRating: 0.9964,
  nationalRank: 7,
  positionRank: 1,
  transferPortalStars: null,
  transferRating: null,
  fromSchool: null,
  isTransfer: false,
  years: [2024],
  matchMethod: 'cfbd-id',
  matches: [],
  homeCity: 'Willis',
  homeState: 'TX',
  homeLat: null,
  homeLon: null,
  ...over,
})

const emptyEnrichment = (): CfbdEnrichment => ({
  recruitingByPlayerId: new Map(),
  productionByPlayerId: new Map(),
  advancedByPlayerId: new Map(),
  cfbdRosterIds: new Set(),
})

describe('ESPN normalize (spine)', () => {
  it('maps a raw athlete to the flat EspnPlayer shape, validating the schema', () => {
    const p = normalizeEspnAthlete(rawAthlete())!
    EspnPlayerSchema.parse(p)
    expect(p.espnId).toBe('5079555') // SAME namespace as CFBD athleteId
    expect(p.name).toBe('DJ Lagway')
    expect(p.jersey).toBe(2)
    expect(p.side).toBe('OFF')
    expect(p.position).toBe('QB')
    expect(p.classYear).toBe('SO')
    expect(p.heightIn).toBe(75)
    expect(p.headshotUrl).toContain('5079555.png')
    expect(p.isInjured).toBe(false)
  })

  it('maps GR → SR and flags injuries; drops idless rows', () => {
    const gr = normalizeEspnAthlete(rawAthlete({ experience: { abbreviation: 'GR' }, injuries: [{ x: 1 }] }))!
    expect(gr.classYear).toBe('SR')
    expect(gr.isInjured).toBe(true)
    expect(normalizeEspnAthlete(rawAthlete({ id: undefined }))).toBeNull()
  })

  it('mapEspnAthletes flattens groups + dedupes by id', () => {
    const players = mapEspnAthletes({
      athletes: [
        { position: 'offense', items: [rawAthlete(), rawAthlete()] }, // dup id
        { position: 'defense', items: [rawAthlete({ id: '999', position: { abbreviation: 'CB', parent: { abbreviation: 'DEF' } } })] },
      ],
    })
    expect(players).toHaveLength(2)
    expect(players.map((p) => p.side).sort()).toEqual(['DEF', 'OFF'])
  })
})

describe('crosswalk — DIRECT id join (CFBD-2025 ↔ ESPN)', () => {
  it('joins CFBD-2025 enrichment to the ESPN spine by CFBD-<espnId> (no fuzzy)', () => {
    const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete())!]
    const enrichment = emptyEnrichment()
    enrichment.recruitingByPlayerId.set('CFBD-5079555', recruit())
    enrichment.cfbdRosterIds.add('CFBD-5079555')

    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.playerId).toBe('CFBD-5079555')
    expect(rows[0]!.cfbdId).toBe('CFBD-5079555') // canonical = CFBD-<espnId>
    expect(rows[0]!.recruiting).not.toBeNull() // joined by direct id
    expect(rows[0]!.inCfbd2025).toBe(true) // returning
  })

  it('flags a spine player with no CFBD-2025 record as not-in-2025 (new in 2026)', () => {
    const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete({ id: '888', fullName: 'New Transfer' }))!]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment: emptyEnrichment() })
    expect(rows[0]!.inCfbd2025).toBe(false)
    expect(rows[0]!.recruiting).toBeNull()
  })

  it('attaches the official overlay by stdName', () => {
    const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete())!]
    const official = [{ name: 'D.J. Lagway', jersey: 2, position: 'QB', classYear: 'So.', hometown: 'Willis, TX', highSchool: 'Willis HS', previousSchool: null }]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: official, on3Players: [], enrichment: emptyEnrichment() })
    expect(rows[0]!.official?.highSchool).toBe('Willis HS')
  })
})

describe('merge — precedence + conflict detection', () => {
  const opts = { productionSeason: 2025, rosterSeason: 2026, earliestRecruitYearByPid: new Map<string, number>() }

  it('jersey/position/height/headshot use the documented precedence', () => {
    const espn = normalizeEspnAthlete(rawAthlete())!
    const tally: ConflictTally = {}
    const m = mergePlayer(
      { playerId: 'CFBD-5079555', espnId: '5079555', cfbdId: 'CFBD-5079555', espn, official: { name: 'DJ Lagway', jersey: 2, position: 'QB', classYear: 'So.', hometown: 'Willis, TX', highSchool: 'Willis HS', previousSchool: null }, on3: null, recruiting: recruit(), production: null, advanced: null, inCfbd2025: true, officialName: 'DJ Lagway' },
      opts,
      tally,
    )
    PlayerMasterSchema.parse(m)
    expect(m.highSchool.value).toBe('Willis HS')
    expect(m.highSchool._meta.source).toBe('official') // HS = official ONLY
    expect(m.headshotUrl._meta.source).toBe('espn') // headshot = ESPN ONLY
    expect(m.recruiting.stars).toBe(5) // CFBD 247-composite primary
    expect(m.recruiting.source).toBe('cfbd-2025')
    expect(m.flags.newIn2026).toBe(false)
    expect(m.flags.unrated).toBe(false)
  })

  it('flags a jersey conflict and keeps BOTH values (value + alt)', () => {
    const espn = normalizeEspnAthlete(rawAthlete({ jersey: '2' }))!
    const tally: ConflictTally = {}
    const m = mergePlayer(
      { playerId: 'CFBD-5079555', espnId: '5079555', cfbdId: 'CFBD-5079555', espn, official: { name: 'DJ Lagway', jersey: 7, position: 'QB', classYear: 'So.', hometown: null, highSchool: null, previousSchool: null }, on3: null, recruiting: null, production: null, advanced: null, inCfbd2025: true, officialName: 'DJ Lagway' },
      opts,
      tally,
    )
    expect(m.jersey.value).toBe(7) // official wins
    expect(m.jersey._meta.conflict).toBe(true)
    expect(m.jersey._meta.alt).toBe(2) // ESPN kept as alt
    expect(tally.jersey).toBe(1)
  })

  it('flags walk-on / unrated for a no-recruiting spine player', () => {
    const espn = normalizeEspnAthlete(rawAthlete({ id: '888', fullName: 'Walk On', experience: { abbreviation: 'FR' } }))!
    const m = mergePlayer(
      { playerId: 'CFBD-888', espnId: '888', cfbdId: 'CFBD-888', espn, official: null, on3: null, recruiting: null, production: null, advanced: null, inCfbd2025: false, officialName: null },
      opts,
      {},
    )
    expect(m.flags.isWalkOn).toBe(true)
    expect(m.flags.unrated).toBe(true)
    expect(m.flags.newIn2026).toBe(true)
  })
})

describe('report — coverage invariant (masterCount === spineCount)', () => {
  it('every spine player → one master record (flags counted, never dropped)', () => {
    const espnPlayers: EspnPlayer[] = [
      normalizeEspnAthlete(rawAthlete())!,
      normalizeEspnAthlete(rawAthlete({ id: '888', fullName: 'New Guy', experience: { abbreviation: 'FR' }, position: { abbreviation: 'WR', parent: { abbreviation: 'OFF' } } }))!,
    ]
    const enrichment = emptyEnrichment()
    enrichment.recruitingByPlayerId.set('CFBD-5079555', recruit())
    enrichment.cfbdRosterIds.add('CFBD-5079555')

    const { master, spineCount } = buildMaster({
      teamLabel: 'Test',
      rosterSeason: 2026,
      productionSeason: 2025,
      espnPlayers,
      officialPlayers: [],
      officialDegraded: true,
      on3Players: [],
      on3Degraded: true,
      recruitingProfiles: [recruit()],
      productionEntries: [],
      advancedEntries: [],
      cfbdRosterIds: enrichment.cfbdRosterIds,
      ourladsHtml: '<html></html>', // no depth → 0 stubs
      returningProduction: null,
      provenance: {
        sources: [],
        collectedAt: '2026-06-12T00:00:00Z',
        collectorVersion: 'test',
        dataSeason: 2026,
        dataCutoff: null,
        rosterSeason: 2026,
        productionSeason: 2025,
      },
    })
    expect(spineCount).toBe(2)
    // No depth chart → master === spine exactly (no stubs added).
    expect(master.players).toHaveLength(2)
    expect(master.reconciliation.masterCount).toBe(master.players.length)
    expect(master.reconciliation.spineCount).toBe(2)
    expect(master.reconciliation.newIn2026).toBe(1)
    expect(master.reconciliation.unrated).toBe(1)
    // matched-by-id over the spine (1 returning of 2 spine players) = 50%.
    expect(master.reconciliation.matchedByIdPct).toBe(50)
    const r = buildReport({ spineCount: 2, masters: master.players, conflictTally: {}, fuzzyCount: 0, officialDegraded: true, on3Degraded: true })
    expect(r.masterCount).toBe(r.spineCount)
  })
})

describe('official-site Nuxt parser (devalue refs)', () => {
  it('resolves integer refs into the flat array → HS/prev/hometown rows', () => {
    // Minimal devalue-style array: index 0 unused; player object at index 1 holds
    // refs (indices) for each field; strings live at later indices.
    const arr: unknown[] = [
      null, // 0
      { firstName: 2, lastName: 3, jersey: 4, positionShort: 5, academicYearShort: 6, hometown: 7, highSchool: 8, previousSchool: 9 }, // 1
      'DJ', // 2
      'Lagway', // 3
      '2', // 4
      'QB', // 5
      'So.', // 6
      'Willis, TX', // 7
      'Willis HS', // 8
      '', // 9 (no previous school)
    ]
    const players = parseNuxtRoster(arr)
    expect(players).toHaveLength(1)
    expect(players[0]).toMatchObject({
      name: 'DJ Lagway',
      jersey: 2,
      position: 'QB',
      hometown: 'Willis, TX',
      highSchool: 'Willis HS',
      previousSchool: null,
    })
  })

  it('degrades (no throw) when no Nuxt island is present', () => {
    const res = parseOfficialHtml('<html><body>client-rendered, no data</body></html>')
    expect(res.degraded).toBe(true)
    expect(res.players).toEqual([])
    expect(res.engine).toBe('unknown')
  })
})

// ── GAP A: incoming 2026/2027 class name-matched to the ESPN spine ──────────────
describe('GAP A — incoming class (athleteId null) name-matched to spine', () => {
  it('buildIncomingRecruits extracts only athleteId-null rows, highest-rated per name', () => {
    const byYear = new Map<number, Parameters<typeof buildIncomingRecruits>[0] extends Map<number, infer R> ? R : never>([
      [2026, [
        { athleteId: null, name: 'Davian Groce', position: 'WR', stars: 4, rating: 0.95, ranking: 120, city: 'Houston', stateProvince: 'TX' },
        { athleteId: '5079555', name: 'Returning Guy', position: 'QB', stars: 5, rating: 0.99 }, // has id → excluded
      ]],
      [2027, [
        { athleteId: null, name: 'Davian Groce', position: 'WR', stars: 3, rating: 0.80 }, // lower-rated dup → loses
      ]],
    ])
    const inc = buildIncomingRecruits(byYear as never)
    expect(inc).toHaveLength(1)
    expect(inc[0]!.name).toBe('Davian Groce')
    expect(inc[0]!.stars).toBe(4) // higher composite/stars wins
    expect(inc[0]!.compositeRating).toBeCloseTo(0.95)
  })

  it('attaches incoming recruiting to a new-2026 spine player by stdName (now rated)', () => {
    // Spine freshman with NO CFBD-2025 record (newIn2026) — would be UNRATED.
    const espn: EspnPlayer[] = [
      normalizeEspnAthlete(rawAthlete({ id: '900001', fullName: 'Davian Groce', experience: { abbreviation: 'FR' }, position: { abbreviation: 'WR', parent: { abbreviation: 'OFF' } } }))!,
    ]
    const incoming: IncomingRecruit[] = [
      { name: 'Davian Groce', stdName: 'davian groce', position: 'WR', stars: 4, compositeRating: 0.95, nationalRank: 120, year: 2026, homeCity: 'Houston', homeState: 'TX' },
    ]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment: emptyEnrichment(), incomingRecruits: incoming })
    expect(rows[0]!.recruiting).not.toBeNull()
    expect(rows[0]!.recruiting!.stars).toBe(4)
    expect(rows[0]!.recruiting!.matchMethod).toBe('name-fuzzy')
    expect(rows[0]!.inCfbd2025).toBe(false) // still genuinely new in 2026

    const m = mergePlayer(rows[0]!, { productionSeason: 2025, rosterSeason: 2026, earliestRecruitYearByPid: new Map() }, {})
    expect(m.flags.newIn2026).toBe(true)
    expect(m.flags.unrated).toBe(false) // RATED now (was the bug)
    expect(m.recruiting.stars).toBe(4)
  })

  it('does NOT override an id-keyed (returning) recruiting record', () => {
    const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete())!] // DJ Lagway, id 5079555
    const enrichment = emptyEnrichment()
    enrichment.recruitingByPlayerId.set('CFBD-5079555', recruit({ stars: 5 }))
    enrichment.cfbdRosterIds.add('CFBD-5079555')
    const incoming: IncomingRecruit[] = [
      { name: 'DJ Lagway', stdName: 'dj lagway', position: 'QB', stars: 2, compositeRating: 0.5, nationalRank: null, year: 2026, homeCity: null, homeState: null },
    ]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment, incomingRecruits: incoming })
    expect(rows[0]!.recruiting!.stars).toBe(5) // id-keyed record preserved
    expect(rows[0]!.recruiting!.matchMethod).toBe('cfbd-id')
  })
})

// ── GAP B: special-teams (ST) players flow through the pipeline ──────────────────
describe('GAP B — special-teams (ST) inclusion', () => {
  it('ESPN maps a kicker (specialTeam group) to side ST', () => {
    const k = normalizeEspnAthlete(rawAthlete({ id: '700001', fullName: 'Trey Smack', position: { abbreviation: 'PK', parent: { abbreviation: 'special teams' } } }))!
    EspnPlayerSchema.parse(k)
    expect(k.side).toBe('ST')
    expect(k.position).toBe('PK')
  })

  it('an ST spine player merges to a master record with side ST (rated gracefully)', () => {
    const k = normalizeEspnAthlete(rawAthlete({ id: '700001', fullName: 'Trey Smack', experience: { abbreviation: 'JR' }, position: { abbreviation: 'PK', parent: { abbreviation: 'special teams' } } }))!
    const m = mergePlayer(
      { playerId: 'CFBD-700001', espnId: '700001', cfbdId: 'CFBD-700001', espn: k, official: null, on3: null, recruiting: null, production: null, advanced: null, inCfbd2025: false, officialName: null },
      { productionSeason: 2025, rosterSeason: 2026, earliestRecruitYearByPid: new Map() },
      {},
    )
    PlayerMasterSchema.parse(m)
    expect(m.side.value).toBe('ST')
    expect(m.position.value).toBe('PK')
  })

  it('mapEspnAthletes keeps the specialTeam group (OFF+DEF+ST flow through)', () => {
    const players = mapEspnAthletes({
      athletes: [
        { position: 'offense', items: [rawAthlete()] },
        { position: 'defense', items: [rawAthlete({ id: '2', position: { abbreviation: 'CB', parent: { abbreviation: 'DEF' } } })] },
        { position: 'specialTeam', items: [rawAthlete({ id: '3', position: { abbreviation: 'P', parent: { abbreviation: 'special teams' } } })] },
      ],
    })
    expect(players.map((p) => p.side).sort()).toEqual(['DEF', 'OFF', 'ST'])
  })
})

// ── GAP C: 247 transfer-portal records name-matched to the spine ─────────────────
describe('GAP C — transfer overlay name-matched to spine', () => {
  it('rates an otherwise-unrated transfer spine player from the 247 transfer overlay', () => {
    const espn: EspnPlayer[] = [
      normalizeEspnAthlete(rawAthlete({ id: '800001', fullName: 'Transfer Tony', experience: { abbreviation: 'JR' }, position: { abbreviation: 'WR', parent: { abbreviation: 'OFF' } } }))!,
    ]
    const transferOverlay: TransferOverlayRecord[] = [
      { name: 'Transfer Tony', stdName: 'transfer tony', position: 'WR', transferStars: 4, transferRating: 0.91, fromSchool: 'Old State' },
    ]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment: emptyEnrichment(), transferOverlay })
    const rec = rows[0]!.recruiting!
    expect(rec.isTransfer).toBe(true)
    expect(rec.transferRating).toBeCloseTo(0.91)
    expect(rec.fromSchool).toBe('Old State')
    expect(rec.stars).toBe(4) // transfer-portal stars surfaced so no longer unrated

    const m = mergePlayer(rows[0]!, { productionSeason: 2025, rosterSeason: 2026, earliestRecruitYearByPid: new Map() }, {})
    expect(m.flags.isTransfer).toBe(true)
    expect(m.flags.unrated).toBe(false)
  })

  it('fills only transfer-specific fields when an id-keyed record already exists', () => {
    const espn: EspnPlayer[] = [normalizeEspnAthlete(rawAthlete())!]
    const enrichment = emptyEnrichment()
    enrichment.recruitingByPlayerId.set('CFBD-5079555', recruit({ stars: 5, transferRating: null }))
    const transferOverlay: TransferOverlayRecord[] = [
      { name: 'DJ Lagway', stdName: 'dj lagway', position: 'QB', transferStars: 3, transferRating: 0.85, fromSchool: 'Prev U' },
    ]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: [], on3Players: [], enrichment, transferOverlay })
    const rec = rows[0]!.recruiting!
    expect(rec.stars).toBe(5) // HS stars NOT clobbered
    expect(rec.isTransfer).toBe(true)
    expect(rec.transferRating).toBeCloseTo(0.85)
    expect(rec.fromSchool).toBe('Prev U')
  })
})

// ── GAP D: Miami WMT/Presto official-site parser ─────────────────────────────────
describe('GAP D — WMT/Presto (Miami) official parser', () => {
  const FIX = join(process.cwd(), 'scripts/collect/parsers/__fixtures__')
  const landing = readFileSync(join(FIX, 'miami-presto-landing.html'), 'utf8')
  const playerPage = readFileSync(join(FIX, 'miami-presto-player.html'), 'utf8')

  it('extracts distinct player profile paths from the landing page (decoys excluded)', () => {
    const paths = extractPrestoPlayerPaths(landing)
    expect(paths).toHaveLength(3) // mark-fletcher (deduped), carson-beck, rueben-bain
    expect(paths.every((p) => p.includes('/player/'))).toBe(true)
    expect(paths.some((p) => p.includes('baseball') || p.includes('student-athlete'))).toBe(false)
  })

  it('detects the wmt-presto engine (landing alone degrades — needs profile fetch)', () => {
    const res = parseOfficialHtml(landing)
    expect(res.engine).toBe('wmt-presto')
    expect(res.degraded).toBe(true) // bio not in landing HTML
  })

  it('parses a profile page: name (entity-decoded) + hometown + high school', () => {
    const p = parsePrestoPlayerPage(playerPage)!
    expect(p.name).toBe('Mark Fletcher Jr.') // &#8211; suffix decoded + stripped
    expect(p.hometown).toBe('Fort Lauderdale, Fla.')
    expect(p.highSchool).toBe('American Heritage')
    expect(p.position).toBe('Running Back')
    expect(p.classYear).toBe('Senior')
  })

  it('a Presto-parsed player name-resolves onto the ESPN spine (Jr. suffix stripped)', () => {
    const espn: EspnPlayer[] = [
      normalizeEspnAthlete(rawAthlete({ id: '810001', fullName: 'Mark Fletcher', position: { abbreviation: 'RB', parent: { abbreviation: 'OFF' } } }))!,
    ]
    const official = [parsePrestoPlayerPage(playerPage)!]
    const { rows } = buildCrosswalk({ espnPlayers: espn, officialPlayers: official, on3Players: [], enrichment: emptyEnrichment() })
    expect(rows[0]!.official?.highSchool).toBe('American Heritage')
  })
})
