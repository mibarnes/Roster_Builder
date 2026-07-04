/**
 * net.ts — the one fetch substrate for the collector (F1, blueprint 5.1/P1-P2-P4).
 *
 * Every source (CFBD, ESPN, OurLads, 247, official sites) fetches through
 * `fetchWithPolicy`, which layers three things over the naked `fetch` the
 * sources used to call directly:
 *
 *   P1 — Retry/backoff/429-aware. Retries transient failures (network error,
 *        408/429/5xx) with jittered exponential backoff, honoring a `Retry-After`
 *        header when present. One transient 429 no longer fails a whole team.
 *   P2 — Per-host rate limiting. A min-interval scheduler per logical host spaces
 *        request starts (CFBD ~5rps, scrape hosts ~1rps), bounding the unbounded
 *        `Promise.all` fan-outs that would trip quota at 33-team scale.
 *   P4 — On-disk cache with conditional GET. Stores body + ETag/Last-Modified
 *        under scripts/.cache/<host>/<hash>.json. By default it REVALIDATES every
 *        request (If-None-Match / If-Modified-Since) — so a manual collection run
 *        still gets fresh data, just cheaply (a 304 reuses the cached body with a
 *        server freshness guarantee). Pass `ttlMs` (or COLLECT_CACHE_TTL_MS) to
 *        skip revalidation within a window — for the scheduled F5 refresh.
 *
 * Pure-ish + testable: `fetchImpl` is injectable (defaults to global fetch);
 * the cache dir is overridable. No naked `fetch` may remain in scripts/ — a grep
 * gate (guard-no-naked-fetch.sh) enforces it.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// ── config ───────────────────────────────────────────────────────────────────
/** Minimum ms between request *starts* per logical host (rate limiting). */
const HOST_INTERVAL_MS: Record<string, number> = {
  cfbd: 200, // ~5 rps
  espn: 300,
  ourlads: 1000, // ~1 rps — polite to a scrape target
  '247': 1500,
  official: 1000,
  on3: 1000,
  default: 750,
}

const DEFAULT_RETRIES = 4
const BACKOFF_BASE_MS = 400
const BACKOFF_CAP_MS = 8000
const DEFAULT_CACHE_ROOT = join(import.meta.dirname, '..', '.cache')

// ── types ────────────────────────────────────────────────────────────────────
export interface FetchPolicy {
  /** Logical host key for rate-limit + cache bucketing (e.g. 'cfbd', 'espn'). */
  host: string
  headers?: Record<string, string>
  redirect?: RequestRedirect
  /** Max attempts (incl. the first). Default 4. */
  retries?: number
  /**
   * If set (>0), skip revalidation when the cache entry is younger than this.
   * Default 0 → always revalidate via conditional GET (fresh but cheap).
   */
  ttlMs?: number
  /** Disable the on-disk cache entirely for this request. */
  noCache?: boolean
}

export interface PolicyResponse {
  url: string
  status: number
  ok: boolean
  text: string
  fromCache: boolean
  json<T>(): T
}

interface CacheEntry {
  url: string
  etag: string | null
  lastModified: string | null
  fetchedAt: number
  status: number
  body: string
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

// ── injectable seams (for tests) ─────────────────────────────────────────────
let fetchImpl: FetchImpl = ((url, init) => globalThis.fetch(url, init)) as FetchImpl
let cacheRoot = DEFAULT_CACHE_ROOT
let now: () => number = () => Date.now()
let sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Test seam: override the fetch impl, cache dir, clock, and sleep. */
export function __setNetTestHooks(hooks: {
  fetchImpl?: FetchImpl
  cacheRoot?: string
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}): void {
  if (hooks.fetchImpl) fetchImpl = hooks.fetchImpl
  if (hooks.cacheRoot) cacheRoot = hooks.cacheRoot
  if (hooks.now) now = hooks.now
  if (hooks.sleep) sleep = hooks.sleep
}

/** Reset all seams + rate-limiter state to defaults (for test isolation). */
export function __resetNet(): void {
  fetchImpl = ((url, init) => globalThis.fetch(url, init)) as FetchImpl
  cacheRoot = DEFAULT_CACHE_ROOT
  now = () => Date.now()
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  hostNextFree.clear()
}

// ── rate limiter — per-host min-interval scheduler ───────────────────────────
const hostNextFree = new Map<string, number>()

async function throttle(host: string): Promise<void> {
  const interval = HOST_INTERVAL_MS[host] ?? HOST_INTERVAL_MS.default!
  const current = now()
  const earliest = Math.max(current, hostNextFree.get(host) ?? 0)
  hostNextFree.set(host, earliest + interval)
  const wait = earliest - current
  if (wait > 0) await sleep(wait)
}

// ── backoff ──────────────────────────────────────────────────────────────────
const isRetryableStatus = (s: number): boolean => s === 408 || s === 429 || (s >= 500 && s < 600)

const backoffMs = (attempt: number): number => {
  const base = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1))
  return base + Math.floor(Math.random() * BACKOFF_BASE_MS)
}

/** Parse a Retry-After header (delta-seconds or HTTP-date) to ms, or null. */
const retryAfterMs = (header: string | null): number | null => {
  if (!header) return null
  const secs = Number(header)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const date = Date.parse(header)
  return Number.isFinite(date) ? Math.max(0, date - now()) : null
}

// ── cache ────────────────────────────────────────────────────────────────────
const cachePath = (host: string, url: string): string =>
  join(cacheRoot, host, `${createHash('sha1').update(url).digest('hex')}.json`)

async function readCache(path: string): Promise<CacheEntry | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CacheEntry
  } catch {
    return null
  }
}

async function writeCache(path: string, entry: CacheEntry): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(entry), 'utf8')
  } catch {
    /* cache is best-effort — a write failure must never fail the run */
  }
}

const toResponse = (entry: CacheEntry, fromCache: boolean): PolicyResponse => ({
  url: entry.url,
  status: entry.status,
  ok: entry.status >= 200 && entry.status < 300,
  text: entry.body,
  fromCache,
  json<T>(): T {
    return JSON.parse(entry.body) as T
  },
})

// ── the substrate ────────────────────────────────────────────────────────────
export async function fetchWithPolicy(url: string, policy: FetchPolicy): Promise<PolicyResponse> {
  const { host, headers = {}, redirect = 'follow', retries = DEFAULT_RETRIES, noCache = false } = policy
  const ttlMs = policy.ttlMs ?? Number(process.env.COLLECT_CACHE_TTL_MS ?? 0)
  const useCache = !noCache
  const path = cachePath(host, url)

  const cached = useCache ? await readCache(path) : null
  // TTL fast-path: serve fresh-enough cache without touching the network.
  if (cached && ttlMs > 0 && now() - cached.fetchedAt < ttlMs) {
    return toResponse(cached, true)
  }

  const conditional: Record<string, string> = {}
  if (cached?.etag) conditional['If-None-Match'] = cached.etag
  if (cached?.lastModified) conditional['If-Modified-Since'] = cached.lastModified

  let lastError: unknown = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    await throttle(host)
    try {
      const response = await fetchImpl(url, { headers: { ...headers, ...conditional }, redirect })

      if (response.status === 304 && cached) {
        const refreshed: CacheEntry = { ...cached, fetchedAt: now() }
        if (useCache) await writeCache(path, refreshed)
        return toResponse(refreshed, true)
      }

      if (isRetryableStatus(response.status) && attempt < retries) {
        await response.text().catch(() => '')
        await sleep(retryAfterMs(response.headers.get('retry-after')) ?? backoffMs(attempt))
        continue
      }

      const body = await response.text()
      const entry: CacheEntry = {
        url: response.url || url,
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
        fetchedAt: now(),
        status: response.status,
        body,
      }
      // Only cache successful bodies (don't poison the cache with error pages).
      if (useCache && response.status >= 200 && response.status < 300) {
        await writeCache(path, entry)
      }
      return toResponse(entry, false)
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await sleep(backoffMs(attempt))
        continue
      }
    }
  }
  throw lastError ?? new Error(`fetchWithPolicy exhausted ${retries} attempts: ${url}`)
}
