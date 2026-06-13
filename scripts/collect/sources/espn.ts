/**
 * ESPN roster source client — the 2026 roster SPINE.
 *
 * GET site.api.espn.com/.../teams/<espnId>/roster (no key, ~100 athletes/team).
 * ESPN's athlete `id` shares CFBD's athleteId namespace, so the canonical id is
 * `CFBD-<espnId>` and ESPN↔CFBD is a DIRECT id join downstream (no fuzzy).
 *
 * `fetchEspnRoster` is network-touching; `normalizeEspnAthlete` /
 * `mapEspnAthletes` are pure and unit-tested. ESPN is a HARD requirement — a
 * fetch/empty failure surfaces to the orchestrator as a hard error.
 */
import type { EspnPlayer } from '../../../src/data/schema/espnRoster.ts'

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

// ── Raw ESPN API shapes (only the fields we read) ─────────────────────────────
export interface EspnAthlete {
  id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  displayName?: string
  jersey?: string
  weight?: number
  height?: number
  displayHeight?: string
  position?: {
    abbreviation?: string
    parent?: { abbreviation?: string }
  }
  experience?: { years?: number; abbreviation?: string }
  status?: { type?: string }
  birthPlace?: { city?: string; state?: string; country?: string }
  headshot?: { href?: string }
  injuries?: unknown[]
}

export interface EspnAthleteGroup {
  position?: string
  items?: EspnAthlete[]
}

export interface EspnRosterResponse {
  athletes?: EspnAthleteGroup[]
  season?: { year?: number }
}

/** ESPN parent.abbreviation (OFF/DEF/…) → our side bucket. */
const toSide = (parent: string | undefined): 'OFF' | 'DEF' | 'ST' => {
  const p = (parent ?? '').toUpperCase()
  if (p === 'OFF' || p === 'OFFENSE') return 'OFF'
  if (p === 'DEF' || p === 'DEFENSE') return 'DEF'
  return 'ST'
}

/** experience.abbreviation → FR/SO/JR/SR (GR→SR). null when unknown. */
const toClassYear = (abbr: string | undefined): EspnPlayer['classYear'] => {
  const a = (abbr ?? '').toUpperCase().replace(/^RS-?/, '').trim()
  if (a === 'FR' || a === 'SO' || a === 'JR' || a === 'SR') return a
  if (a === 'GR' || a === 'SR.' || a === 'GS') return 'SR'
  return null
}

const numOrNull = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null)

/** Normalize one raw ESPN athlete → the flat EspnPlayer shape. Pure. */
export const normalizeEspnAthlete = (a: EspnAthlete): EspnPlayer | null => {
  const espnId = a.id != null ? String(a.id).trim() : ''
  if (!espnId) return null
  const name = (a.fullName ?? a.displayName ?? `${a.firstName ?? ''} ${a.lastName ?? ''}`).trim()
  return {
    espnId,
    name,
    jersey: numOrNull(a.jersey),
    side: toSide(a.position?.parent?.abbreviation),
    position: (a.position?.abbreviation ?? '').toUpperCase() || 'ATH',
    classYear: toClassYear(a.experience?.abbreviation),
    experienceYears: numOrNull(a.experience?.years),
    heightIn: numOrNull(a.height),
    weight: numOrNull(a.weight),
    displayHeight: a.displayHeight ?? null,
    homeCity: a.birthPlace?.city ?? null,
    homeState: a.birthPlace?.state ?? null,
    homeCountry: a.birthPlace?.country ?? null,
    headshotUrl: a.headshot?.href ?? null,
    status: a.status?.type ?? null,
    isInjured: Array.isArray(a.injuries) && a.injuries.length > 0,
  }
}

/** Flatten every athlete group → normalized players (drops idless rows). Pure. */
export const mapEspnAthletes = (resp: EspnRosterResponse): EspnPlayer[] => {
  const out: EspnPlayer[] = []
  const seen = new Set<string>()
  for (const group of resp.athletes ?? []) {
    for (const a of group.items ?? []) {
      const p = normalizeEspnAthlete(a)
      if (!p || seen.has(p.espnId)) continue
      seen.add(p.espnId)
      out.push(p)
    }
  }
  return out
}

export const espnRosterUrl = (espnId: string): string =>
  `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${espnId}/roster`

/**
 * Fetch + normalize the ESPN roster. HARD: throws on a network error, non-OK
 * status, or an empty athlete list (the spine must be real, never fabricated).
 * Retries transient failures a few times before giving up.
 */
export const fetchEspnRoster = async (
  espnId: string,
): Promise<{ url: string; season: number; players: EspnPlayer[] }> => {
  const url = espnRosterUrl(espnId)
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`ESPN request failed (${response.status}): ${url} :: ${text.slice(0, 200)}`)
      }
      const json = (await response.json()) as EspnRosterResponse
      const players = mapEspnAthletes(json)
      if (players.length === 0) {
        throw new Error(`ESPN returned an empty roster for espnId ${espnId}`)
      }
      return { url, season: json.season?.year ?? 0, players }
    } catch (error) {
      lastError = error
      if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 500))
    }
  }
  throw lastError ?? new Error(`ESPN roster fetch failed for ${espnId}`)
}
