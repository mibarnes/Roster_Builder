/**
 * M3 CFB data collector CLI.
 *
 *   node --env-file=.env scripts/collect.ts                 → both pilots
 *   node --env-file=.env scripts/collect.ts --team=<id>     → one team (must be pilot)
 *   node --env-file=.env scripts/collect.ts --team=<id> --force-nonpilot
 *
 * Hard guards:
 *  - Refuses any non-pilot team unless --force-nonpilot is passed (NO network).
 *  - CFBD or OurLads failure for a team = hard fail (non-zero exit).
 *  - 247 recruiting may degrade gracefully (gap recorded, still writes files).
 *  - All output validated against the zod source schemas before writing.
 *
 * NEVER fabricates data: every value is sourced from CFBD / OurLads / 247.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { ProductionSourceSchema, RecruitingSourceSchema, RosterSourceSchema } from '../src/data/schema/index.ts'
import { TEAMS, getTeamById } from '../src/data/teamRegistry.ts'
import type { Team } from '../src/data/schema/index.ts'
import {
  aggregateProduction,
  fetchOurladsHtml,
  fetchRoster,
  fetchSeasonStats,
  mapRosterRows,
  type RosterPlayer,
} from './collect/cfbd.ts'
import { buildDepthChartFromOurlads } from './collect/parsers/ourlads.ts'
import { buildRecruitingSource } from './collect/recruiting.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const COLLECTED = path.join(ROOT, 'src', 'data', 'collected')

const SEASON = Number(process.env.CFBD_SEASON ?? 2025)
const RECRUITING_YEARS = [SEASON, SEASON - 1, SEASON - 2, SEASON - 3, SEASON - 4, SEASON - 5, SEASON - 6]

interface TeamResult {
  team: Team
  ok: boolean
  error?: string
  stats?: {
    rosterPlayers: number
    offenseSlots: number
    defenseSlots: number
    stubCount: number
    recruitingMatched: number
    recruitingFailedYears: number[]
    productionWithStats: number
  }
}

function parseArgs(argv: string[]): { teamId: string | null; forceNonPilot: boolean } {
  let teamId: string | null = null
  let forceNonPilot = false
  for (const arg of argv) {
    if (arg === '--force-nonpilot') forceNonPilot = true
    else if (arg.startsWith('--team=')) teamId = arg.slice('--team='.length).trim()
  }
  return { teamId, forceNonPilot }
}

function validate<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Schema validation failed for ${label}:\n${issues}`)
  }
  return result.data
}

async function collectTeam(team: Team): Promise<TeamResult> {
  const apiKey = process.env.CFBD_API_KEY
  if (!apiKey) throw new Error('Missing CFBD_API_KEY (run with --env-file=.env)')

  // ── CFBD roster + season stats (HARD requirement) ───────────────────────────
  const [rosterRows, statsRows] = await Promise.all([
    fetchRoster(team.cfbdQuery, SEASON, apiKey),
    fetchSeasonStats(team.cfbdQuery, SEASON, apiKey),
  ])
  if (!Array.isArray(rosterRows) || rosterRows.length === 0) {
    throw new Error(`CFBD returned an empty roster for ${team.cfbdQuery}`)
  }

  const allPlayers = mapRosterRows(rosterRows)
  const eligiblePlayers: RosterPlayer[] = allPlayers.filter((p) => p.side === 'OFF' || p.side === 'DEF')
  if (eligiblePlayers.length === 0) {
    throw new Error(`No OFF/DEF players after position normalization for ${team.label}`)
  }

  const rosterPlayerIds = eligiblePlayers.map((p) => p.playerId)
  const rosterNameById = new Map(eligiblePlayers.map((p) => [p.playerId, p.name]))
  const nameToPlayerId = new Map(eligiblePlayers.map((p) => [p.name.trim().toLowerCase(), p.playerId]))

  // ── OurLads depth chart (HARD requirement) ──────────────────────────────────
  const ourlads = await fetchOurladsHtml(team.ourlads.slug, team.ourlads.id)
  const parsed = buildDepthChartFromOurlads(ourlads.html, eligiblePlayers)
  if (parsed.parsedRows.offense === 0 && parsed.parsedRows.defense === 0) {
    throw new Error(`OurLads parse yielded zero rows for ${team.label} (page structure changed?)`)
  }

  // Stubs become first-class roster entries so the depth chart resolves.
  const playersWithStubs: RosterPlayer[] = [...eligiblePlayers]
  for (const stub of parsed.stubs) {
    if (!playersWithStubs.find((p) => p.playerId === stub.playerId)) {
      playersWithStubs.push(stub as unknown as RosterPlayer)
    }
  }

  const roster = {
    sourceId: 'cfbd-roster-v1',
    sourceType: 'roster' as const,
    asOf: new Date().toISOString().slice(0, 10),
    team: team.label,
    season: SEASON,
    version: 'cfbd-2026.1',
    players: playersWithStubs,
    depthChart: parsed.depthChart,
    depthChartMeta: {
      sourceId: 'ourlads-depthchart-v1',
      sourceUrl: ourlads.url,
      parsedRows: parsed.parsedRows,
      unmatchedOurladsPlayers: parsed.unmatched,
      stubPlayers: parsed.stubs,
    },
  }

  // ── Production (HARD: derived from CFBD stats) ───────────────────────────────
  const production = aggregateProduction(statsRows, nameToPlayerId, SEASON, rosterPlayerIds, rosterNameById)

  // ── Recruiting (SOFT: degrades gracefully) ──────────────────────────────────
  let recruiting
  try {
    recruiting = await buildRecruitingSource({
      teamLabel: team.label,
      teamSlug: team.slug247,
      rosterPlayers: eligiblePlayers,
      years: RECRUITING_YEARS,
    })
  } catch (error) {
    console.warn(`[recruiting] ${team.label}: builder failed entirely — ${(error as Error).message}. Writing empty recruiting file flagged partial.`)
    recruiting = {
      sourceId: '247sports-recruiting-v1',
      sourceType: 'recruiting' as const,
      asOf: new Date().toISOString().slice(0, 10),
      version: '247sports-2026.1',
      team: team.label,
      years: RECRUITING_YEARS,
      teamClassRankings: [],
      playerRecruitProfiles: eligiblePlayers.map((p) => ({ playerId: p.playerId, name: p.name })),
      unmatchedRecruits: [],
      failedYears: RECRUITING_YEARS,
      partial: true,
    }
  }

  // ── Validate against schemas BEFORE writing (fail loud, no garbage) ──────────
  const validRoster = validate(RosterSourceSchema, roster, `${team.id}/roster.json`)
  const validRecruiting = validate(RecruitingSourceSchema, recruiting, `${team.id}/recruiting.json`)
  const validProduction = validate(ProductionSourceSchema, production, `${team.id}/production.json`)

  const teamDir = path.join(COLLECTED, team.id)
  await mkdir(teamDir, { recursive: true })
  await writeFile(path.join(teamDir, 'roster.json'), `${JSON.stringify(validRoster, null, 2)}\n`, 'utf8')
  await writeFile(path.join(teamDir, 'recruiting.json'), `${JSON.stringify(validRecruiting, null, 2)}\n`, 'utf8')
  await writeFile(path.join(teamDir, 'production.json'), `${JSON.stringify(validProduction, null, 2)}\n`, 'utf8')

  const recruitingMatched = recruiting.playerRecruitProfiles.filter(
    (p) => (p as { matches?: unknown[] }).matches?.length || (p as { isTransfer?: boolean }).isTransfer,
  ).length
  const productionWithStats = production.playerProduction.filter(
    (p) => Object.keys(p).some((k) => k !== 'playerId' && k !== 'name'),
  ).length

  return {
    team,
    ok: true,
    stats: {
      rosterPlayers: eligiblePlayers.length,
      offenseSlots: Object.keys(parsed.depthChart.offense).length,
      defenseSlots: Object.keys(parsed.depthChart.defense).length,
      stubCount: parsed.stubs.length,
      recruitingMatched,
      recruitingFailedYears: recruiting.failedYears,
      productionWithStats,
    },
  }
}

async function main(): Promise<void> {
  const { teamId, forceNonPilot } = parseArgs(process.argv.slice(2))

  let targets: Team[]
  if (teamId) {
    const team = getTeamById(teamId)
    if (!team) {
      console.error(`Unknown team id: ${teamId}`)
      process.exit(1)
    }
    if (!team.isPilot && !forceNonPilot) {
      console.error(
        `REFUSING to collect non-pilot team "${teamId}". Pilots only (florida-gators, miami-hurricanes).\n` +
          `Pass --force-nonpilot to override (you almost certainly should not).`,
      )
      process.exit(2)
    }
    targets = [team]
  } else {
    targets = TEAMS.filter((t) => t.isPilot)
    if (targets.length === 0) {
      console.error('No pilot teams found in registry.')
      process.exit(1)
    }
  }

  console.log(`CFB collector — season ${SEASON}, recruiting years ${RECRUITING_YEARS.join(', ')}`)
  console.log(`Targets: ${targets.map((t) => t.id).join(', ')}\n`)

  const results: TeamResult[] = []
  for (const team of targets) {
    process.stdout.write(`Collecting ${team.label} (${team.id})... `)
    try {
      const result = await collectTeam(team)
      results.push(result)
      console.log('done')
    } catch (error) {
      results.push({ team, ok: false, error: (error as Error).message })
      console.log('FAILED')
    }
  }

  // ── Status report ───────────────────────────────────────────────────────────
  console.log('\n================ STATUS REPORT ================')
  for (const r of results) {
    if (r.ok && r.stats) {
      const s = r.stats
      const stubRatio = s.offenseSlots + s.defenseSlots > 0
        ? ((s.stubCount / (s.offenseSlots + s.defenseSlots)) * 100).toFixed(1)
        : 'n/a'
      console.log(`\n[OK]   ${r.team.label} (${r.team.id})`)
      console.log(`       roster players:        ${s.rosterPlayers}`)
      console.log(`       depth slots filled:    ${s.offenseSlots} OFF / ${s.defenseSlots} DEF`)
      console.log(`       ourlads stubs:         ${s.stubCount} (${stubRatio}% of slots)`)
      console.log(`       production w/ stats:    ${s.productionWithStats}`)
      console.log(`       recruiting matched:    ${s.recruitingMatched}`)
      if (s.recruitingFailedYears.length) {
        console.log(`       recruiting DEGRADED:   failed years ${s.recruitingFailedYears.join(', ')}`)
      }
    } else {
      console.log(`\n[FAIL] ${r.team.label} (${r.team.id})`)
      console.log(`       ${r.error}`)
    }
  }
  console.log('\n==============================================')

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.error(`\n${failed.length} team(s) FAILED — exiting non-zero. No partial garbage written for failed teams.`)
    process.exit(1)
  }
  console.log('\nAll target teams collected successfully.')
}

await main()
