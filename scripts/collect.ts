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
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
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
import { getNetStats } from './collect/net.ts'
import { buildDepthChartFromOurlads, type ExtraResolver } from './collect/parsers/ourlads.ts'
import { buildIncomingRecruits, buildRecruitingSource, type IncomingRecruit, type MatchMethod, type TransferOverlayRecord } from './collect/recruiting.ts'
import { buildRosterNameIndex, inferRedshirt, resolveByStdName, stdName } from './collect/normalize.ts'
import { fetchEspnRoster } from './collect/sources/espn.ts'
import { fetchOfficialRoster } from './collect/sources/officialSite.ts'
import { fetchOn3 } from './collect/sources/on3.ts'
import { fetchNationalRecruitingIndex, type NationalRecruitingIndex } from './collect/sources/cfbdRecruitingIndex.ts'
import { fetchPortal, incomingTransfers, type PortalFetchResult, type PortalIncoming } from './collect/sources/cfbdPortal.ts'
import { PortalSourceSchema } from '../src/data/schema/index.ts'
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

/**
 * C2 — national recruiting index years (CFBD `/recruiting/players?year=X`, no
 * team). Spans 2019..ROSTER_SEASON: the cross-school index that rates spine
 * players the team's OWN feed never recruited (transfers' HS rating, walk-ons
 * recruited elsewhere, 2026 freshmen). Fetched ONCE per run, shared by pilots.
 */
const NATIONAL_RECRUITING_YEARS = ((): number[] => {
  const years: number[] = []
  for (let y = ROSTER_SEASON; y >= 2019; y -= 1) years.push(y)
  return years
})()

/** C2 — CFBD transfer-portal years (`/player/portal?year=Y`). */
const PORTAL_YEARS = [ROSTER_SEASON - 2, ROSTER_SEASON - 1, ROSTER_SEASON]

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
      // ── C2 closure telemetry ──
      transfersRated: number
      transfersTotal: number
      recruitSourceCounts: Record<string, number>
      stubReductionMaster: { before: number; after: number }
      natlIdMatches: number
      natlNameMatches: number
      portalIncomingCount: number
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
async function recordHistory(readDir: string, writeDir: string, files: string[]): Promise<void> {
  const supersededAt = nowIso()
  const newEntries: HistoryEntry[] = []
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(path.join(readDir, file), 'utf8')) as {
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

  // Read the prior _history from the OLD dir, append, write the merged log to the
  // staging dir so it commits atomically with the rest of the team's outputs.
  let history: HistoryEntry[] = []
  try {
    const parsed = JSON.parse(await readFile(path.join(readDir, '_history.json'), 'utf8')) as unknown
    if (Array.isArray(parsed)) history = parsed as HistoryEntry[]
  } catch {
    history = []
  }
  history.push(...newEntries)
  await writeFile(path.join(writeDir, '_history.json'), `${JSON.stringify(history, null, 2)}\n`, 'utf8')
}

/**
 * Atomic commit for a team's staged outputs: rename every file from the sibling
 * `.staging` dir into the real team dir (one directory level deep — the flat
 * layer-1/master files + the `sources/` subdir). Rename is atomic per file on the
 * same filesystem; called only after every output staged successfully.
 */
async function commitStaging(stagingDir: string, teamDir: string): Promise<void> {
  const entries = await readdir(stagingDir, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(stagingDir, entry.name)
    const to = path.join(teamDir, entry.name)
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true })
      for (const child of await readdir(from, { withFileTypes: true })) {
        await rename(path.join(from, child.name), path.join(to, child.name))
      }
    } else {
      await rename(from, to)
    }
  }
}

/** Run-wide CFBD-native recruiting closure, fetched ONCE and shared by pilots. */
interface RecruitingClosure {
  nationalIndex: NationalRecruitingIndex | null
  portal: PortalFetchResult | null
}

async function collectTeam(team: Team, closure: RecruitingClosure): Promise<TeamResult> {
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

  // ── Atomic per-team write (P3): stage ALL outputs (layer-1 + sources + master)
  //    in a sibling `.staging` dir, then rename-in only on full success. Fixes the
  //    old ordering gap where layer-1 files landed on disk BEFORE the master build,
  //    so an ESPN/master failure left fresh layer-1 over a stale/absent master. On
  //    any failure the real teamDir is left untouched (last-good preserved).
  const writeDir = `${teamDir}.staging`
  await rm(writeDir, { recursive: true, force: true })
  await mkdir(path.join(writeDir, 'sources'), { recursive: true })

  let masterStats: NonNullable<TeamResult['stats']>['master']
  try {
    // Preserve prior vintage: read OLD files from teamDir, write merged history to staging.
    await recordHistory(teamDir, writeDir, ['roster.json', 'recruiting.json', 'production.json', 'advanced.json', 'context.json'])

    const write = (file: string, data: unknown) =>
      writeFile(path.join(writeDir, file), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await write('roster.json', validRoster)
    await write('recruiting.json', validRecruiting)
    await write('production.json', validProduction)
    await write('advanced.json', validAdvanced)
    await write('context.json', validContext)

    // ══════════════════════════════════════════════════════════════════════════
    //  PILOT-DEEPENING: ESPN 2026 spine → reconciled golden player-master.json
    //  Only wired for pilots that carry an espnId. The CFBD-2025 enrichment above
    //  (recruiting/production/advanced) is keyed CFBD-<athleteId> === CFBD-<espnId>,
    //  so it joins DIRECTLY to the ESPN spine. Official/On3 are best-effort overlays.
    // ══════════════════════════════════════════════════════════════════════════
    // ── C2: the team's incoming CFBD transfer-portal entries (cross-school) ──
    // Filtered from the run-wide portal fetch by destination === team.cfbdQuery.
    // Persisted small (provenance/audit) — the raw national portal is NOT.
    const portalIncoming: PortalIncoming[] = closure.portal
      ? incomingTransfers(closure.portal.rows, team.cfbdQuery)
      : []
    if (closure.portal) {
      const sourcesDir = path.join(writeDir, 'sources')
      await mkdir(sourcesDir, { recursive: true })
      const portalSource = validate(
        PortalSourceSchema,
        {
          sourceId: 'cfbd-portal-v1' as const,
          sourceType: 'cfbd-portal' as const,
          team: team.label,
          years: closure.portal.years,
          provenance: makeProvenance(
            PORTAL_YEARS.map((y) => ({ name: `CFBD player/portal ${y}`, endpoint: `/player/portal?year=${y}` })),
            ROSTER_SEASON,
          ),
          entries: portalIncoming.map((t) => ({
            name: t.name,
            position: t.position,
            origin: t.origin,
            destination: t.destination,
            rating: t.rating,
            stars: t.stars,
            eligibility: t.eligibility,
            transferDate: t.transferDate,
            season: t.season,
          })),
        },
        `${team.id}/sources/cfbd-portal.json`,
      )
      await writeFile(path.join(sourcesDir, 'cfbd-portal.json'), `${JSON.stringify(portalSource, null, 2)}\n`, 'utf8')
    }

    if (team.espnId) {
      masterStats = await buildAndWriteMaster({
        team,
        teamDir: writeDir,
        write,
        recruitingProfiles: validRecruiting.playerRecruitProfiles,
        incomingRecruits,
        transferOverlay,
        nationalIndex: closure.nationalIndex,
        portalIncoming,
        productionEntries: validProduction.playerProduction,
        advancedEntries: validAdvanced.playerAdvanced,
        cfbdRosterIds: new Set(eligiblePlayers.map((p) => p.playerId)),
        ourladsHtml: ourlads.html,
        returningProduction: validContext.returningProduction,
      })
    }

    // Everything staged OK → atomically rename the whole set into the real team dir.
    await commitStaging(writeDir, teamDir)
  } finally {
    await rm(writeDir, { recursive: true, force: true })
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
  nationalIndex,
  portalIncoming,
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
  nationalIndex: NationalRecruitingIndex | null
  portalIncoming: PortalIncoming[]
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
  const { master, spineCount, recruitSourceCounts, stubReduction } = buildMaster({
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
    nationalIndex,
    portalIncoming,
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
  // ── C2 closure telemetry (over the merged master) ──
  const transfers = validMaster.players.filter((p) => p.flags.isTransfer)
  const transfersRated = transfers.filter(
    (p) => p.recruiting.stars != null || p.recruiting.transferRating != null || p.recruiting.compositeRating != null,
  ).length
  const natlIdMatches = validMaster.players.filter((p) => p.recruiting.recruitSource === 'cfbd-natl-id').length
  const natlNameMatches = validMaster.players.filter((p) => p.recruiting.recruitSource === 'cfbd-natl-name').length
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
    transfersRated,
    transfersTotal: transfers.length,
    recruitSourceCounts,
    stubReductionMaster: stubReduction,
    natlIdMatches,
    natlNameMatches,
    portalIncomingCount: portalIncoming.length,
  }
}

const round1 = (v: number): number => Math.round(v * 10) / 10

/** Row-count floor + degrade checks per team (P9-lite), surfaced in the run report. */
function teamWarnings(r: TeamResult): string[] {
  const w: string[] = []
  if (!r.ok || !r.stats) return w
  const s = r.stats
  if (s.rosterPlayers < 40) w.push(`roster floor: ${s.rosterPlayers} players (<40)`)
  if (s.offenseSlots + s.defenseSlots === 0) w.push('depth chart empty (OurLads produced 0 slots)')
  if (s.master) {
    const m = s.master
    if (m.spineCount < 60) w.push(`ESPN spine floor: ${m.spineCount} players (<60)`)
    if (m.masterCount < m.spineCount) w.push(`master invariant broken: masterCount ${m.masterCount} < spineCount ${m.spineCount}`)
    if (m.officialDegraded) w.push(`official overlay degraded (${m.officialEngine})`)
  }
  return w
}

/** Write the machine-readable run telemetry artifact consumed by ops + the UI banner. */
async function writeRunReport(
  results: TeamResult[],
  targets: Team[],
  closure: RecruitingClosure,
  durationMs: number,
): Promise<void> {
  const report = {
    schemaVersion: 1,
    generatedAt: nowIso(),
    collectorVersion,
    season: SEASON,
    rosterSeason: ROSTER_SEASON,
    durationMs,
    targets: targets.map((t) => t.id),
    teamsOk: results.filter((r) => r.ok).length,
    teamsFailed: results.filter((r) => !r.ok).length,
    closure: {
      nationalRows: closure.nationalIndex?.stats.rows ?? null,
      nationalWithAthleteId: closure.nationalIndex?.stats.withAthleteId ?? null,
      portalRows: closure.portal?.rows.length ?? null,
    },
    net: getNetStats(),
    teams: results.map((r) => ({
      id: r.team.id,
      label: r.team.label,
      ok: r.ok,
      error: r.error ?? null,
      warnings: teamWarnings(r),
      stats:
        r.ok && r.stats
          ? {
              rosterPlayers: r.stats.rosterPlayers,
              offenseSlots: r.stats.offenseSlots,
              defenseSlots: r.stats.defenseSlots,
              recruitingPct: round1(r.stats.recruitingPct),
              productionPct: round1(r.stats.productionPct),
              hometownPct: round1(r.stats.hometownPct),
              master: r.stats.master
                ? {
                    spineCount: r.stats.master.spineCount,
                    masterCount: r.stats.master.masterCount,
                    matchedByIdPct: round1(r.stats.master.matchedByIdPct),
                    headshotPct: round1(r.stats.master.headshotPct),
                    highSchoolPct: round1(r.stats.master.highSchoolPct),
                    transfersRated: r.stats.master.transfersRated,
                    transfersTotal: r.stats.master.transfersTotal,
                    officialEngine: r.stats.master.officialEngine,
                    officialDegraded: r.stats.master.officialDegraded,
                    on3Degraded: r.stats.master.on3Degraded,
                  }
                : null,
            }
          : null,
    })),
  }
  await writeFile(path.join(COLLECTED, '_runReport.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

async function main(): Promise<void> {
  const runStart = Date.now()
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

  // ── C2: CFBD-native recruiting closure — fetched ONCE, shared by all pilots ──
  // The national recruiting index + transfer portal are NOT persisted raw (the
  // ~18k-row national index / portal are transient); they're held in memory and
  // threaded into reconciliation so every spine player can receive recruiting.
  const apiKey = process.env.CFBD_API_KEY
  const closure: RecruitingClosure = { nationalIndex: null, portal: null }
  if (apiKey) {
    process.stdout.write(
      `Fetching CFBD recruiting closure (national index ${NATIONAL_RECRUITING_YEARS.at(-1)}–${NATIONAL_RECRUITING_YEARS[0]}, portal ${PORTAL_YEARS.join('/')})... `,
    )
    try {
      const [nationalIndex, portal] = await Promise.all([
        fetchNationalRecruitingIndex(NATIONAL_RECRUITING_YEARS, apiKey),
        fetchPortal(PORTAL_YEARS, apiKey),
      ])
      closure.nationalIndex = nationalIndex
      closure.portal = portal
      console.log(
        `done (natl ${nationalIndex.stats.rows} rows, ${nationalIndex.stats.withAthleteId} w/ athleteId; portal ${portal.rows.length} rows)`,
      )
    } catch (error) {
      console.log(`DEGRADED — ${(error as Error).message}`)
    }
  }

  const results: TeamResult[] = []
  for (const team of targets) {
    process.stdout.write(`Collecting ${team.label} (${team.id})... `)
    try {
      const result = await collectTeam(team, closure)
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
        console.log(`       ── C2 RECRUITING CLOSURE (CFBD-native) ──`)
        const trPct = m.transfersTotal ? ((100 * m.transfersRated) / m.transfersTotal).toFixed(1) : '0.0'
        console.log(`       transfers rated:       ${m.transfersRated}/${m.transfersTotal} (${trPct}%)`)
        console.log(`       national index:        ${m.natlIdMatches} by-id + ${m.natlNameMatches} by-name`)
        console.log(`       portal incoming:       ${m.portalIncomingCount}`)
        console.log(`       master stub reduction: ${m.stubReductionMaster.before} → ${m.stubReductionMaster.after} (reduced ${m.stubReductionMaster.before - m.stubReductionMaster.after})`)
        console.log(`       recruit source dist:   ${Object.entries(m.recruitSourceCounts).map(([k, v]) => `${k}:${v}`).join(' ')}`)
      }
    } else {
      console.log(`\n[FAIL] ${r.team.label} (${r.team.id})`)
      console.log(`       ${r.error}`)
    }
  }
  console.log('\n==============================================')

  // ── Run telemetry artifact (blueprint 5.1.3) ──────────────────────────────────
  const durationMs = Date.now() - runStart
  await writeRunReport(results, targets, closure, durationMs)
  const net = getNetStats()
  console.log(
    `\nRun report → src/data/collected/_runReport.json ` +
      `(net: ${net.requests} requests / ${net.cacheHits} cache-reuse / ${net.retries} retries; ${durationMs}ms)`,
  )
  for (const r of results) {
    for (const w of teamWarnings(r)) console.log(`  ⚠ ${r.team.id}: ${w}`)
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.error(`\n${failed.length} team(s) FAILED — exiting non-zero. No partial garbage written for failed teams.`)
    process.exit(1)
  }
  console.log('\nAll target teams collected successfully.')
}

await main()
