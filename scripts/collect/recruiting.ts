/**
 * Recruiting source builder (E1 — CFBD-primary).
 *
 * Join precedence per roster player:
 *   1. CFBD /recruiting/players athleteId === roster CFBD id  → matchMethod 'cfbd-id'
 *   2. 247Sports player247Id (when CFBD lacks the record)     → matchMethod '247-id'
 *   3. name-fuzzy resolution (last resort, FLAGGED)           → matchMethod 'name-fuzzy'
 *   4. no external record                                     → matchMethod 'none'
 *
 * Merge policy: prefer CFBD stars/rating/ranking/hometown; supplement with 247
 * transfer-portal stars and any recruit CFBD lacks. The 247 scrape (commits +
 * transfers) is BALANCED in, not removed.
 */
import { buildRosterNameIndex, resolveByStdName, stdName, type RosterPlayerLike } from './normalize.ts'
import { fetch247Html, type CfbdRecruitRow } from './cfbd.ts'
import { cfbdId } from './playerId.ts'
import { parse247ClassSummary, parse247Commits, parse247Transfers } from './parsers/recruiting247.ts'

export type MatchMethod = 'cfbd-id' | '247-id' | 'name-fuzzy' | 'none'

export interface RecruitMatch {
  year?: number
  method: string
  similarity?: number
  player247Id: string | null
  cfbdRecruitId?: string | null
}

export interface RecruitProfile {
  playerId: string
  name: string
  stars: number | null
  compositeRating: number | null
  nationalRank: number | null
  positionRank: number | null
  transferPortalStars: number | null
  transferRating: number | null
  fromSchool: string | null
  isTransfer: boolean
  years: number[]
  matchMethod: MatchMethod
  matches: RecruitMatch[]
  homeCity: string | null
  homeState: string | null
  homeLat: number | null
  homeLon: number | null
}

export interface RecruitingSource {
  sourceId: string
  sourceType: 'recruiting'
  asOf: string
  version: string
  team: string
  years: number[]
  teamClassRankings: Record<string, unknown>[]
  playerRecruitProfiles: RecruitProfile[]
  unmatchedRecruits: Record<string, unknown>[]
  failedYears: number[]
  partial: boolean
  /** Coverage breakdown by match method (for the status report). */
  matchSummary: Record<MatchMethod, number>
}

/**
 * A 247 transfer-portal record carried by NAME, for name-matching the team's
 * incoming transfers to the ESPN 2026 spine (GAP C). The team commits page lists
 * the transfers the team brought IN — these are name-matched to spine players
 * who lack recruiting (transfers recruited by OTHER schools, so CFBD
 * /recruiting/players?team=X misses them).
 */
export interface TransferOverlayRecord {
  name: string
  stdName: string
  position: string | null
  transferStars: number | null
  transferRating: number | null
  fromSchool: string | null
}

/**
 * An incoming-class CFBD recruit (athleteId === null) — a HS signee not yet on
 * any college roster, so it cannot be id-joined. Carried by NAME (+ position) so
 * the reconciler can match it to the ESPN 2026 spine (the new-2026 class).
 */
export interface IncomingRecruit {
  name: string
  stdName: string
  position: string | null
  stars: number | null
  compositeRating: number | null
  nationalRank: number | null
  year: number
  homeCity: string | null
  homeState: string | null
}

/**
 * Extract the incoming-class recruits (athleteId null) from the fetched CFBD
 * recruiting rows. These are NOT on the CFBD-2025 roster (they're future
 * signees), so they're name-matched to the ESPN spine downstream rather than
 * id-joined. Highest-rated record per stdName wins (a name can recur across the
 * 2026/2027 classes). Pure.
 */
export const buildIncomingRecruits = (
  cfbdRecruitsByYear: Map<number, CfbdRecruitRow[]>,
): IncomingRecruit[] => {
  const byName = new Map<string, IncomingRecruit>()
  for (const [year, rows] of cfbdRecruitsByYear) {
    for (const r of rows) {
      const hasId = r.athleteId != null && String(r.athleteId).trim() !== ''
      if (hasId) continue // returning/known players are id-joined elsewhere
      const sn = stdName(r.name ?? '')
      if (!sn) continue
      const candidate: IncomingRecruit = {
        name: r.name ?? sn,
        stdName: sn,
        position: r.position ?? null,
        stars: r.stars ?? null,
        compositeRating: clamp01(r.rating),
        nationalRank: r.ranking ?? null,
        year,
        homeCity: r.city ?? null,
        homeState: r.stateProvince ?? null,
      }
      const existing = byName.get(sn)
      // prefer the higher-rated record (composite, then stars, then newer year)
      const better =
        !existing ||
        (candidate.compositeRating ?? 0) > (existing.compositeRating ?? 0) ||
        ((candidate.compositeRating ?? 0) === (existing.compositeRating ?? 0) &&
          (candidate.stars ?? 0) > (existing.stars ?? 0))
      if (better) byName.set(sn, candidate)
    }
  }
  return [...byName.values()]
}

const emptyProfile = (playerId: string, name: string): RecruitProfile => ({
  playerId,
  name,
  stars: null,
  compositeRating: null,
  nationalRank: null,
  positionRank: null,
  transferPortalStars: null,
  transferRating: null,
  fromSchool: null,
  isTransfer: false,
  years: [],
  matchMethod: 'none',
  matches: [],
  homeCity: null,
  homeState: null,
  homeLat: null,
  homeLon: null,
})

/** clamp a 0–1 composite (guard against stray out-of-range source values). */
const clamp01 = (v: number | null | undefined): number | null => {
  if (v == null || !Number.isFinite(v)) return null
  return Math.min(1, Math.max(0, v))
}

export const buildRecruitingSource = async ({
  teamLabel,
  teamSlug,
  rosterPlayers,
  years,
  cfbdRecruitsByYear,
  fetch247,
}: {
  teamLabel: string
  teamSlug: string
  rosterPlayers: RosterPlayerLike[]
  years: number[]
  /** CFBD /recruiting/players rows keyed by year (PRIMARY source). */
  cfbdRecruitsByYear: Map<number, CfbdRecruitRow[]>
  /** Injectable 247 fetcher (defaults to live fetch247Html). */
  fetch247?: (slug: string, year: number) => Promise<string>
}): Promise<RecruitingSource & { transferOverlay: TransferOverlayRecord[] }> => {
  const fetch247Fn = fetch247 ?? fetch247Html
  const index = buildRosterNameIndex(rosterPlayers)
  const rosterIdSet = new Set(rosterPlayers.map((p) => p.playerId))
  const nameById = new Map(rosterPlayers.map((p) => [p.playerId, p.name ?? '']))
  const teamClassRankings: Record<string, unknown>[] = []
  const profileByPlayerId = new Map<string, RecruitProfile>()
  const unmatchedRecruits: Record<string, unknown>[] = []
  const failedYears: number[] = []
  // Every parsed 247 transfer (by name) for spine matching downstream (GAP C);
  // highest transferRating per stdName wins.
  const transferByName = new Map<string, TransferOverlayRecord>()

  const resolveName = (cleanedName: string, position?: string): string | null => {
    const r = resolveByStdName({
      ourladsName: cleanedName,
      ourladsPosition: position ?? null,
      rosterByStdName: index.rosterByStdName,
      rosterNamePairs: index.rosterNamePairs,
    })
    return r?.playerId ?? null
  }

  const getProfile = (playerId: string): RecruitProfile => {
    const existing = profileByPlayerId.get(playerId)
    if (existing) return existing
    const fresh = emptyProfile(playerId, nameById.get(playerId) ?? playerId)
    profileByPlayerId.set(playerId, fresh)
    return fresh
  }

  /** Promote a profile's matchMethod following precedence (cfbd-id strongest). */
  const rank: Record<MatchMethod, number> = { 'cfbd-id': 3, '247-id': 2, 'name-fuzzy': 1, none: 0 }
  const promote = (profile: RecruitProfile, method: MatchMethod): void => {
    if (rank[method] > rank[profile.matchMethod]) profile.matchMethod = method
  }

  // ── 1) CFBD /recruiting/players — PRIMARY, id-keyed via athleteId ───────────
  for (const year of years) {
    for (const recruit of cfbdRecruitsByYear.get(year) ?? []) {
      const athleteId = recruit.athleteId
      const playerId = athleteId != null && String(athleteId).trim() !== '' ? cfbdId(athleteId) : null
      if (!playerId || !rosterIdSet.has(playerId)) {
        // recruit not on current roster — record as unmatched context
        unmatchedRecruits.push({ year, source: 'cfbd', name: recruit.name, athleteId: athleteId ?? null, cfbdRecruitId: recruit.id ?? null })
        continue
      }
      const profile = getProfile(playerId)
      promote(profile, 'cfbd-id')
      // CFBD is authoritative for stars/rating/ranking/hometown
      profile.stars = recruit.stars ?? profile.stars
      profile.compositeRating = clamp01(recruit.rating) ?? profile.compositeRating
      profile.nationalRank =
        profile.nationalRank == null ? recruit.ranking ?? null : Math.min(profile.nationalRank, recruit.ranking ?? profile.nationalRank)
      profile.homeCity = recruit.city ?? profile.homeCity
      profile.homeState = recruit.stateProvince ?? profile.homeState
      profile.homeLat = recruit.hometownInfo?.latitude ?? profile.homeLat
      profile.homeLon = recruit.hometownInfo?.longitude ?? profile.homeLon
      profile.years = [...new Set([...profile.years, year])].sort((a, b) => b - a)
      profile.matches.push({ year, method: 'cfbd-athleteId', player247Id: null, cfbdRecruitId: recruit.id != null ? String(recruit.id) : null })
    }
  }

  // ── 2) 247Sports scrape — SUPPLEMENT (transfer portal + recruits CFBD lacks)
  for (const year of years) {
    let html: string
    try {
      html = await fetch247Fn(teamSlug, year)
    } catch (error) {
      failedYears.push(year)
      console.warn(`[recruiting] ${teamLabel} ${year}: 247 fetch failed — ${(error as Error).message}`)
      continue
    }

    const commits = parse247Commits(html)
    const transfers = parse247Transfers(html)
    teamClassRankings.push({ year, team: teamLabel, source: '247sports', ...parse247ClassSummary(html) })

    for (const recruit of commits) {
      const playerId = resolveName(recruit.cleanedName, recruit.position)
      if (!playerId) {
        unmatchedRecruits.push({ year, source: '247', name: recruit.name, cleanedName: recruit.cleanedName, player247Id: recruit.player247Id })
        continue
      }
      const profile = getProfile(playerId)
      const already = profile.matchMethod === 'cfbd-id'
      // only mark 247-id/name-fuzzy if CFBD did NOT already place this player
      promote(profile, already ? 'cfbd-id' : recruit.player247Id ? '247-id' : 'name-fuzzy')
      // supplement only where CFBD lacks data
      if (profile.stars == null) profile.stars = recruit.stars ?? null
      if (profile.compositeRating == null) profile.compositeRating = clamp01((recruit.score ?? 0) / 100)
      if (profile.nationalRank == null) profile.nationalRank = recruit.nationalRank
      if (profile.positionRank == null) profile.positionRank = recruit.positionRank
      profile.years = [...new Set([...profile.years, year])].sort((a, b) => b - a)
      profile.matches.push({ year, method: '247-commit', similarity: 1, player247Id: recruit.player247Id })
    }

    for (const transfer of transfers) {
      // Record every parsed transfer by name for spine matching (GAP C),
      // regardless of whether it resolves to the CFBD-2025 roster here.
      const sn = transfer.cleanedName
      if (sn) {
        const rec: TransferOverlayRecord = {
          name: transfer.name,
          stdName: sn,
          position: transfer.position || null,
          transferStars: transfer.transferStars ?? null,
          transferRating: transfer.transferRating ?? null,
          fromSchool: transfer.fromSchool ?? null,
        }
        const existing = transferByName.get(sn)
        if (!existing || (rec.transferRating ?? 0) > (existing.transferRating ?? 0)) {
          transferByName.set(sn, rec)
        }
      }
      const playerId = resolveName(transfer.cleanedName, transfer.position)
      if (!playerId) {
        unmatchedRecruits.push({ year, source: '247', name: transfer.name, cleanedName: transfer.cleanedName, player247Id: transfer.player247Id, isTransfer: true })
        continue
      }
      const profile = getProfile(playerId)
      if (profile.matchMethod === 'none') promote(profile, transfer.player247Id ? '247-id' : 'name-fuzzy')
      // 247 transfer-portal stars/rating are CFBD-absent → always supplement
      profile.transferPortalStars = transfer.transferStars ?? profile.transferPortalStars
      profile.transferRating = transfer.transferRating ?? profile.transferRating
      profile.fromSchool = transfer.fromSchool ?? profile.fromSchool
      profile.isTransfer = true
    }
  }

  // ── 3) ensure every roster player has a profile (matchMethod 'none') ────────
  for (const rosterPlayer of rosterPlayers) {
    if (!profileByPlayerId.has(rosterPlayer.playerId)) {
      profileByPlayerId.set(rosterPlayer.playerId, emptyProfile(rosterPlayer.playerId, rosterPlayer.name ?? ''))
    }
  }

  const profiles = [...profileByPlayerId.values()]
  const matchSummary: Record<MatchMethod, number> = { 'cfbd-id': 0, '247-id': 0, 'name-fuzzy': 0, none: 0 }
  for (const p of profiles) matchSummary[p.matchMethod] += 1

  return {
    sourceId: 'cfbd-247-recruiting-v2',
    sourceType: 'recruiting',
    asOf: new Date().toISOString().slice(0, 10),
    version: 'recruiting-2026.2',
    team: teamLabel,
    years,
    teamClassRankings,
    playerRecruitProfiles: profiles,
    unmatchedRecruits,
    failedYears,
    partial: failedYears.length > 0,
    matchSummary,
    transferOverlay: [...transferByName.values()],
  }
}

export { stdName }
