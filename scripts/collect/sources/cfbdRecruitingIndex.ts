/**
 * National recruiting index (C1) — CFBD-native, NO scraping.
 *
 * The team's OWN feed (`/recruiting/players?team=X`) returns only the recruits X
 * signed. So transfers recruited by OTHER schools, walk-ons recruited elsewhere,
 * and unsigned-by-X freshmen are all invisible to it. The NATIONAL feed
 * (`/recruiting/players?year=X`, no team) returns the WHOLE class — ~2,300
 * rows/yr, athleteId present on ~71%. Indexing many years of it gives a
 * cross-school lookup so every spine player can receive a HS recruiting record:
 *   - by athleteId  → `CFBD-<athleteId>` === the spine playerId (returning players)
 *   - by stdName    → cross-school match (transfers' HS rating, 2026 freshmen)
 *
 * This index is built ONCE per run, held in memory, and shared by both pilots —
 * it is NOT persisted (the raw ~18k-row national index is transient).
 *
 * `fetchNationalRecruitingIndex` is network-touching; `buildNationalIndex` is a
 * pure index builder (unit-tested).
 */
import type { CfbdRecruitRow } from '../cfbd.ts'
import { fetchRecruitingNational } from '../cfbd.ts'
import { stdName } from '../normalize.ts'
import { cfbdId } from '../playerId.ts'

/** One national-class recruit, normalized for the index. */
export interface NatlRecruit {
  /** CFBD athleteId as a string (null for ~29% not yet on a college roster). */
  athleteId: string | null
  name: string
  position: string | null
  stars: number | null
  /** 0–1 composite (CFBD `rating`). */
  compositeRating: number | null
  /** National ranking (CFBD `ranking`). */
  nationalRank: number | null
  /** The school this recruit committed to (cross-school provenance). */
  committedTo: string | null
  /** Recruiting class year (CFBD `year`). */
  recruitYear: number
  homeCity: string | null
  homeState: string | null
}

export interface NationalRecruitingIndex {
  /** Keyed by `CFBD-<athleteId>` (=== spine playerId for returning players). */
  byAthleteId: Map<string, NatlRecruit>
  /** Keyed by stdName → all national recruits with that name (cross-school). */
  byStdName: Map<string, NatlRecruit[]>
  /** Diagnostics for the status report. */
  stats: { rows: number; withAthleteId: number; years: number[] }
}

/** clamp a 0–1 composite (guard against stray out-of-range source values). */
const clamp01 = (v: number | null | undefined): number | null => {
  if (v == null || !Number.isFinite(v)) return null
  return Math.min(1, Math.max(0, v))
}

/** Higher-quality recruit wins when two rows collide (composite, then stars). */
const better = (candidate: NatlRecruit, existing: NatlRecruit | undefined): boolean =>
  !existing ||
  (candidate.compositeRating ?? 0) > (existing.compositeRating ?? 0) ||
  ((candidate.compositeRating ?? 0) === (existing.compositeRating ?? 0) &&
    (candidate.stars ?? 0) > (existing.stars ?? 0))

/**
 * Build the national index from raw CFBD recruiting rows keyed by year. Pure.
 *  - byAthleteId: one record per `CFBD-<athleteId>` (best when a name recurs).
 *  - byStdName:   ALL records per stdName, sorted best-first (so a name match
 *                 takes the highest-rated candidate, then position can refine).
 */
export const buildNationalIndex = (
  rowsByYear: Map<number, CfbdRecruitRow[]>,
): NationalRecruitingIndex => {
  const byAthleteId = new Map<string, NatlRecruit>()
  const byStdName = new Map<string, NatlRecruit[]>()
  let rows = 0
  let withAthleteId = 0

  for (const [year, list] of rowsByYear) {
    for (const r of list) {
      const sn = stdName(r.name ?? '')
      if (!sn) continue
      rows += 1
      const hasId = r.athleteId != null && String(r.athleteId).trim() !== ''
      const rec: NatlRecruit = {
        athleteId: hasId ? String(r.athleteId).trim() : null,
        name: r.name ?? sn,
        position: r.position ?? null,
        stars: r.stars ?? null,
        compositeRating: clamp01(r.rating),
        nationalRank: r.ranking ?? null,
        committedTo: r.committedTo ?? null,
        recruitYear: r.year ?? year,
        homeCity: r.city ?? null,
        homeState: r.stateProvince ?? null,
      }
      if (rec.athleteId) {
        withAthleteId += 1
        const key = cfbdId(rec.athleteId)
        if (better(rec, byAthleteId.get(key))) byAthleteId.set(key, rec)
      }
      const bucket = byStdName.get(sn) ?? []
      bucket.push(rec)
      byStdName.set(sn, bucket)
    }
  }

  // sort each name bucket best-first so name lookups prefer the top rating
  for (const bucket of byStdName.values()) {
    bucket.sort((a, b) => (b.compositeRating ?? 0) - (a.compositeRating ?? 0) || (b.stars ?? 0) - (a.stars ?? 0))
  }

  return {
    byAthleteId,
    byStdName,
    stats: { rows, withAthleteId, years: [...rowsByYear.keys()].sort((a, b) => a - b) },
  }
}

/**
 * Fetch the national recruiting class for each year and build the index. ONE
 * call per run (shared by all pilots). A year that fails to fetch degrades to an
 * empty list (logged) rather than failing the whole run — the team's own id-keyed
 * feed remains the primary source.
 */
export const fetchNationalRecruitingIndex = async (
  years: number[],
  apiKey: string,
): Promise<NationalRecruitingIndex> => {
  const rowsByYear = new Map<number, CfbdRecruitRow[]>()
  await Promise.all(
    years.map(async (year) => {
      try {
        const rows = await fetchRecruitingNational(year, apiKey)
        rowsByYear.set(year, Array.isArray(rows) ? rows : [])
      } catch (error) {
        console.warn(`[natl-recruiting] year ${year} fetch failed — ${(error as Error).message}`)
        rowsByYear.set(year, [])
      }
    }),
  )
  return buildNationalIndex(rowsByYear)
}
