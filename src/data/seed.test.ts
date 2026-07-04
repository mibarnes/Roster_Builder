/**
 * Data-QA gate (M2): validates that every seeded team's on-disk JSON conforms to
 * the zod source schemas, and that the registry is internally consistent. This is
 * the audit of the carried recovered data — a misfit fails CI (logged, not coerced).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EspnRosterSourceSchema,
  OfficialRosterSourceSchema,
  On3SourceSchema,
  PlayerMasterSourceSchema,
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
  it('has 54 collected teams with two pilots (Florida + Miami)', () => {
    // 33 ACC/SEC/ND + 18 Big Ten + 3 Big 12 (Utah/Arizona State/Texas Tech). The
    // other 13 Big 12 teams are pending a CFBD quota reset (docs/PENDING_TEAMS.md) —
    // trimmed from the registry so it stays == teams with data.
    expect(TEAMS.length).toBe(54)
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

  it('every seeded team is a known registry team', () => {
    for (const team of seeded) {
      expect(getTeamById(team), `seeded team ${team} not in registry`).toBeDefined()
    }
  })

  // Every team is served from the golden player-master.json + sources/* (D1b: the
  // legacy roster/recruiting/production/advanced/context.json are no longer written).
  it.each(seeded)('%s: player-master.json + sources validate (single data path)', (team) => {
    const teamDir = join(COLLECTED, team)
    const masterPath = join(teamDir, 'player-master.json')
    expect(existsSync(masterPath), `${team} must ship a golden master (single data path)`).toBe(true)
    const master = PlayerMasterSourceSchema.parse(JSON.parse(readFileSync(masterPath, 'utf8')))
    // Real capture (not synthetic): a non-empty reconciled spine.
    expect(master.reconciliation.spineCount).toBeGreaterThan(0)
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
