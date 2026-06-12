/**
 * Recruiting source builder. Fetches N years of 247 commits pages, parses them,
 * resolves recruits/transfers against the roster, and folds into per-player
 * profiles. Best-effort: per-year fetch/parse failures degrade gracefully and
 * are recorded — the caller decides whether the gap is acceptable.
 */
import { buildRosterNameIndex, resolveByStdName, type RosterPlayerLike } from './normalize.ts'
import { fetch247Html } from './cfbd.ts'
import { parse247ClassSummary, parse247Commits, parse247Transfers } from './parsers/recruiting247.ts'

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
  matches: { year: number; method: string; similarity: number; player247Id: string | null }[]
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
  /** Honest degradation flag: years whose fetch/parse failed. */
  failedYears: number[]
  partial: boolean
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
  matches: [],
})

export const buildRecruitingSource = async ({
  teamLabel,
  teamSlug,
  rosterPlayers,
  years,
}: {
  teamLabel: string
  teamSlug: string
  rosterPlayers: RosterPlayerLike[]
  years: number[]
}): Promise<RecruitingSource> => {
  const index = buildRosterNameIndex(rosterPlayers)
  const teamClassRankings: Record<string, unknown>[] = []
  const profileByPlayerId = new Map<string, RecruitProfile>()
  const unmatchedRecruits: Record<string, unknown>[] = []
  const failedYears: number[] = []

  const resolve = (cleanedName: string, position?: string) =>
    resolveByStdName({
      ourladsName: cleanedName,
      ourladsPosition: position ?? null,
      rosterByStdName: index.rosterByStdName,
      rosterNamePairs: index.rosterNamePairs,
    })

  for (const year of years) {
    let html: string
    try {
      html = await fetch247Html(teamSlug, year)
    } catch (error) {
      failedYears.push(year)
      console.warn(`[recruiting] ${teamLabel} ${year}: 247 fetch failed — ${(error as Error).message}`)
      continue
    }

    const commits = parse247Commits(html)
    const classSummary = parse247ClassSummary(html)
    const transfers = parse247Transfers(html)

    teamClassRankings.push({ year, team: teamLabel, source: '247sports', ...classSummary })

    for (const recruit of commits) {
      const resolved = resolve(recruit.cleanedName, recruit.position)
      if (!resolved) {
        unmatchedRecruits.push({ year, name: recruit.name, cleanedName: recruit.cleanedName, player247Id: recruit.player247Id })
        continue
      }
      const rosterName = rosterPlayers.find((p) => p.playerId === resolved.playerId)?.name ?? recruit.name
      const existing = profileByPlayerId.get(resolved.playerId) ?? emptyProfile(resolved.playerId, rosterName)
      profileByPlayerId.set(resolved.playerId, {
        ...existing,
        stars: Math.max(existing.stars ?? 0, recruit.stars ?? 0) || null,
        compositeRating: Math.max(existing.compositeRating ?? 0, (recruit.score ?? 0) / 100) || null,
        nationalRank:
          existing.nationalRank == null
            ? recruit.nationalRank
            : Math.min(existing.nationalRank, recruit.nationalRank ?? existing.nationalRank),
        positionRank:
          existing.positionRank == null
            ? recruit.positionRank
            : Math.min(existing.positionRank, recruit.positionRank ?? existing.positionRank),
        years: [...new Set([...existing.years, year])].sort((a, b) => b - a),
        matches: [
          ...existing.matches,
          { year, method: resolved.method, similarity: resolved.similarity ?? 1, player247Id: recruit.player247Id },
        ],
      })
    }

    for (const transfer of transfers) {
      const resolved = resolve(transfer.cleanedName, transfer.position)
      if (!resolved) {
        unmatchedRecruits.push({ year, name: transfer.name, cleanedName: transfer.cleanedName, player247Id: transfer.player247Id, isTransfer: true })
        continue
      }
      const rosterName = rosterPlayers.find((p) => p.playerId === resolved.playerId)?.name ?? transfer.name
      const existing = profileByPlayerId.get(resolved.playerId) ?? emptyProfile(resolved.playerId, rosterName)
      profileByPlayerId.set(resolved.playerId, {
        ...existing,
        transferPortalStars: transfer.transferStars ?? existing.transferPortalStars,
        transferRating: transfer.transferRating ?? existing.transferRating,
        fromSchool: transfer.fromSchool ?? existing.fromSchool,
        isTransfer: true,
      })
    }
  }

  for (const rosterPlayer of rosterPlayers) {
    if (!profileByPlayerId.has(rosterPlayer.playerId)) {
      profileByPlayerId.set(rosterPlayer.playerId, emptyProfile(rosterPlayer.playerId, rosterPlayer.name ?? ''))
    }
  }

  return {
    sourceId: '247sports-recruiting-v1',
    sourceType: 'recruiting',
    asOf: new Date().toISOString().slice(0, 10),
    version: '247sports-2026.1',
    team: teamLabel,
    years,
    teamClassRankings,
    playerRecruitProfiles: [...profileByPlayerId.values()],
    unmatchedRecruits,
    failedYears,
    partial: failedYears.length > 0,
  }
}
