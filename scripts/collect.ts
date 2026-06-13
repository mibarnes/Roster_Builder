/**
 * CFB data collector CLI (E1+E2 — enriched).
 *
 *   node --env-file=.env scripts/collect.ts                 → both pilots
 *   node --env-file=.env scripts/collect.ts --team=<id>     → one team (must be pilot)
 *   node --env-file=.env scripts/collect.ts --team=<id> --force-nonpilot
 *
 * Hard guards:
 *  - Refuses any non-pilot team unless --force-nonpilot is passed (NO network).
 *  - CFBD roster / OurLads / CFBD games / recruiting / usage / ppa / returning
 *    failure for a team = hard fail (non-zero exit). 247 scrape may degrade.
 *  - All output validated against the zod source schemas before writing.
 *
 * NEVER fabricates data: every value is sourced from CFBD / OurLads / 247.
 * Provenance + data-vintage recorded per file; prior vintage preserved in
 * _history.json (collectedAt timeline) — no silent clobber.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  AdvancedSourceSchema,
  ContextSourceSchema,
  ProductionSourceSchema,
  RecruitingSourceSchema,
  RosterSourceSchema,
  type Provenance,
} from '../src/data/schema/index.ts'
import { TEAMS, getTeamById } from '../src/data/teamRegistry.ts'
import type { Team } from '../src/data/schema/index.ts'
import {
  buildProduction,
  fetchGamesPlayers,
  fetchOurladsHtml,
  fetchPpa,
  fetchRecruitingPlayers,
  fetchReturning,
  fetchRoster,
  fetchSeasonStats,
  fetchUsage,
  gamesPlayersUrl,
  mapRosterRows,
  ppaUrl,
  recruitingPlayersUrl,
  returningUrl,
  usageUrl,
  type CfbdRecruitRow,
  type RosterPlayer,
} from './collect/cfbd.ts'
import { buildAdvancedSource, buildContextSource } from './collect/advanced.ts'
import { buildDepthChartFromOurlads, type ExtraResolver } from './collect/parsers/ourlads.ts'
import { buildIncomingRecruits, buildRecruitingSource, type IncomingRecruit, type MatchMethod, type TransferOverlayRecord } from './collect/recruiting.ts'
import { buildRosterNameIndex, inferRedshirt, resolveByStdName, stdName } from './collect/normalize.ts'
import { fetchEspnRoster } from './collect/sources/espn.ts'
import { fetchOfficialRoster } from './collect/sources/officialSite.ts'
import { fetchOn3 } from './collect/sources/on3.ts'
import { buildMaster } from './collect/reconcile/buildMaster.ts'
import {
  EspnRosterSourceSchema,
  OfficialRosterSourceSchema,
  On3SourceSchema,
  PlayerMasterSourceSchema,
  type EspnPlayer,
} from '../src/data/schema/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const COLLECTED = path.join(ROOT, 'src', 'data', 'collected')

const SEASON = Number(process.env.CFBD_SEASON ?? 2025)
/** The CURRENT roster season — the ESPN spine. CFBD 2025 (SEASON) is enrichment. */
const ROSTER_SEASON = Number(process.env.ROSTER_SEASON ?? 2026)
/**
 * Recruiting classes to fetch from CFBD. Anchored to the ROSTER season so the
 * INCOMING classes (ROSTER_SEASON+1 … the 2026/2027 HS signees) are included —
 * those recruits carry athleteId:null (not yet on a college roster) and are
 * name-matched to the ESPN spine downstream. Spans down to SEASON-5 to keep the
 * returning-player recruiting history (5th-years recruited ~2020).
 */
const RECRUITING_YEARS = ((): number[] => {
  const top = ROSTER_SEASON + 1
  const bottom = SEASON - 5
  const years: number[] = []
  for (let y = top; y >= bottom; y -= 1) years.push(y)
  return years
})()

/** git short SHA at runtime; 'dev' if unavailable. */
const collectorVersion = ((): string => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim() || 'dev'
  } catch {
    return 'dev'
  }
})()

interface TeamResult {
  team: Team
  ok: boolean
  error?: string
  stats?: {
    rosterPlayers: number
    offenseSlots: number
    defenseSlots: number
    stubBefore: number
    stubAfter: number
    recruitingPct: number
    recruitByMethod: Record<MatchMethod, number>
    productionPct: number
    gamesDistribution: Record<string, number>
    hometownPct: number
    usagePct: number
    ppaPct: number
    has247Degraded: number[]
    /** Master reconciliation summary (ESPN-spine pilot round). */
    master?: {
      spineCount: number
      masterCount: number
      matchedByIdPct: number
      walkOns: number
      newIn2026: number
      unrated: number
      isTransfer: number
      headshotPct: number
      highSchoolPct: number
      hometownPct: number
      productionReturningPct: number
      conflicts: Record<string, number>
      officialDegraded: boolean
      officialEngine: string
      officialCoverage: number
      on3Degraded: boolean
    }
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

const nowIso = (): string => new Date().toISOString()

function makeProvenance(sources: { name: string; endpoint: string }[], dataSeason: number = SEASON): Provenance {
  return {
    sources,
    collectedAt: nowIso(),
    collectorVersion,
    dataSeason,
    dataCutoff: null,
  }
}

interface HistoryEntry { file: string; collectedAt: string; collectorVersion: string | null; supersededAt: string }

/**
 * Preserve prior vintage: for each file we are about to overwrite, read its
 * existing provenance.collectedAt (if any) and append it to _history.json — a
 * single serialized read-modify-write so the timeline can't be corrupted by
 * concurrent updates. Fail-soft: a missing/corrupt prior file = no entry.
 */
async function recordHistory(teamDir: string, files: string[]): Promise<void> {
  const historyPath = path.join(teamDir, '_history.json')
  const supersededAt = nowIso()
  const newEntries: HistoryEntry[] = []
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(path.join(teamDir, file), 'utf8')) as {
        provenance?: { collectedAt?: string; collectorVersion?: string }
      }
      const collectedAt = raw.provenance?.collectedAt
      if (collectedAt) {
        newEntries.push({ file, collectedAt, collectorVersion: raw.provenance?.collectorVersion ?? null, supersededAt })
      }
    } catch {
      // no prior file (or unreadable) — nothing to preserve for this one
    }
  }
  if (newEntries.length === 0) return

  let history: HistoryEntry[] = []
  try {
    const parsed = JSON.parse(await readFile(historyPath, 'utf8')) as unknown
    if (Array.isArray(parsed)) history = parsed as HistoryEntry[]
  } catch {
    history = []
  }
  history.push(...newEntries)
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8')
}

async function collectTeam(team: Team): Promise<TeamResult> {
  const apiKey = process.env.CFBD_API_KEY
  if (!apiKey) throw new Error('Missing CFBD_API_KEY (run with --env-file=.env)')

  // ── CFBD core fetches (ALL hard requirements) ───────────────────────────────
  const [rosterRows, statsRows, games, usageRows, ppaRows, returningRows] = await Promise.all([
    fetchRoster(team.cfbdQuery, SEASON, apiKey),
    fetchSeasonStats(team.cfbdQuery, SEASON, apiKey),
    fetchGamesPlayers(team.cfbdQuery, SEASON, apiKey),
    fetchUsage(team.cfbdQuery, SEASON, apiKey),
    fetchPpa(team.cfbdQuery, SEASON, apiKey),
    fetchReturning(team.cfbdQuery, SEASON, apiKey),
  ])
  if (!Array.isArray(rosterRows) || rosterRows.length === 0) {
    throw new Error(`CFBD returned an empty roster for ${team.cfbdQuery}`)
  }
  if (!Array.isArray(games) || games.length === 0) {
    throw new Error(`CFBD /games/players returned no games for ${team.cfbdQuery}`)
  }

  const allPlayers = mapRosterRows(rosterRows)
  const eligiblePlayers: RosterPlayer[] = allPlayers.filter((p) => p.side === 'OFF' || p.side === 'DEF')
  if (eligiblePlayers.length === 0) {
    throw new Error(`No OFF/DEF players after position normalization for ${team.label}`)
  }

  const rosterPlayerIds = eligiblePlayers.map((p) => p.playerId)
  const rosterIdSet = new Set(rosterPlayerIds)
  const rosterNameById = new Map(eligiblePlayers.map((p) => [p.playerId, p.name]))
  const nameToPlayerId = new Map(eligiblePlayers.map((p) => [p.name.trim().toLowerCase(), p.playerId]))

  // ── CFBD recruiting (id-keyed, PRIMARY) — hard requirement ──────────────────
  const cfbdRecruitsByYear = new Map<number, CfbdRecruitRow[]>()
  await Promise.all(
    RECRUITING_YEARS.map(async (year) => {
      const rows = await fetchRecruitingPlayers(team.cfbdQuery, year, apiKey)
      cfbdRecruitsByYear.set(year, Array.isArray(rows) ? rows : [])
    }),
  )

  // Build a recruit name→playerId pool from EVERY CFBD recruit with an
  // athleteId (across all years) for stub reduction: an OurLads depth name
  // matching a known CFBD recruit resolves to that real CFBD id instead of
  // minting an ourlads-stub-*. (Roster players are already resolved by the
  // primary index; this rescues real players CFBD knows as recruits but that
  // are absent from the season roster snapshot.)
  const recruitNamePool: { playerId: string; name?: string; position: string; eligibilityRemaining?: number | null }[] = []
  const seenRecruitPid = new Set<string>()
  for (const rows of cfbdRecruitsByYear.values()) {
    for (const r of rows) {
      const athleteId = r.athleteId
      const pid = athleteId != null && String(athleteId).trim() !== '' ? `CFBD-${athleteId}` : null
      if (pid && r.name && !seenRecruitPid.has(pid)) {
        seenRecruitPid.add(pid)
        recruitNamePool.push({ playerId: pid, name: r.name, position: r.position ?? '', eligibilityRemaining: null })
      }
    }
  }
  // Incoming-class recruits (athleteId null = 2026/2027 HS signees) — these are
  // NOT on the CFBD-2025 roster, so they're name-matched to the ESPN spine in
  // the reconciler (GAP A) so new-2026 players get rated instead of UNRATED.
  const incomingRecruits = buildIncomingRecruits(cfbdRecruitsByYear)

  const recruitIndex = buildRosterNameIndex(recruitNamePool)
  const extraResolve: ExtraResolver = (name, position) => {
    if (!stdName(name)) return null
    const pid =
      resolveByStdName({
        ourladsName: name,
        ourladsPosition: position || null,
        rosterByStdName: recruitIndex.rosterByStdName,
        rosterNamePairs: recruitIndex.rosterNamePairs,
      })?.playerId ?? null
    // Only accept a hit that resolves to an actual roster player, so we never
    // create a depth-chart reference to a non-roster id (would dangle).
    return pid && rosterIdSet.has(pid) ? pid : null
  }

  // ── OurLads depth chart (HARD) — measure stub before/after reduction ────────
  const ourlads = await fetchOurladsHtml(team.ourlads.slug, team.ourlads.id)
  const baseline = buildDepthChartFromOurlads(ourlads.html, eligiblePlayers) // no extra resolver
  const parsed = buildDepthChartFromOurlads(ourlads.html, eligiblePlayers, extraResolve)
  if (parsed.parsedRows.offense === 0 && parsed.parsedRows.defense === 0) {
    throw new Error(`OurLads parse yielded zero rows for ${team.label} (page structure changed?)`)
  }
  const stubBefore = baseline.stubs.length
  const stubAfter = parsed.stubs.length

  // Stubs become first-class roster entries so the depth chart resolves.
  const playersWithStubs: RosterPlayer[] = [...eligiblePlayers]
  for (const stub of parsed.stubs) {
    if (!playersWithStubs.find((p) => p.playerId === stub.playerId)) {
      playersWithStubs.push(stub as unknown as RosterPlayer)
    }
  }

  const rosterProvenance = makeProvenance([
    { name: 'CFBD roster', endpoint: `/roster?year=${SEASON}&team=${team.cfbdQuery}` },
    { name: 'OurLads depth chart', endpoint: ourlads.url },
  ])

  const roster = {
    sourceId: 'cfbd-roster-v2',
    sourceType: 'roster' as const,
    asOf: new Date().toISOString().slice(0, 10),
    team: team.label,
    season: SEASON,
    version: 'cfbd-2026.2',
    provenance: rosterProvenance,
    players: playersWithStubs,
    depthChart: parsed.depthChart,
    depthChartMeta: {
      sourceId: 'ourlads-depthchart-v1',
      sourceUrl: ourlads.url,
      parsedRows: parsed.parsedRows,
      unmatchedOurladsPlayers: parsed.unmatched,
      stubPlayers: parsed.stubs,
      stubReduction: { before: stubBefore, after: stubAfter },
    },
  }

  // ── Production (PRIMARY /games/players + RATING/QBR from season stats) ───────
  const production = {
    ...buildProduction(games, team.cfbdQuery, statsRows, SEASON, rosterPlayerIds, rosterNameById, nameToPlayerId),
    team: team.label,
    provenance: makeProvenance([
      { name: 'CFBD games/players', endpoint: gamesPlayersUrl(team.cfbdQuery, SEASON) },
      { name: 'CFBD stats/player/season', endpoint: `/stats/player/season?year=${SEASON}&team=${team.cfbdQuery}` },
    ]),
  }

  // ── Advanced (usage + ppa) ──────────────────────────────────────────────────
  const advanced = {
    ...buildAdvancedSource({ teamLabel: team.label, season: SEASON, usageRows, ppaRows, rosterIdSet, rosterNameById }),
    provenance: makeProvenance([
      { name: 'CFBD player/usage', endpoint: usageUrl(team.cfbdQuery, SEASON) },
      { name: 'CFBD ppa/players/season', endpoint: ppaUrl(team.cfbdQuery, SEASON) },
    ]),
  }

  // ── Context (returning production) ──────────────────────────────────────────
  const context = {
    ...buildContextSource({ teamLabel: team.label, season: SEASON, returningRows }),
    provenance: makeProvenance([{ name: 'CFBD player/returning', endpoint: returningUrl(team.cfbdQuery, SEASON) }]),
  }

  // ── Recruiting (CFBD-primary id-keyed + 247 supplement) ─────────────────────
  // `transferOverlay` (247 transfer-portal records by name) is captured here and
  // kept OUT of the persisted recruiting.json — it's threaded to the reconciler
  // to name-match the team's incoming transfers onto the ESPN spine (GAP C).
  let recruiting
  let transferOverlay: TransferOverlayRecord[] = []
  try {
    const { transferOverlay: overlay, ...recruitingSource } = await buildRecruitingSource({
      teamLabel: team.label,
      teamSlug: team.slug247,
      rosterPlayers: eligiblePlayers,
      years: RECRUITING_YEARS,
      cfbdRecruitsByYear,
    })
    transferOverlay = overlay
    recruiting = {
      ...recruitingSource,
      provenance: makeProvenance([
        ...RECRUITING_YEARS.map((y) => ({ name: `CFBD recruiting/players ${y}`, endpoint: recruitingPlayersUrl(team.cfbdQuery, y) })),
        { name: '247Sports commits scrape', endpoint: `https://247sports.com/college/${team.slug247}/season/<year>-football/commits/` },
      ]),
    }
  } catch (error) {
    console.warn(`[recruiting] ${team.label}: builder failed entirely — ${(error as Error).message}.`)
    recruiting = {
      sourceId: 'cfbd-247-recruiting-v2',
      sourceType: 'recruiting' as const,
      asOf: new Date().toISOString().slice(0, 10),
      version: 'recruiting-2026.2',
      team: team.label,
      years: RECRUITING_YEARS,
      provenance: makeProvenance([]),
      teamClassRankings: [],
      playerRecruitProfiles: eligiblePlayers.map((p) => ({ playerId: p.playerId, name: p.name, matchMethod: 'none' as const })),
      unmatchedRecruits: [],
      failedYears: RECRUITING_YEARS,
      partial: true,
      matchSummary: { 'cfbd-id': 0, '247-id': 0, 'name-fuzzy': 0, none: eligiblePlayers.length } as Record<MatchMethod, number>,
    }
  }

  // ── Derive redshirt from recruiting tenure (CFBD roster carries no RS flag) ──
  // Mutates players in place; `roster.players` is the same array reference.
  const earliestYearByPid = new Map<string, number>()
  for (const prof of recruiting.playerRecruitProfiles) {
    const yrs = (prof as { years?: number[] }).years
    if (yrs && yrs.length > 0) earliestYearByPid.set(prof.playerId, Math.min(...yrs))
  }
  for (const p of playersWithStubs) {
    p.isRedshirt = inferRedshirt(p.classYear ?? null, earliestYearByPid.get(p.playerId) ?? null, SEASON, Boolean(p.isTransfer))
  }

  // ── Validate against schemas BEFORE writing (fail loud, no garbage) ─────────
  const validRoster = validate(RosterSourceSchema, roster, `${team.id}/roster.json`)
  const validRecruiting = validate(RecruitingSourceSchema, recruiting, `${team.id}/recruiting.json`)
  const validProduction = validate(ProductionSourceSchema, production, `${team.id}/production.json`)
  const validAdvanced = validate(AdvancedSourceSchema, advanced, `${team.id}/advanced.json`)
  const validContext = validate(ContextSourceSchema, context, `${team.id}/context.json`)

  const teamDir = path.join(COLLECTED, team.id)
  await mkdir(teamDir, { recursive: true })

  // Preserve prior vintage before overwriting (no silent clobber).
  await recordHistory(teamDir, ['roster.json', 'recruiting.json', 'production.json', 'advanced.json', 'context.json'])

  const write = (file: string, data: unknown) =>
    writeFile(path.join(teamDir, file), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await write('roster.json', validRoster)
  await write('recruiting.json', validRecruiting)
  await write('production.json', validProduction)
  await write('advanced.json', validAdvanced)
  await write('context.json', validContext)

  // ════════════════════════════════════════════════════════════════════════════
  //  PILOT-DEEPENING: ESPN 2026 spine → reconciled golden player-master.json
  //  Only wired for pilots that carry an espnId. The CFBD-2025 enrichment above
  //  (recruiting/production/advanced) is keyed CFBD-<athleteId> === CFBD-<espnId>,
  //  so it joins DIRECTLY to the ESPN spine. Official/On3 are best-effort overlays.
  // ════════════════════════════════════════════════════════════════════════════
  let masterStats: NonNullable<TeamResult['stats']>['master']
  if (team.espnId) {
    masterStats = await buildAndWriteMaster({
      team,
      teamDir,
      write,
      recruitingProfiles: validRecruiting.playerRecruitProfiles,
      incomingRecruits,
      transferOverlay,
      productionEntries: validProduction.playerProduction,
      advancedEntries: validAdvanced.playerAdvanced,
      cfbdRosterIds: new Set(eligiblePlayers.map((p) => p.playerId)),
      ourladsHtml: ourlads.html,
      returningProduction: validContext.returningProduction,
    })
  }

  // ── Compute status stats ────────────────────────────────────────────────────
  const rosterN = eligiblePlayers.length
  const recruitingMatched = recruiting.playerRecruitProfiles.filter(
    (p) => (p as { matchMethod?: MatchMethod }).matchMethod && (p as { matchMethod?: MatchMethod }).matchMethod !== 'none',
  ).length
  const recruitByMethod = (recruiting as { matchSummary?: Record<MatchMethod, number> }).matchSummary ?? {
    'cfbd-id': 0, '247-id': 0, 'name-fuzzy': 0, none: rosterN,
  }

  const rosterProdSet = new Set(rosterPlayerIds)
  const prodForRoster = validProduction.playerProduction.filter((p) => rosterProdSet.has(p.playerId))
  const productionWithGames = prodForRoster.filter((p) => (p.games ?? 0) > 0).length
  const gamesDistribution: Record<string, number> = {}
  for (const p of prodForRoster) {
    const g = String(p.games ?? 0)
    gamesDistribution[g] = (gamesDistribution[g] ?? 0) + 1
  }

  const hometownN = eligiblePlayers.filter((p) => p.homeCity || p.homeState).length
  const usageN = validAdvanced.playerAdvanced.filter((p) => p.usage).length
  const ppaN = validAdvanced.playerAdvanced.filter((p) => p.ppa).length

  return {
    team,
    ok: true,
    stats: {
      rosterPlayers: rosterN,
      offenseSlots: Object.keys(parsed.depthChart.offense).length,
      defenseSlots: Object.keys(parsed.depthChart.defense).length,
      stubBefore,
      stubAfter,
      recruitingPct: rosterN ? (recruitingMatched / rosterN) * 100 : 0,
      recruitByMethod,
      productionPct: rosterN ? (productionWithGames / rosterN) * 100 : 0,
      gamesDistribution,
      hometownPct: rosterN ? (hometownN / rosterN) * 100 : 0,
      usagePct: rosterN ? (usageN / rosterN) * 100 : 0,
      ppaPct: rosterN ? (ppaN / rosterN) * 100 : 0,
      has247Degraded: recruiting.failedYears,
      master: masterStats,
    },
  }
}

/**
 * Fetch the ESPN 2026 spine + best-effort official/On3 overlays, reconcile them
 * with the CFBD-2025 enrichment (DIRECT id join), write sources/*.json + the
 * golden player-master.json, and return the report summary for the status print.
 *
 * ESPN is HARD (throws on failure → hard team fail). Official/On3 DEGRADE (flagged,
 * never throw). Asserts the coverage guarantee: masterCount ≥ spineCount.
 */
async function buildAndWriteMaster({
  team,
  teamDir,
  write,
  recruitingProfiles,
  incomingRecruits,
  transferOverlay,
  productionEntries,
  advancedEntries,
  cfbdRosterIds,
  ourladsHtml,
  returningProduction,
}: {
  team: Team
  teamDir: string
  write: (file: string, data: unknown) => Promise<void>
  recruitingProfiles: { playerId: string; name?: string; matchMethod?: MatchMethod; years?: number[] }[]
  incomingRecruits: IncomingRecruit[]
  transferOverlay: TransferOverlayRecord[]
  productionEntries: { playerId: string }[]
  advancedEntries: { playerId: string }[]
  cfbdRosterIds: Set<string>
  ourladsHtml: string
  returningProduction: Record<string, number | null> | null
}): Promise<NonNullable<TeamResult['stats']>['master']> {
  const sourcesDir = path.join(teamDir, 'sources')
  await mkdir(sourcesDir, { recursive: true })
  const writeSource = (file: string, data: unknown) =>
    writeFile(path.join(sourcesDir, file), `${JSON.stringify(data, null, 2)}\n`, 'utf8')

  // ── ESPN spine (HARD) ──
  // Include OFF + DEF + ST (kickers/punters/long-snappers). ST players are
  // typically unrated/projection — they flow through crosswalk → merge → master
  // and the rating model treats 'ST' gracefully (sideBucket 'ST').
  const espn = await fetchEspnRoster(team.espnId!)
  const espnSpine: EspnPlayer[] = espn.players.filter(
    (p) => p.side === 'OFF' || p.side === 'DEF' || p.side === 'ST',
  )
  const espnSource = validate(
    EspnRosterSourceSchema,
    {
      sourceId: 'espn-roster-v1',
      sourceType: 'espn-roster',
      team: team.label,
      season: espn.season || ROSTER_SEASON,
      espnTeamId: team.espnId!,
      provenance: makeProvenance([{ name: 'ESPN site API roster', endpoint: espn.url }], ROSTER_SEASON),
      players: espnSpine,
    },
    `${team.id}/sources/espn-roster.json`,
  )
  await writeSource('espn-roster.json', espnSource)

  // ── Official site overlay (BEST-EFFORT, degrade) ──
  const officialUrl = team.officialRosterUrl ?? ''
  const official = officialUrl
    ? await fetchOfficialRoster(officialUrl)
    : { engine: 'unknown', degraded: true, degradeReason: 'no officialRosterUrl in registry', players: [] }
  const officialCoverage = official.players.filter(
    (p) => p.highSchool || p.previousSchool || p.hometown,
  ).length
  const officialSource = validate(
    OfficialRosterSourceSchema,
    {
      sourceId: 'official-roster-v1',
      sourceType: 'official-roster',
      team: team.label,
      sourceUrl: officialUrl,
      engine: official.engine,
      degraded: official.degraded,
      degradeReason: official.degradeReason ?? null,
      coverage: officialCoverage,
      provenance: makeProvenance([{ name: 'Official team roster page', endpoint: officialUrl }], ROSTER_SEASON),
      players: official.players,
    },
    `${team.id}/sources/official-roster.json`,
  )
  await writeSource('official-roster.json', officialSource)

  // ── On3 / Rivals fact-check (BEST-EFFORT, degrade) ──
  const on3 = await fetchOn3(team.slug247)
  const on3Source = validate(
    On3SourceSchema,
    {
      sourceId: 'on3-v1',
      sourceType: 'on3',
      team: team.label,
      degraded: on3.degraded,
      degradeReason: on3.degradeReason ?? null,
      provenance: makeProvenance([{ name: 'On3/Rivals roster', endpoint: `on3:${team.slug247}` }], ROSTER_SEASON),
      players: on3.players,
    },
    `${team.id}/sources/on3.json`,
  )
  await writeSource('on3.json', on3Source)

  // ── Reconcile → golden master ──
  const { master, spineCount } = buildMaster({
    teamLabel: team.label,
    rosterSeason: ROSTER_SEASON,
    productionSeason: SEASON,
    espnPlayers: espnSpine,
    officialPlayers: official.players,
    officialDegraded: official.degraded,
    on3Players: on3.players,
    on3Degraded: on3.degraded,
    recruitingProfiles: recruitingProfiles as never,
    incomingRecruits,
    transferOverlay,
    productionEntries: productionEntries as never,
    advancedEntries: advancedEntries as never,
    cfbdRosterIds,
    ourladsHtml,
    returningProduction,
    provenance: {
      ...makeProvenance(
        [
          { name: 'ESPN site API roster (spine)', endpoint: espn.url },
          { name: 'CFBD 2025 enrichment', endpoint: `/recruiting,games,usage,ppa year=${SEASON}` },
          { name: 'Official team roster page', endpoint: officialUrl },
          { name: 'OurLads depth chart', endpoint: `ourlads:${team.ourlads.slug}` },
        ],
        ROSTER_SEASON,
      ),
      rosterSeason: ROSTER_SEASON,
      productionSeason: SEASON,
    },
  })

  // Coverage guarantee: every spine player → a master record (≥, stubs may add more).
  if (master.players.length < spineCount) {
    throw new Error(
      `Coverage guarantee FAILED for ${team.label}: masterCount ${master.players.length} < spineCount ${spineCount}`,
    )
  }

  const validMaster = validate(PlayerMasterSourceSchema, master, `${team.id}/player-master.json`)
  await write('player-master.json', validMaster)

  const r = validMaster.reconciliation
  return {
    spineCount: r.spineCount,
    masterCount: r.masterCount,
    matchedByIdPct: r.matchedByIdPct,
    walkOns: r.walkOns,
    newIn2026: r.newIn2026,
    unrated: r.unrated,
    isTransfer: r.isTransfer,
    headshotPct: r.headshotPct,
    highSchoolPct: r.highSchoolPct,
    hometownPct: r.hometownPct,
    productionReturningPct: r.productionReturningPct,
    conflicts: r.perFieldConflictCounts,
    officialDegraded: official.degraded,
    officialEngine: official.engine,
    officialCoverage,
    on3Degraded: on3.degraded,
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

  console.log(`CFB collector — season ${SEASON}, recruiting years ${RECRUITING_YEARS.join(', ')}, collectorVersion ${collectorVersion}`)
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
  const pct = (v: number) => `${v.toFixed(1)}%`
  console.log('\n================ STATUS REPORT ================')
  for (const r of results) {
    if (r.ok && r.stats) {
      const s = r.stats
      console.log(`\n[OK]   ${r.team.label} (${r.team.id})`)
      console.log(`       roster players:        ${s.rosterPlayers}`)
      console.log(`       depth slots filled:    ${s.offenseSlots} OFF / ${s.defenseSlots} DEF`)
      console.log(`       ourlads stubs:         ${s.stubBefore} → ${s.stubAfter} (reduced ${s.stubBefore - s.stubAfter})`)
      console.log(`       recruiting coverage:   ${pct(s.recruitingPct)}  [cfbd-id ${s.recruitByMethod['cfbd-id']} / 247-id ${s.recruitByMethod['247-id']} / fuzzy ${s.recruitByMethod['name-fuzzy']} / none ${s.recruitByMethod.none}]`)
      console.log(`       production (≥1 game):  ${pct(s.productionPct)}`)
      console.log(`       games-played dist:     ${Object.entries(s.gamesDistribution).sort((a, b) => Number(a[0]) - Number(b[0])).map(([g, n]) => `${g}g:${n}`).join(' ')}`)
      console.log(`       hometown coverage:     ${pct(s.hometownPct)}`)
      console.log(`       usage coverage:        ${pct(s.usagePct)}`)
      console.log(`       ppa coverage:          ${pct(s.ppaPct)}`)
      if (s.has247Degraded.length) {
        console.log(`       247 DEGRADED years:    ${s.has247Degraded.join(', ')}`)
      }
      if (s.master) {
        const m = s.master
        const conflicts = Object.entries(m.conflicts)
        console.log(`       ── RECONCILED MASTER (2026 ESPN spine) ──`)
        console.log(`       spine → master:        ${m.spineCount} → ${m.masterCount} (coverage 100%${m.masterCount > m.spineCount ? `, +${m.masterCount - m.spineCount} depth stubs` : ''})`)
        console.log(`       matched by id:         ${pct(m.matchedByIdPct)}`)
        console.log(`       flags:                 walkOns ${m.walkOns} / new-2026 ${m.newIn2026} / unrated ${m.unrated} / transfers ${m.isTransfer}`)
        console.log(`       headshot / hometown:   ${pct(m.headshotPct)} / ${pct(m.hometownPct)}`)
        console.log(`       highSchool coverage:   ${pct(m.highSchoolPct)}`)
        console.log(`       production returning:  ${pct(m.productionReturningPct)}`)
        console.log(`       conflicts:             ${conflicts.length ? conflicts.map(([f, n]) => `${f}:${n}`).join(' ') : 'none'}`)
        console.log(`       official overlay:      ${m.officialDegraded ? `DEGRADED (${m.officialEngine})` : `OK (${m.officialEngine}, ${m.officialCoverage} players w/ HS/prev/hometown)`}`)
        console.log(`       on3 overlay:           ${m.on3Degraded ? 'DEGRADED (expected)' : 'OK'}`)
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
