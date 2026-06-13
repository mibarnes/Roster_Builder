/**
 * Data-QA gate (M2): validates that every seeded team's on-disk JSON conforms to
 * the zod source schemas, and that the registry is internally consistent. This is
 * the audit of the carried recovered data — a misfit fails CI (logged, not coerced).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AdvancedSourceSchema,
  ContextSourceSchema,
  EspnRosterSourceSchema,
  OfficialRosterSourceSchema,
  On3SourceSchema,
  PlayerMasterSourceSchema,
  ProductionSourceSchema,
  RecruitingSourceSchema,
  RosterSourceSchema,
} from './schema/index.ts'
import { DEFAULT_TEAM_ID, TEAMS, getTeamById } from './teamRegistry.ts'

const COLLECTED = join(process.cwd(), 'src/data/collected')

function seededTeamDirs(): string[] {
  if (!existsSync(COLLECTED)) return []
  return readdirSync(COLLECTED, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

const seeded = seededTeamDirs()

describe('teamRegistry', () => {
  it('has 33 teams with two pilots (Florida + Miami)', () => {
    expect(TEAMS.length).toBe(33)
    const pilots = TEAMS.filter((t) => t.isPilot).map((t) => t.id).sort()
    expect(pilots).toEqual(['florida-gators', 'miami-hurricanes'])
  })

  it('has unique ids and a resolvable default', () => {
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    expect(getTeamById(DEFAULT_TEAM_ID)).toBeDefined()
  })

  it('every team has a valid accent color + data-source keys', () => {
    for (const t of TEAMS) {
      expect(t.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(t.cfbdQuery.length).toBeGreaterThan(0)
      expect(t.slug247.length).toBeGreaterThan(0)
      expect(t.ourlads.id).toMatch(/^\d+$/)
    }
  })

  it('does not include the dropped Alabama mock placeholder', () => {
    expect(getTeamById('alabama-crimson-tide')).toBeUndefined()
  })
})

describe('seeded data conformance', () => {
  it('found seeded team directories', () => {
    expect(seeded.length).toBeGreaterThanOrEqual(32)
  })

  it.each(seeded)('%s: roster/recruiting/production parse against the schemas', (team) => {
    const read = (f: string) => JSON.parse(readFileSync(join(COLLECTED, team, f), 'utf8'))
    const roster = RosterSourceSchema.parse(read('roster.json'))
    expect(roster.players.length).toBeGreaterThan(0)
    // seeded teams are REAL captures (not mock): v1 = original M3, v2 = E1/E2 re-collect
    expect(roster.sourceId).toMatch(/^cfbd-roster-v[12]$/)
    RecruitingSourceSchema.parse(read('recruiting.json'))
    ProductionSourceSchema.parse(read('production.json'))
  })

  // E1/E2 enriched files (advanced/context) exist only for re-collected pilots.
  it.each(seeded)('%s: advanced/context parse when present (E1/E2)', (team) => {
    const teamDir = join(COLLECTED, team)
    if (existsSync(join(teamDir, 'advanced.json'))) {
      const advanced = AdvancedSourceSchema.parse(JSON.parse(readFileSync(join(teamDir, 'advanced.json'), 'utf8')))
      expect(advanced.sourceType).toBe('advanced')
      expect(advanced.provenance?.dataSeason).toBeGreaterThan(0)
    }
    if (existsSync(join(teamDir, 'context.json'))) {
      const context = ContextSourceSchema.parse(JSON.parse(readFileSync(join(teamDir, 'context.json'), 'utf8')))
      expect(context.sourceType).toBe('context')
    }
  })

  it('every seeded team is a known registry team', () => {
    for (const team of seeded) {
      expect(getTeamById(team), `seeded team ${team} not in registry`).toBeDefined()
    }
  })

  // Pilot-deepening: the golden player-master.json + sources/* (pilots only).
  it.each(seeded)('%s: player-master.json + sources validate when present (pilot round)', (team) => {
    const teamDir = join(COLLECTED, team)
    const masterPath = join(teamDir, 'player-master.json')
    if (!existsSync(masterPath)) return // non-pilot: no master yet
    const master = PlayerMasterSourceSchema.parse(JSON.parse(readFileSync(masterPath, 'utf8')))
    // 100% spine coverage: every spine player → a master record (stubs may add more).
    expect(master.players.length).toBe(master.reconciliation.masterCount)
    expect(master.players.length).toBeGreaterThanOrEqual(master.reconciliation.spineCount)
    expect(master.provenance.rosterSeason).toBe(2026)
    // No secret leakage in the golden file.
    expect(JSON.stringify(master)).not.toMatch(/Bearer |CFBD_API_KEY/)

    const sourcesDir = join(teamDir, 'sources')
    EspnRosterSourceSchema.parse(JSON.parse(readFileSync(join(sourcesDir, 'espn-roster.json'), 'utf8')))
    OfficialRosterSourceSchema.parse(JSON.parse(readFileSync(join(sourcesDir, 'official-roster.json'), 'utf8')))
    On3SourceSchema.parse(JSON.parse(readFileSync(join(sourcesDir, 'on3.json'), 'utf8')))
  })
})
