/**
 * CFBD transfer-portal source (C1) — CFBD-native, NO scraping.
 *
 * `/player/portal?year=Y` (no team) returns every transfer-portal entry for the
 * year, each with origin/destination schools + a transfer rating/stars +
 * eligibility. We fetch a span of years ONCE per run (shared by all pilots) and
 * filter incoming = destination === team.cfbdQuery. This is the cross-school
 * transfer signal the team's own `/recruiting/players?team=X` (own recruits
 * only) feed cannot supply, and a CFBD-native replacement for the 247 scrape.
 *
 * `fetchPortal` is network-touching; `incomingTransfers` is a pure filter (unit-
 * tested). A small `sources/cfbd-portal.json` is persisted per team for
 * provenance/auditing.
 */
import type { CfbdPortalRow } from '../cfbd.ts'
import { fetchPortalYear } from '../cfbd.ts'
import { stdName } from '../normalize.ts'

/** A normalized incoming transfer (destination === team). */
export interface PortalIncoming {
  name: string
  /** stdName for matching to the spine. */
  stdName: string
  position: string | null
  origin: string | null
  destination: string | null
  /** 0–1 transfer rating. */
  rating: number | null
  stars: number | null
  eligibility: string | null
  transferDate: string | null
  season: number
}

/** clamp a 0–1 rating (guard against stray out-of-range source values). */
const clamp01 = (v: number | null | undefined): number | null => {
  if (v == null || !Number.isFinite(v)) return null
  return Math.min(1, Math.max(0, v))
}

const fullName = (r: CfbdPortalRow): string =>
  `${r.firstName ?? ''} ${r.lastName ?? ''}`.replace(/\s+/g, ' ').trim()

/**
 * Filter raw portal rows to the team's INCOMING transfers (destination ===
 * cfbdQuery) and normalize. Highest-rated record per stdName wins (a name can
 * appear across the fetched years). Pure.
 */
export const incomingTransfers = (rows: CfbdPortalRow[], cfbdQuery: string): PortalIncoming[] => {
  const byName = new Map<string, PortalIncoming>()
  for (const r of rows) {
    if ((r.destination ?? '') !== cfbdQuery) continue
    const name = fullName(r)
    const sn = stdName(name)
    if (!sn) continue
    const candidate: PortalIncoming = {
      name,
      stdName: sn,
      position: r.position ?? null,
      origin: r.origin ?? null,
      destination: r.destination ?? null,
      rating: clamp01(r.rating),
      stars: r.stars ?? null,
      eligibility: r.eligibility ?? null,
      transferDate: r.transferDate ?? null,
      season: r.season ?? 0,
    }
    const existing = byName.get(sn)
    const better =
      !existing ||
      (candidate.rating ?? 0) > (existing.rating ?? 0) ||
      ((candidate.rating ?? 0) === (existing.rating ?? 0) && (candidate.stars ?? 0) > (existing.stars ?? 0))
    if (better) byName.set(sn, candidate)
  }
  return [...byName.values()]
}

export interface PortalFetchResult {
  /** All raw rows across the fetched years (used to filter per pilot). */
  rows: CfbdPortalRow[]
  years: number[]
}

/**
 * Fetch the transfer portal for each year ONCE (shared by all pilots). A year
 * that fails to fetch degrades to an empty list (logged) rather than failing the
 * run — the team's id-keyed recruiting feed remains the primary source.
 */
export const fetchPortal = async (years: number[], apiKey: string): Promise<PortalFetchResult> => {
  const all: CfbdPortalRow[] = []
  await Promise.all(
    years.map(async (year) => {
      try {
        const rows = await fetchPortalYear(year, apiKey)
        if (Array.isArray(rows)) all.push(...rows)
      } catch (error) {
        console.warn(`[portal] year ${year} fetch failed — ${(error as Error).message}`)
      }
    }),
  )
  return { rows: all, years }
}
