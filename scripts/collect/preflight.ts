/**
 * Registry preflight — fail fast, per team, BEFORE any network call.
 *
 * Load-bearing fields are errors (they block the run): `espnId` is the roster
 * spine, `cfbdQuery` keys every CFBD feed, `ourlads` is the depth chart. Overlay
 * fields degrade gracefully at collect time, so a missing/`unknown` official
 * engine or URL is a WARNING (the team still collects from ESPN + CFBD) — this is
 * the blueprint's "accept 5–8 schools degraded" tolerance made explicit, never a
 * hidden silent gap. Pure + synchronous so it unit-tests without the network.
 */
import type { Team, OfficialEngine } from '../../src/data/schema/index.ts'

export type PreflightLevel = 'error' | 'warn'

export interface PreflightIssue {
  teamId: string
  level: PreflightLevel
  field: string
  message: string
}

export interface PreflightResult {
  ok: boolean
  issues: PreflightIssue[]
}

const VALID_ENGINES: ReadonlySet<OfficialEngine> = new Set<OfficialEngine>([
  'nuxt-sidearm',
  'sidearm-json',
  'wmt-presto',
  'unknown',
])

/** Validate one team's registry row. Pure. */
export function preflightTeam(team: Team): PreflightResult {
  const issues: PreflightIssue[] = []
  const err = (field: string, message: string) =>
    issues.push({ teamId: team.id, level: 'error', field, message })
  const warn = (field: string, message: string) =>
    issues.push({ teamId: team.id, level: 'warn', field, message })

  // ── Load-bearing (errors) ──
  if (!team.espnId || !/^\d+$/.test(team.espnId))
    err('espnId', `missing/invalid ESPN team id (need numeric string; got ${JSON.stringify(team.espnId)})`)
  if (!team.cfbdQuery || !team.cfbdQuery.trim()) err('cfbdQuery', 'missing cfbdQuery')
  if (!team.ourlads?.slug || !team.ourlads?.id) err('ourlads', 'missing ourlads slug/id (depth-chart source)')

  // ── Best-effort overlay (warnings — team degrades to ESPN + CFBD) ──
  if (!team.officialRosterUrl) {
    warn('officialRosterUrl', 'no official roster URL — HS/hometown overlay unavailable')
  } else if (!/^https?:\/\//.test(team.officialRosterUrl)) {
    err('officialRosterUrl', `not an absolute http(s) URL: ${team.officialRosterUrl}`)
  }
  if (team.officialEngine && !VALID_ENGINES.has(team.officialEngine)) {
    err('officialEngine', `invalid engine value: ${JSON.stringify(team.officialEngine)}`)
  } else if (!team.officialEngine || team.officialEngine === 'unknown') {
    warn('officialEngine', 'engine unknown/unset — official overlay expected to degrade')
  }
  if (!team.slug247 || !team.slug247.trim())
    warn('slug247', 'missing slug247 — 247 recruiting fact-check degrades')

  return { ok: issues.every((i) => i.level !== 'error'), issues }
}

/** Validate a batch of teams. `ok` is false iff any team has an error-level issue. */
export function preflightTeams(teams: readonly Team[]): PreflightResult {
  const issues = teams.flatMap((t) => preflightTeam(t).issues)
  return { ok: issues.every((i) => i.level !== 'error'), issues }
}

/** Human-readable one-liner for a console/log preflight dump. */
export function formatIssue(i: PreflightIssue): string {
  const tag = i.level === 'error' ? 'ERROR' : 'warn '
  return `  [${tag}] ${i.teamId} · ${i.field}: ${i.message}`
}
