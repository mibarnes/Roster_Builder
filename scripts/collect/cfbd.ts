/**
 * CFBD API client + roster/production transforms. Network-touching (fetchJson),
 * but the pure transforms (mapRosterRows, aggregateProduction) are exported for
 * direct use/testing.
 */
import {
  classifySide,
  eligibilityFromYear,
  normalizePosition,
  parseClassYear,
  toHeight,
  type RosterPlayerLike,
} from './normalize.ts'
import { cfbdId } from './playerId.ts'

const API_BASE = 'https://api.collegefootballdata.com'
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export interface CfbdRosterRow {
  id?: number | string
  firstName?: string
  lastName?: string
  weight?: number | string
  height?: number | string
  jersey?: number | string
  year?: number | string
  position?: string
  homeCity?: string | null
  homeState?: string | null
  homeLatitude?: number | null
  homeLongitude?: number | null
}

export interface CfbdStatRow {
  season?: number
  playerId?: string
  player?: string
  position?: string
  category?: string
  statType?: string
  stat?: string | number
}

export interface RosterPlayer extends RosterPlayerLike {
  playerId: string
  name: string
  number: number
  side: 'OFF' | 'DEF' | 'ST'
  position: string
  classYear: string | null
  isRedshirt: boolean | null
  height: string
  weight: number | null
  eligibilityRemaining: number | null
  isTransfer: boolean
  homeCity: string | null
  homeState: string | null
  homeLat: number | null
  homeLon: number | null
}

export const fetchJson = async <T>(url: string, apiKey: string): Promise<T> => {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`CFBD request failed (${response.status}): ${url} :: ${text.slice(0, 200)}`)
  }
  return response.json() as Promise<T>
}

const toPlayerId = (id: unknown, firstName?: string, lastName?: string): string => {
  const safeName = `${firstName ?? ''}${lastName ?? ''}`.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return id != null && String(id).trim() !== '' ? cfbdId(id) : `CFBD-${safeName.slice(0, 16)}`
}

const num = (value: unknown): number | null => (Number.isFinite(Number(value)) ? Number(value) : null)

export const mapRosterRows = (rosterRows: CfbdRosterRow[]): RosterPlayer[] =>
  rosterRows.map((row) => {
    const position = normalizePosition(row.position)
    const { classYear, isRedshirt } = parseClassYear(row.year)
    return {
      playerId: toPlayerId(row.id, row.firstName, row.lastName),
      name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      number: Number.isFinite(Number(row.jersey)) ? Number(row.jersey) : 0,
      side: classifySide(position),
      position,
      classYear,
      isRedshirt,
      height: toHeight(row.height),
      weight: num(row.weight),
      eligibilityRemaining: eligibilityFromYear(row.year),
      isTransfer: false,
      homeCity: row.homeCity ?? null,
      homeState: row.homeState ?? null,
      homeLat: num(row.homeLatitude),
      homeLon: num(row.homeLongitude),
    }
  })

// ── /stats/player/season → RATING/QBR only (the season endpoint's distinctive
//    contribution; broad counting stats now come from /games/players). ────────
const statMapByCategory: Record<string, [string, string][]> = {
  passing: [['RATING', 'RTG'], ['QBR', 'RTG']],
}

const mapStatKey = (category: unknown, statType: unknown): string | null => {
  const rules = statMapByCategory[String(category ?? '').toLowerCase()] ?? []
  const upperStat = String(statType ?? '').toUpperCase()
  const match = rules.find(([needle]) => upperStat.includes(needle))
  return match?.[1] ?? null
}

export interface ProductionEntry {
  playerId: string
  name: string | null
  games: number
  stats: Record<string, number>
  RTG?: number
  // flattened convenience keys (mirror common counting stats for consumers)
  [key: string]: unknown
}

export interface ProductionSource {
  sourceId: string
  sourceType: 'production'
  asOf: string
  season: number
  version: string
  playerProduction: ProductionEntry[]
}

// ── /games/players shapes ────────────────────────────────────────────────────
export interface CfbdGameAthlete { id?: string | number; name?: string; stat?: string | number }
export interface CfbdGameStatType { name?: string; athletes?: CfbdGameAthlete[] }
export interface CfbdGameCategory { name?: string; types?: CfbdGameStatType[] }
export interface CfbdGameTeam { team?: string; homeAway?: string; points?: number; categories?: CfbdGameCategory[] }
export interface CfbdGame { id?: string | number; teams?: CfbdGameTeam[] }

/**
 * (category, type) → the broad stat key we store. Covers all CFBD categories.
 * A null mapping means "skip" (e.g. percentage/derived display fields).
 */
const GAME_STAT_KEYS: Record<string, Record<string, string | null>> = {
  passing: { YDS: 'passYds', TD: 'passTD', INT: 'passINT', 'C/ATT': 'passCmpAtt', AVG: null, QBR: null },
  rushing: { YDS: 'rushYds', TD: 'rushTD', CAR: 'rushAtt', AVG: null, LONG: null },
  receiving: { REC: 'rec', YDS: 'recYds', TD: 'recTD', AVG: null, LONG: null },
  defensive: { TOT: 'tackles', SOLO: 'soloTackles', TFL: 'tfl', SACKS: 'sacks', QB_HUR: 'qbHurries', PD: 'passDef', TD: 'defTD' },
  interceptions: { INT: 'interceptions', YDS: 'intYds', TD: 'intTD' },
  fumbles: { FUM: 'fumbles', LOST: 'fumblesLost', REC: 'fumRec' },
  kicking: { FG: 'fgMade', XP: 'xpMade', PTS: 'kickPts', PCT: null, LONG: null },
  punting: { NO: 'punts', YDS: 'puntYds', AVG: null, LONG: null, TB: 'puntTB', In_20: 'puntIn20' },
  kickReturns: { NO: 'kr', YDS: 'krYds', TD: 'krTD', AVG: null, LONG: null },
  puntReturns: { NO: 'pr', YDS: 'prYds', TD: 'prTD', AVG: null, LONG: null },
}

/** Parse a CFBD game stat string ("15", "12/23", "1.5") to a number, or null. */
const parseGameStat = (stat: unknown): number | null => {
  if (stat == null) return null
  const text = String(stat).trim()
  if (text.includes('/')) {
    // "C/ATT" style — store the completions count (left side).
    const left = Number(text.split('/')[0])
    return Number.isFinite(left) ? left : null
  }
  const n = Number(text.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

const CONVENIENCE_KEYS: Record<string, string> = {
  passYds: 'PAS', passTD: 'TD', rushYds: 'YDS', recYds: 'YDS', rec: 'REC',
  interceptions: 'INT', sacks: 'SCK', tfl: 'TFL', tackles: 'TKL',
}

/**
 * PRIMARY production: build per-player season aggregation from /games/players.
 *  - games = distinct game ids the athlete appears in
 *  - stats = summed broad counting stats (only keys the player actually has)
 *  - perGame = optional per-game stat log
 * Then merge RATING/QBR from /stats/player/season. Only roster players kept.
 */
export const buildProduction = (
  games: CfbdGame[],
  cfbdQuery: string,
  statsRows: CfbdStatRow[],
  season: number,
  rosterPlayerIds: string[],
  rosterNameById: Map<string, string>,
  nameToPlayerId: Map<string, string>,
): ProductionSource => {
  const rosterIdSet = new Set(rosterPlayerIds)
  interface Acc { playerId: string; name: string | null; gameIds: Set<string>; stats: Record<string, number>; perGame: { gameId: string; stats: Record<string, number> }[] }
  const byPlayer = new Map<string, Acc>()

  for (const game of games) {
    const gameId = String(game.id ?? '')
    const teamEntry = (game.teams ?? []).find((t) => t.team === cfbdQuery) ?? (game.teams ?? [])[0]
    if (!teamEntry) continue

    // collect this game's per-player stat deltas first (so perGame is per game)
    const perGameByPlayer = new Map<string, Record<string, number>>()

    for (const category of teamEntry.categories ?? []) {
      const catName = String(category.name ?? '')
      const keyMap = GAME_STAT_KEYS[catName] ?? {}
      for (const type of category.types ?? []) {
        const statKey = keyMap[String(type.name ?? '')]
        for (const athlete of type.athletes ?? []) {
          const playerId = cfbdId(athlete.id)
          if (!rosterIdSet.has(playerId)) continue
          if (!byPlayer.has(playerId)) {
            byPlayer.set(playerId, {
              playerId,
              name: rosterNameById.get(playerId) ?? athlete.name ?? null,
              gameIds: new Set(),
              stats: {},
              perGame: [],
            })
          }
          const acc = byPlayer.get(playerId)!
          acc.gameIds.add(gameId)
          if (!statKey) continue
          const value = parseGameStat(athlete.stat)
          if (value == null) continue
          acc.stats[statKey] = Number(((acc.stats[statKey] ?? 0) + value).toFixed(1))
          const pg = perGameByPlayer.get(playerId) ?? {}
          pg[statKey] = Number(((pg[statKey] ?? 0) + value).toFixed(1))
          perGameByPlayer.set(playerId, pg)
        }
      }
    }
    for (const [playerId, stats] of perGameByPlayer) {
      byPlayer.get(playerId)!.perGame.push({ gameId, stats })
    }
  }

  // merge RATING/QBR from season stats
  for (const row of statsRows) {
    const key = mapStatKey(row.category, row.statType)
    if (key !== 'RTG') continue
    const numeric = Number(row.stat)
    if (Number.isNaN(numeric)) continue
    const playerId = row.playerId
      ? cfbdId(row.playerId)
      : nameToPlayerId.get(String(row.player ?? '').trim().toLowerCase())
    if (!playerId || !rosterIdSet.has(playerId)) continue
    if (!byPlayer.has(playerId)) {
      byPlayer.set(playerId, { playerId, name: rosterNameById.get(playerId) ?? row.player ?? null, gameIds: new Set(), stats: {}, perGame: [] })
    }
    ;(byPlayer.get(playerId)! as Acc & { rtg?: number }).rtg = Number(numeric.toFixed(1))
  }

  // ensure every roster player has an entry (true 0 games distinguishable)
  for (const playerId of rosterPlayerIds) {
    if (!byPlayer.has(playerId)) {
      byPlayer.set(playerId, { playerId, name: rosterNameById.get(playerId) ?? null, gameIds: new Set(), stats: {}, perGame: [] })
    }
  }

  const playerProduction: ProductionEntry[] = [...byPlayer.values()].map((acc) => {
    const entry: ProductionEntry = {
      playerId: acc.playerId,
      name: acc.name,
      games: acc.gameIds.size,
      stats: acc.stats,
    }
    const rtg = (acc as Acc & { rtg?: number }).rtg
    if (rtg != null) entry.RTG = rtg
    if (acc.perGame.length) entry.perGame = acc.perGame
    // flatten common counting stats for backward-compatible consumers
    for (const [src, dest] of Object.entries(CONVENIENCE_KEYS)) {
      if (acc.stats[src] != null && entry[dest] == null) entry[dest] = acc.stats[src]
    }
    return entry
  })

  return {
    sourceId: 'cfbd-production-v2',
    sourceType: 'production',
    asOf: new Date().toISOString().slice(0, 10),
    season,
    version: 'cfbd-2026.2',
    playerProduction,
  }
}

export const fetchRoster = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdRosterRow[]> =>
  fetchJson<CfbdRosterRow[]>(`${API_BASE}/roster?year=${season}&team=${encodeURIComponent(cfbdQuery)}`, apiKey)

export const fetchSeasonStats = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdStatRow[]> =>
  fetchJson<CfbdStatRow[]>(
    `${API_BASE}/stats/player/season?year=${season}&team=${encodeURIComponent(cfbdQuery)}`,
    apiKey,
  )

// ── New CFBD endpoints (E1) ───────────────────────────────────────────────────

export const gamesPlayersUrl = (cfbdQuery: string, season: number): string =>
  `${API_BASE}/games/players?year=${season}&team=${encodeURIComponent(cfbdQuery)}&seasonType=regular`

export const fetchGamesPlayers = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdGame[]> =>
  fetchJson<CfbdGame[]>(gamesPlayersUrl(cfbdQuery, season), apiKey)

export interface CfbdRecruitRow {
  id?: string | number
  athleteId?: string | number | null
  recruitType?: string
  year?: number
  ranking?: number | null
  name?: string
  school?: string
  committedTo?: string
  position?: string
  height?: number | null
  weight?: number | null
  stars?: number | null
  rating?: number | null
  city?: string | null
  stateProvince?: string | null
  country?: string | null
  hometownInfo?: { latitude?: number | null; longitude?: number | null; fipsCode?: string | null } | null
}

export const recruitingPlayersUrl = (cfbdQuery: string, year: number): string =>
  `${API_BASE}/recruiting/players?year=${year}&team=${encodeURIComponent(cfbdQuery)}`

export const fetchRecruitingPlayers = (cfbdQuery: string, year: number, apiKey: string): Promise<CfbdRecruitRow[]> =>
  fetchJson<CfbdRecruitRow[]>(recruitingPlayersUrl(cfbdQuery, year), apiKey)

// ── National recruiting index (NO team) → the whole class for a year ──────────
// `/recruiting/players?year=X` with no team filter returns ~2,300 rows/yr: every
// rated recruit nationally, with athleteId present on ~71%. Fetched once per run
// across many years to build a cross-school index (NOT persisted — held in memory
// and shared by both pilots). Lets us rate transfers / walk-ons / 2026 freshmen
// the team's own /recruiting/players?team=X feed (own recruits only) never sees.
export const recruitingNationalUrl = (year: number): string =>
  `${API_BASE}/recruiting/players?year=${year}`

export const fetchRecruitingNational = (year: number, apiKey: string): Promise<CfbdRecruitRow[]> =>
  fetchJson<CfbdRecruitRow[]>(recruitingNationalUrl(year), apiKey)

// ── Transfer portal (NO team) → all portal entries for a year ─────────────────
// `/player/portal?year=Y` returns every transfer-portal entry for the year, each
// with origin/destination schools + a transfer rating/stars + eligibility. We
// filter incoming = destination === team.cfbdQuery. Fetched once per run.
export interface CfbdPortalRow {
  season?: number
  firstName?: string
  lastName?: string
  position?: string
  origin?: string | null
  destination?: string | null
  transferDate?: string | null
  rating?: number | null
  stars?: number | null
  eligibility?: string | null
}

export const portalUrl = (year: number): string => `${API_BASE}/player/portal?year=${year}`

export const fetchPortalYear = (year: number, apiKey: string): Promise<CfbdPortalRow[]> =>
  fetchJson<CfbdPortalRow[]>(portalUrl(year), apiKey)

export interface CfbdUsageRow {
  season?: number
  id?: string | number
  name?: string
  position?: string
  usage?: Record<string, number | null>
}

export const usageUrl = (cfbdQuery: string, season: number): string =>
  `${API_BASE}/player/usage?year=${season}&team=${encodeURIComponent(cfbdQuery)}`

export const fetchUsage = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdUsageRow[]> =>
  fetchJson<CfbdUsageRow[]>(usageUrl(cfbdQuery, season), apiKey)

export interface CfbdPpaRow {
  season?: number
  id?: string | number
  name?: string
  position?: string
  averagePPA?: Record<string, number | null>
  totalPPA?: Record<string, number | null>
}

export const ppaUrl = (cfbdQuery: string, season: number): string =>
  `${API_BASE}/ppa/players/season?year=${season}&team=${encodeURIComponent(cfbdQuery)}`

export const fetchPpa = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdPpaRow[]> =>
  fetchJson<CfbdPpaRow[]>(ppaUrl(cfbdQuery, season), apiKey)

export interface CfbdReturningRow {
  season?: number
  team?: string
  [key: string]: unknown
}

export const returningUrl = (cfbdQuery: string, season: number): string =>
  `${API_BASE}/player/returning?year=${season}&team=${encodeURIComponent(cfbdQuery)}`

export const fetchReturning = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdReturningRow[]> =>
  fetchJson<CfbdReturningRow[]>(returningUrl(cfbdQuery, season), apiKey)

/** Fetch the OurLads depth chart page (follows 301 → /depth-chart/<slug>/<id>). */
export const fetchOurladsHtml = async (slug: string, id: string): Promise<{ url: string; html: string }> => {
  const url = `https://www.ourlads.com/ncaa-football-depth-charts/depth-chart/${slug}/${id}`
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Ourlads request failed (${response.status}): ${url} :: ${text.slice(0, 200)}`)
      }
      return { url: response.url, html: await response.text() }
    } catch (error) {
      lastError = error
      if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 400))
    }
  }
  throw lastError ?? new Error(`Ourlads request failed for ${slug}/${id}`)
}

/** Fetch one 247Sports commits page for a given team slug + year. */
export const fetch247Html = async (teamSlug: string, year: number): Promise<string> => {
  const url = `https://247sports.com/college/${teamSlug}/season/${year}-football/commits/`
  const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`247 request failed (${response.status}): ${url} :: ${text.slice(0, 200)}`)
  }
  return response.text()
}
