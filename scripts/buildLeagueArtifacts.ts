/**
 * Offline league-artifact builder (F4). Reads EVERY collected
 * `src/data/collected/<team>/player-master.json` and emits three small committed
 * artifacts the app renders without ever loading 54 full masters client-side:
 *
 *   _baselines.json  — per-position-group {mean, sd, n} of the recruiting-composite
 *                       and production-intensity signals across the whole league.
 *                       Feeds league-calibrated OVR (computeTeamRatings) + Team-HQ
 *                       strength-vs-conference bars.
 *   _identity.json   — transfer-portal edges (origin school → destination team),
 *                       from each master's isTransfer players. Feeds the portal
 *                       ledger + League Sankey; per-team in/out/net derived here.
 *   _league.json     — per-team summary (conference, league-calibrated avg starter
 *                       OVR, returning production, roster counts, portal net) for
 *                       the League view.
 *
 * NO network / NO CFBD — pure aggregation of committed data. Run:
 *   node scripts/buildLeagueArtifacts.ts
 *
 * It reuses the EXACT app rating pipeline (masterToDatasetBySource →
 * buildPlayerPipeline) so grain + math match the client precisely: pass 1 builds
 * baselines from the pipeline's exposed ratingInputs; pass 2 re-runs the pipeline
 * WITH those baselines to get league-honest per-team metrics.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PlayerMasterSourceSchema } from '../src/data/schema/index.ts'
import { masterToDatasetBySource } from '../src/data/masterToDataset.ts'
import { buildPlayerPipeline } from '../src/data/pipeline/buildPlayerPipeline.ts'
import { productionRaw } from '../src/data/rating/overall.ts'
import type { Baseline, LeagueBaselines } from '../src/data/rating/ratingConfig.ts'
import { MIN_GROUP_N } from '../src/data/rating/ratingConfig.ts'
import { TEAMS, getTeamById } from '../src/data/teamRegistry.ts'
import type { DatasetBySource } from '../src/data/schema/dataset.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const COLLECTED = join(HERE, '..', 'src', 'data', 'collected')
const NOW = new Date().toISOString()

// ── Load every collected master once ────────────────────────────────────────
const teamIds = readdirSync(COLLECTED, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(COLLECTED, d.name, 'player-master.json')))
  .map((d) => d.name)
  .sort()

const datasets = new Map<string, DatasetBySource>()
for (const id of teamIds) {
  const raw = JSON.parse(readFileSync(join(COLLECTED, id, 'player-master.json'), 'utf8'))
  datasets.set(id, masterToDatasetBySource(PlayerMasterSourceSchema.parse(raw)))
}
console.log(`Loaded ${datasets.size} golden masters.`)

// ── Pass 1: league baselines from the pipeline's rating inputs ───────────────
const recByGroup = new Map<string, number[]>()
const recBySide = new Map<string, number[]>()
const prodByGroup = new Map<string, number[]>()
const prodBySide = new Map<string, number[]>()
const push = (m: Map<string, number[]>, k: string, v: number) => m.set(k, [...(m.get(k) ?? []), v])

for (const ds of datasets.values()) {
  const { ratingInputs = [] } = buildPlayerPipeline(ds)
  for (const p of ratingInputs) {
    if (p.isStub) continue
    if (typeof p.compositeRating === 'number') {
      push(recByGroup, p.positionGroup, p.compositeRating)
      push(recBySide, p.sideBucket, p.compositeRating)
    }
    const praw = p.production ? productionRaw(p.positionGroup, p.production) : null
    if (praw != null) {
      push(prodByGroup, p.positionGroup, praw)
      push(prodBySide, p.sideBucket, praw)
    }
  }
}

/** Population mean/sd (matches the rating engine's normContext). */
const toBaseline = (vals: number[]): Baseline => {
  const n = vals.length
  if (n === 0) return { mean: 0, sd: 0, n }
  const mean = vals.reduce((a, b) => a + b, 0) / n
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return { mean: round(mean, 6), sd: round(Math.sqrt(variance), 6), n }
}
const round = (x: number, dp: number): number => Number(x.toFixed(dp))
const bucketize = (m: Map<string, number[]>): Record<string, Baseline> =>
  Object.fromEntries([...m.entries()].filter(([, v]) => v.length >= MIN_GROUP_N).map(([k, v]) => [k, toBaseline(v)]))

const baselines: LeagueBaselines = {
  generatedAt: NOW,
  teamsIncluded: datasets.size,
  recByGroup: bucketize(recByGroup),
  prodByGroup: bucketize(prodByGroup),
  recBySide: bucketize(recBySide),
  prodBySide: bucketize(prodBySide),
}
writeFileSync(join(COLLECTED, '_baselines.json'), JSON.stringify(baselines, null, 2) + '\n')
console.log(`_baselines.json: ${Object.keys(baselines.recByGroup).length} recruiting groups / ${Object.keys(baselines.prodByGroup).length} production groups.`)

// ── Identity: transfer-portal edges (origin school → destination team) ────────
// Resolve a CFBD school name (portal `origin`) to an in-registry teamId.
const byCfbd = new Map(TEAMS.map((t) => [t.cfbdQuery.toLowerCase(), t.id]))
const resolveSchool = (name: string | null | undefined): string | null =>
  name ? byCfbd.get(name.trim().toLowerCase()) ?? null : null

interface PortalEdge {
  name: string
  position: string | null
  fromName: string
  fromTeamId: string | null
  toTeamId: string
  toName: string
  transferRating: number | null
}
const edges: PortalEdge[] = []
for (const [teamId, ds] of datasets) {
  const label = getTeamById(teamId)?.label ?? teamId
  for (const pl of ds.master?.players ?? []) {
    if (!pl.flags?.isTransfer) continue
    const origin = pl.recruiting?.origin ?? pl.recruiting?.fromSchool ?? null
    if (!origin) continue
    edges.push({
      name: pl.name,
      position: pl.position ?? null,
      fromName: origin,
      fromTeamId: resolveSchool(origin),
      toTeamId: teamId,
      toName: label,
      transferRating: pl.recruiting?.transferRating ?? null,
    })
  }
}
// Per-team in/out/net (out = edges whose resolved origin is that team).
const portalIn = new Map<string, number>()
const portalOut = new Map<string, number>()
for (const e of edges) {
  portalIn.set(e.toTeamId, (portalIn.get(e.toTeamId) ?? 0) + 1)
  if (e.fromTeamId) portalOut.set(e.fromTeamId, (portalOut.get(e.fromTeamId) ?? 0) + 1)
}
writeFileSync(join(COLLECTED, '_identity.json'), JSON.stringify({ generatedAt: NOW, teamsIncluded: datasets.size, edges }, null, 2) + '\n')
console.log(`_identity.json: ${edges.length} portal edges (${edges.filter((e) => e.fromTeamId).length} in-league).`)

// ── Pass 2: league-honest per-team summary ───────────────────────────────────
interface LeagueTeam {
  teamId: string
  label: string
  conference: string
  accentColor: string
  avgStarterOverall: number | null
  offenseStarterOverall: number | null
  defenseStarterOverall: number | null
  returningPercentPPA: number | null
  rosterCount: number
  ratedCount: number
  portalIn: number
  portalOut: number
  portalNet: number
}
const leagueTeams: LeagueTeam[] = []
/** Avg OVR of starters on one depth-chart side ('OFFENSE'|'DEFENSE'). */
const sideStarterOvr = (pipe: ReturnType<typeof buildPlayerPipeline>, side: string): number | null => {
  const ovrById = new Map(pipe.players.map((p) => [p.playerId, p.ratings.overall]))
  const ovrs = pipe.starters
    .filter((s) => s.side === side)
    .map((s) => ovrById.get(s.playerId))
    .filter((o): o is number => typeof o === 'number')
  return ovrs.length ? round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length, 1) : null
}

for (const [teamId, ds] of datasets) {
  const t = getTeamById(teamId)!
  const pipe = buildPlayerPipeline(ds, baselines)
  const rated = pipe.players.filter((p) => p.ratings.overall != null).length
  const pIn = portalIn.get(teamId) ?? 0
  const pOut = portalOut.get(teamId) ?? 0
  leagueTeams.push({
    teamId,
    label: t.label,
    conference: t.conference,
    accentColor: t.accentColor,
    avgStarterOverall: pipe.metrics.team.avgStarterOverall,
    offenseStarterOverall: sideStarterOvr(pipe, 'OFFENSE'),
    defenseStarterOverall: sideStarterOvr(pipe, 'DEFENSE'),
    returningPercentPPA: pipe.returningProduction?.percentPPA ?? null,
    rosterCount: pipe.players.length,
    ratedCount: rated,
    portalIn: pIn,
    portalOut: pOut,
    portalNet: pIn - pOut,
  })
}
leagueTeams.sort((a, b) => (b.avgStarterOverall ?? 0) - (a.avgStarterOverall ?? 0))
writeFileSync(join(COLLECTED, '_league.json'), JSON.stringify({ generatedAt: NOW, teamsIncluded: datasets.size, teams: leagueTeams }, null, 2) + '\n')
console.log(`_league.json: ${leagueTeams.length} teams; top avg-starter-OVR = ${leagueTeams[0]?.label} (${leagueTeams[0]?.avgStarterOverall}).`)
console.log('Done.')
