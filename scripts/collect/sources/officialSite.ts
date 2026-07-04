/**
 * Official-team-site roster overlay — BEST-EFFORT, non-load-bearing.
 *
 * Engines supported (detected by content, not by registry hint — a site that
 * silently swaps CMS still resolves):
 *  - nuxt-sidearm (Florida): the roster lives in a `__NUXT_DATA__` serialized
 *    flat array (devalue-style refs) with camelCase player objects. We resolve
 *    those refs to pull highSchool / previousSchool / hometown / jersey / class.
 *  - sidearm-json (Clemson/Auburn/Texas A&M …): the same `__NUXT_DATA__` array
 *    but snake_case player objects (`first_name`/`high_school`/…). Bio overlay
 *    only (position/class arrive as non-load-bearing `*_id` refs). See
 *    `parseSidearmJsonRoster`.
 *  - wmt-presto (Miami/Notre Dame): a client-rendered SPA whose LANDING page server-renders
 *    per-player profile LINKS, and whose PROFILE pages server-render the bio in
 *    `<div class="item"><span>Label</span><p>Value</p></div>` blocks (Hometown /
 *    High School / Previous School / Class / position). We extract the profile
 *    slugs from the landing page, fetch each profile, and parse those blocks.
 *
 * Anything we don't recognize DEGRADES gracefully: `degraded:true`, empty
 * players, a reason — NEVER throw the run.
 *
 * The pure parsers (`parseNuxtRoster`, `extractPrestoPlayerPaths`,
 * `parsePrestoPlayerPage`) are unit-tested against saved fixtures.
 */
import type { OfficialPlayer } from '../../../src/data/schema/officialRoster.ts'
import { stripTags } from '../normalize.ts'
import { fetchWithPolicy } from '../net.ts'

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const clean = (v: unknown): string | null => {
  if (v == null) return null
  const s = stripTags(String(v)).trim()
  return s === '' ? null : s
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Pull the `__NUXT_DATA__` JSON array from a Sidearm/Nuxt page. null if absent. */
export const extractNuxtArray = (html: string): unknown[] | null => {
  // Tolerant: id may sit anywhere in the attribute list. Take the largest
  // candidate body that parses as a JSON array (the roster payload is big).
  const re = /<script\b[^>]*\bid="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  let best: unknown[] | null = null
  while ((m = re.exec(html))) {
    const body = m[1]
    if (!body || body.length < 1000) continue
    try {
      const arr = JSON.parse(body)
      if (Array.isArray(arr) && (!best || arr.length > best.length)) best = arr
    } catch {
      // not this candidate
    }
  }
  return best
}

/**
 * Parse the Nuxt flat array into official player overlay rows. Resolves devalue
 * refs (numeric key value === index into the array). Returns [] on any shape we
 * don't recognize (caller degrades). Pure.
 */
export const parseNuxtRoster = (arr: unknown[]): OfficialPlayer[] => {
  const res = (idx: unknown): unknown =>
    typeof idx === 'number' && idx >= 0 && idx < arr.length ? arr[idx] : idx
  const players: OfficialPlayer[] = []
  for (const o of arr) {
    if (
      o &&
      typeof o === 'object' &&
      !Array.isArray(o) &&
      'highSchool' in o &&
      'lastName' in o &&
      'hometown' in o
    ) {
      const rec = o as Record<string, unknown>
      const first = clean(res(rec.firstName))
      const last = clean(res(rec.lastName))
      const name = [first, last].filter(Boolean).join(' ').trim()
      if (!name) continue
      players.push({
        name,
        jersey: numOrNull(res(rec.jersey)),
        position: clean(res(rec.positionShort) ?? res(rec.positionLong)),
        classYear: clean(res(rec.academicYearShort) ?? res(rec.classYear)),
        hometown: clean(res(rec.hometown)),
        highSchool: clean(res(rec.highSchool)),
        previousSchool: clean(res(rec.previousSchool)),
      })
    }
  }
  return players
}

/**
 * Sidearm "JSON data-model" variant (snake_case). Newer Sidearm sites serialize
 * the roster into the same `__NUXT_DATA__` devalue array, but the player objects
 * use snake_case keys (`first_name`/`last_name`/`full_name`/`high_school`/
 * `hometown`/`previous_school`/`jersey_number`) and a richer schema than the
 * camelCase Florida/Georgia variant that `parseNuxtRoster` handles.
 *
 * Same devalue-ref resolution (numeric value === index into the array). We guard
 * every text field to a resolved STRING (a ref that lands on `null`/an object
 * yields null, not the literal `"null"`). Position/class arrive as numeric
 * `*_id` refs into lookup tables and are NON-load-bearing for the overlay (ESPN
 * and CFBD supply position/class), so we extract the bio fields only. Pure.
 */
export const parseSidearmJsonRoster = (arr: unknown[]): OfficialPlayer[] => {
  const resStr = (idx: unknown): string | null => {
    const v = typeof idx === 'number' && idx >= 0 && idx < arr.length ? arr[idx] : idx
    return typeof v === 'string' ? v : null
  }
  const players: OfficialPlayer[] = []
  for (const o of arr) {
    if (
      o &&
      typeof o === 'object' &&
      !Array.isArray(o) &&
      'first_name' in o &&
      'last_name' in o &&
      'high_school' in o &&
      'hometown' in o
    ) {
      const rec = o as Record<string, unknown>
      const full = clean(resStr(rec.full_name))
      const first = clean(resStr(rec.first_name))
      const last = clean(resStr(rec.last_name))
      const name = full ?? [first, last].filter(Boolean).join(' ').trim()
      if (!name) continue
      players.push({
        name,
        jersey: numOrNull(resStr(rec.jersey_number) ?? resStr(rec.jersey_number_label)),
        position: null,
        classYear: null,
        hometown: clean(resStr(rec.hometown)),
        highSchool: clean(resStr(rec.high_school)),
        previousSchool: clean(resStr(rec.previous_school)),
      })
    }
  }
  return players
}

// ── WMT/Presto engine (Miami) ─────────────────────────────────────────────────

/**
 * Extract distinct per-player profile PATHS from a WMT/Presto roster LANDING
 * page (the roster table itself is client-rendered, but the profile links are
 * server-rendered). Returns absolute paths like
 * `/sports/football/roster/season/2026-27/player/<slug>/`. Pure.
 */
export const extractPrestoPlayerPaths = (landingHtml: string): string[] => {
  const re = /\/sports\/football\/roster\/season\/[0-9-]+\/player\/[a-z0-9-]+\/?/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(landingHtml))) {
    let path = m[0]
    if (!path.endsWith('/')) path += '/'
    seen.add(path)
  }
  return [...seen]
}

/** Decode the numeric/dash HTML entities that appear in WMT/Presto <title> tags. */
const decodeEntities = (s: string): string =>
  s
    .replace(/&#8211;|&ndash;|&#x2013;/gi, '–')
    .replace(/&#8212;|&mdash;|&#x2014;/gi, '—')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))

/** Title → display name ("Mark Fletcher Jr. – University of Miami Athletics" → "Mark Fletcher Jr."). */
const prestoNameFromTitle = (html: string): string | null => {
  const t = html.match(/<title>([^<]+)<\/title>/i)
  if (!t) return null
  const decoded = decodeEntities(stripTags(t[1] ?? ''))
  // strip a trailing site suffix after an en/em dash or hyphen-dash
  const name = decoded.split(/\s+[–—-]\s+/)[0]?.trim()
  return name && name.length > 0 ? name : null
}

/**
 * Parse one WMT/Presto player PROFILE page into an official overlay row. Reads
 * the `<div class="item"><span>Label</span><p>Value</p></div>` bio blocks for
 * Hometown / High School / Previous School / Class / position. Returns null when
 * the page carries no recognizable name. Pure.
 */
export const parsePrestoPlayerPage = (html: string): OfficialPlayer | null => {
  const name = prestoNameFromTitle(html)
  if (!name) return null
  const items = new Map<string, string>()
  const re = /<div class="item">\s*<span>([^<]+)<\/span>\s*<p>([^<]*)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const label = stripTags(m[1] ?? '').toLowerCase().trim()
    const value = clean(m[2])
    if (label && value) items.set(label, value)
  }
  return {
    name,
    jersey: numOrNull(items.get('number') ?? items.get('jersey') ?? null),
    position: items.get('position') ?? null,
    classYear: items.get('class') ?? null,
    hometown: items.get('hometown') ?? null,
    highSchool: items.get('high school') ?? null,
    previousSchool: items.get('previous school') ?? items.get('last school') ?? null,
  }
}

export interface OfficialParseResult {
  engine: string
  degraded: boolean
  degradeReason: string | null
  players: OfficialPlayer[]
}

/**
 * Pure: a SINGLE landing HTML → parsed overlay (engine detection + degrade
 * reason). The Nuxt (Florida) roster is fully present in the landing HTML so it
 * resolves here. The WMT/Presto (Miami) roster needs per-profile fetches, so
 * this only DETECTS the engine (returns degraded with engine 'wmt-presto');
 * `fetchOfficialRoster` then drives the multi-page fetch.
 */
export const parseOfficialHtml = (html: string): OfficialParseResult => {
  const nuxt = extractNuxtArray(html)
  if (nuxt) {
    // camelCase Sidearm (Florida/Georgia) …
    const players = parseNuxtRoster(nuxt)
    if (players.length > 0) {
      return { engine: 'nuxt-sidearm', degraded: false, degradeReason: null, players }
    }
    // … then the snake_case Sidearm JSON data-model (Clemson/Auburn/Texas A&M …).
    const snake = parseSidearmJsonRoster(nuxt)
    if (snake.length > 0) {
      return { engine: 'sidearm-json', degraded: false, degradeReason: null, players: snake }
    }
    return {
      engine: 'nuxt-sidearm',
      degraded: true,
      degradeReason: 'Nuxt data island present but no player objects matched a known shape',
      players: [],
    }
  }
  if (extractPrestoPlayerPaths(html).length > 0) {
    return {
      engine: 'wmt-presto',
      degraded: true,
      degradeReason: 'WMT/Presto SPA — profile links found; bio requires per-player fetch',
      players: [],
    }
  }
  return {
    engine: 'unknown',
    degraded: true,
    degradeReason: 'No __NUXT_DATA__ island (likely a client-rendered/non-Sidearm roster)',
    players: [],
  }
}

/** Fetch one URL → text, or null on any non-OK / error (best-effort, no throw). */
const fetchText = async (url: string): Promise<string | null> => {
  try {
    const r = await fetchWithPolicy(url, { host: 'official', headers: { 'User-Agent': BROWSER_UA } })
    return r.ok ? r.text : null
  } catch {
    return null
  }
}

/** Resolve a possibly-relative path against a base origin. */
const toAbsolute = (base: string, path: string): string => {
  try {
    return new URL(path, base).toString()
  } catch {
    return path
  }
}

/**
 * WMT/Presto multi-page overlay (Miami): fetch each player profile page (bounded
 * concurrency) and parse its bio blocks. Best-effort — any individual page that
 * fails is skipped; the team degrades only if NOTHING resolved.
 */
const fetchPrestoRoster = async (
  landingUrl: string,
  paths: string[],
): Promise<OfficialParseResult> => {
  const CONCURRENCY = 6
  const players: OfficialPlayer[] = []
  let attempted = 0
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (p) => {
        attempted += 1
        const html = await fetchText(toAbsolute(landingUrl, p))
        return html ? parsePrestoPlayerPage(html) : null
      }),
    )
    for (const r of results) if (r) players.push(r)
  }
  const withBio = players.filter((p) => p.highSchool || p.previousSchool || p.hometown)
  if (withBio.length === 0) {
    return {
      engine: 'wmt-presto',
      degraded: true,
      degradeReason: `WMT/Presto: fetched ${attempted} profiles but none yielded bio fields`,
      players: [],
    }
  }
  return { engine: 'wmt-presto', degraded: false, degradeReason: null, players }
}

/**
 * Fetch + parse a team's official roster page. ALWAYS resolves (never throws):
 * a network/parse failure yields a degraded result so the run continues. For the
 * WMT/Presto SPA (Miami), drives a follow-up per-profile fetch to recover bio.
 */
export const fetchOfficialRoster = async (url: string): Promise<OfficialParseResult> => {
  const html = await fetchText(url)
  if (html == null) {
    return { engine: 'unknown', degraded: true, degradeReason: `fetch failed: ${url}`, players: [] }
  }
  const parsed = parseOfficialHtml(html)
  if (parsed.engine === 'wmt-presto') {
    const paths = extractPrestoPlayerPaths(html)
    if (paths.length === 0) return parsed
    return fetchPrestoRoster(url, paths)
  }
  return parsed
}
