/**
 * CFBD API client + roster/production transforms. Network-touching (fetchJson),
 * but the pure transforms (mapRosterRows, aggregateProduction) are exported for
 * direct use/testing.
 */
import {
  classifySide,
  normalizeClassYear,
  normalizePosition,
  toHeight,
  type RosterPlayerLike,
} from './normalize.ts'

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
  classYear: string
  height: string
  weight: number | null
  eligibilityRemaining: number | null
  isTransfer: boolean
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
  return `CFBD-${id ?? safeName.slice(0, 16)}`
}

export const mapRosterRows = (rosterRows: CfbdRosterRow[]): RosterPlayer[] =>
  rosterRows.map((row) => {
    const position = normalizePosition(row.position)
    return {
      playerId: toPlayerId(row.id, row.firstName, row.lastName),
      name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      number: Number.isFinite(Number(row.jersey)) ? Number(row.jersey) : 0,
      side: classifySide(position),
      position,
      classYear: normalizeClassYear(row.year),
      height: toHeight(row.height),
      weight: Number.isFinite(Number(row.weight)) ? Number(row.weight) : null,
      eligibilityRemaining: null,
      isTransfer: false,
    }
  })

const statMapByCategory: Record<string, [string, string][]> = {
  passing: [['YDS', 'PAS'], ['TD', 'TD'], ['INT', 'INT'], ['RATING', 'RTG'], ['QBR', 'RTG']],
  rushing: [['YDS', 'YDS'], ['TD', 'TD'], ['ATT', 'ATT']],
  receiving: [['REC', 'REC'], ['YDS', 'YDS'], ['TD', 'TD']],
  defensive: [['TACKLE', 'TKL'], ['TFL', 'TFL'], ['SACK', 'SCK'], ['INT', 'INT'], ['PBU', 'PD'], ['BREAKUP', 'PD']],
}

const mapStatKey = (category: unknown, statType: unknown): string | null => {
  const rules = statMapByCategory[String(category ?? '').toLowerCase()] ?? []
  const upperStat = String(statType ?? '').toUpperCase()
  const match = rules.find(([needle]) => upperStat.includes(needle))
  return match?.[1] ?? null
}

export interface ProductionSource {
  sourceId: string
  sourceType: 'production'
  asOf: string
  season: number
  version: string
  playerProduction: Record<string, unknown>[]
}

export const aggregateProduction = (
  statsRows: CfbdStatRow[],
  nameToPlayerId: Map<string, string>,
  season: number,
  rosterPlayerIds: string[],
  rosterNameById: Map<string, string>,
): ProductionSource => {
  const byPlayer = new Map<string, Record<string, unknown>>()
  const rosterIdSet = new Set(rosterPlayerIds)

  for (const row of statsRows) {
    const numeric = Number(row.stat)
    if (Number.isNaN(numeric)) continue
    const key = mapStatKey(row.category, row.statType)
    if (!key) continue
    const playerId = row.playerId
      ? `CFBD-${row.playerId}`
      : nameToPlayerId.get(String(row.player ?? '').trim().toLowerCase())
    if (!playerId || !rosterIdSet.has(playerId)) continue

    if (!byPlayer.has(playerId)) {
      byPlayer.set(playerId, { playerId, name: rosterNameById.get(playerId) ?? row.player ?? null })
    }
    const target = byPlayer.get(playerId)!
    if (key === 'RTG') {
      target[key] = Number(numeric.toFixed(1))
    } else {
      target[key] = Number((((target[key] as number) ?? 0) + numeric).toFixed(1))
    }
  }

  for (const playerId of rosterPlayerIds) {
    if (!byPlayer.has(playerId)) byPlayer.set(playerId, { playerId, name: rosterNameById.get(playerId) ?? null })
  }

  return {
    sourceId: 'cfbd-production-v1',
    sourceType: 'production',
    asOf: new Date().toISOString().slice(0, 10),
    season,
    version: 'cfbd-2026.1',
    playerProduction: [...byPlayer.values()],
  }
}

export const fetchRoster = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdRosterRow[]> =>
  fetchJson<CfbdRosterRow[]>(`${API_BASE}/roster?year=${season}&team=${encodeURIComponent(cfbdQuery)}`, apiKey)

export const fetchSeasonStats = (cfbdQuery: string, season: number, apiKey: string): Promise<CfbdStatRow[]> =>
  fetchJson<CfbdStatRow[]>(
    `${API_BASE}/stats/player/season?year=${season}&team=${encodeURIComponent(cfbdQuery)}`,
    apiKey,
  )

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
