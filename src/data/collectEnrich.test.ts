/**
 * Unit tests for the E1/E2 enrichment builders: canonical playerId reconcile,
 * games-based production (games-played count + broad-category aggregation),
 * advanced (usage/ppa) + context (returning) shaping, and the redshirt-aware
 * class-year / eligibility helpers. These gate the new sources against their
 * zod schemas so a shape regression fails CI loudly.
 */
import {
  buildProduction,
  mapRosterRows,
  type CfbdGame,
} from '../../scripts/collect/cfbd.ts'
import { buildAdvancedSource, buildContextSource } from '../../scripts/collect/advanced.ts'
import { cfbdId, id247, ourladsStubId, reconcile } from '../../scripts/collect/playerId.ts'
import { eligibilityFromYear, inferRedshirt, parseClassYear } from '../../scripts/collect/normalize.ts'
import {
  AdvancedSourceSchema,
  ContextSourceSchema,
  ProductionSourceSchema,
} from './schema/index.ts'

describe('canonical playerId reconcile', () => {
  it('follows precedence: cfbd-id > name-fuzzy > 247-id > stub', () => {
    expect(reconcile({ cfbdAthleteId: '5079555' })).toEqual({ playerId: 'CFBD-5079555', source: 'cfbd-id' })
    expect(reconcile({ player247Id: '46134137', name: 'X' })).toEqual({ playerId: '247-46134137', source: '247-id' })
    expect(reconcile({ name: 'Nobody Here' }).source).toBe('stub')
    expect(reconcile({ name: 'Nobody Here' }).playerId).toBe('ourlads-stub-nobody-here')
  })

  it('prefers an existing roster id via the name resolver over minting a new id', () => {
    const resolveByName = (n: string) => (n === 'DJ Lagway' ? 'CFBD-5079555' : null)
    const r = reconcile({ player247Id: '999', name: 'DJ Lagway', resolveByName })
    expect(r).toEqual({ playerId: 'CFBD-5079555', source: 'name-fuzzy' })
  })

  it('id builders are stable', () => {
    expect(cfbdId(123)).toBe('CFBD-123')
    expect(id247('77')).toBe('247-77')
    expect(ourladsStubId("D'Angelo Smith Jr.")).toBe('ourlads-stub-d-angelo-smith-jr')
  })
})

describe('redshirt-aware class year + eligibility', () => {
  it('splits RS class years and keeps the redshirt flag', () => {
    expect(parseClassYear('RS SO')).toEqual({ classYear: 'SO', isRedshirt: true })
    expect(parseClassYear('JR')).toEqual({ classYear: 'JR', isRedshirt: false })
    expect(parseClassYear(4)).toEqual({ classYear: 'SR', isRedshirt: false })
    expect(parseClassYear(null)).toEqual({ classYear: null, isRedshirt: false })
  })

  it('derives eligibility-remaining from CFBD numeric year', () => {
    expect(eligibilityFromYear(1)).toBe(4)
    expect(eligibilityFromYear(4)).toBe(1)
    expect(eligibilityFromYear(5)).toBe(1)
    expect(eligibilityFromYear(null)).toBeNull()
  })

  it('infers redshirt from roster tenure (season − first recruit year ≥ class)', () => {
    // 2025 SR recruited 2021 → 4 years ≥ 4 → redshirt; recruited 2022 → 3 < 4 → no.
    expect(inferRedshirt('SR', 2021, 2025, false)).toBe(true)
    expect(inferRedshirt('SR', 2022, 2025, false)).toBe(false)
    // 2025 JR recruited 2022 → 3 ≥ 3 → redshirt.
    expect(inferRedshirt('JR', 2022, 2025, false)).toBe(true)
    // True FR recruited 2025 → 0 < 1 → no.
    expect(inferRedshirt('FR', 2025, 2025, false)).toBe(false)
    // Transfers + missing data are never inferred (tenure unreliable).
    expect(inferRedshirt('SR', 2021, 2025, true)).toBe(false)
    expect(inferRedshirt('SR', null, 2025, false)).toBe(false)
  })
})

describe('roster hometown capture', () => {
  it('mapRosterRows carries hometown + isRedshirt + eligibility', () => {
    const [p] = mapRosterRows([
      { id: 1, firstName: 'A', lastName: 'B', position: 'QB', year: 1, homeCity: 'Marietta', homeState: 'GA', homeLatitude: 33.9, homeLongitude: -84.5 },
    ])
    expect(p!.homeCity).toBe('Marietta')
    expect(p!.homeState).toBe('GA')
    expect(p!.homeLat).toBe(33.9)
    expect(p!.eligibilityRemaining).toBe(4)
    expect(p!.isRedshirt).toBe(false)
  })
})

describe('production from /games/players', () => {
  const games: CfbdGame[] = [
    {
      id: 'g1',
      teams: [
        {
          team: 'Florida',
          homeAway: 'home',
          categories: [
            { name: 'passing', types: [{ name: 'YDS', athletes: [{ id: '1', name: 'QB One', stat: '200' }] }, { name: 'C/ATT', athletes: [{ id: '1', stat: '15/27' }] }] },
            { name: 'rushing', types: [{ name: 'YDS', athletes: [{ id: '2', name: 'RB Two', stat: '50' }] }] },
          ],
        },
      ],
    },
    {
      id: 'g2',
      teams: [
        {
          team: 'Florida',
          homeAway: 'away',
          categories: [
            { name: 'passing', types: [{ name: 'YDS', athletes: [{ id: '1', stat: '180' }] }] },
          ],
        },
      ],
    },
  ]

  it('counts distinct games and aggregates broad stats; emits only real keys', () => {
    const rosterIds = ['CFBD-1', 'CFBD-2', 'CFBD-3']
    const nameById = new Map([['CFBD-1', 'QB One'], ['CFBD-2', 'RB Two'], ['CFBD-3', 'Bench Three']])
    const prod = buildProduction(games, 'Florida', [], 2025, rosterIds, nameById, new Map())
    ProductionSourceSchema.parse(prod)

    const qb = prod.playerProduction.find((p) => p.playerId === 'CFBD-1')!
    expect(qb.games).toBe(2) // appeared in g1 + g2
    expect(qb.stats.passYds).toBe(380) // 200 + 180
    expect(qb.stats.passCmpAtt).toBe(15) // completions from "15/27"

    const rb = prod.playerProduction.find((p) => p.playerId === 'CFBD-2')!
    expect(rb.games).toBe(1)
    expect(rb.stats.rushYds).toBe(50)

    // A roster player who never appears: present, games 0, no stat keys (true-0 vs missing)
    const bench = prod.playerProduction.find((p) => p.playerId === 'CFBD-3')!
    expect(bench.games).toBe(0)
    expect(Object.keys(bench.stats)).toHaveLength(0)
  })

  it('drops athletes not on the roster (no fabrication)', () => {
    const prod = buildProduction(games, 'Florida', [], 2025, ['CFBD-1'], new Map([['CFBD-1', 'QB One']]), new Map())
    expect(prod.playerProduction.find((p) => p.playerId === 'CFBD-2')).toBeUndefined()
  })
})

describe('advanced + context builders', () => {
  it('id-keys usage/ppa to roster players and validates', () => {
    const advanced = buildAdvancedSource({
      teamLabel: 'Florida',
      season: 2025,
      usageRows: [{ id: '1', name: 'QB One', position: 'QB', usage: { overall: 0.5, pass: 0.6 } }, { id: '999', usage: { overall: 0.1 } }],
      ppaRows: [{ id: '1', averagePPA: { all: 0.3 }, totalPPA: { all: 10 } }],
      rosterIdSet: new Set(['CFBD-1']),
      rosterNameById: new Map([['CFBD-1', 'QB One']]),
    })
    AdvancedSourceSchema.parse(advanced)
    expect(advanced.playerAdvanced).toHaveLength(1) // 999 dropped (not on roster)
    expect(advanced.playerAdvanced[0]!.usage!.overall).toBe(0.5)
    expect(advanced.playerAdvanced[0]!.ppa!.totalPPA!.all).toBe(10)
  })

  it('context returns null when no returning row, else strips non-numeric meta', () => {
    const empty = buildContextSource({ teamLabel: 'Florida', season: 2025, returningRows: [] })
    ContextSourceSchema.parse(empty)
    expect(empty.returningProduction).toBeNull()

    const ctx = buildContextSource({
      teamLabel: 'Florida',
      season: 2025,
      returningRows: [{ season: 2025, team: 'Florida', conference: 'SEC', totalPPA: 199.6, percentPPA: 0.55 }],
    })
    ContextSourceSchema.parse(ctx)
    expect(ctx.returningProduction).toEqual({ totalPPA: 199.6, percentPPA: 0.55 })
  })
})
