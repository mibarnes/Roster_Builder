/**
 * The join engine. Ported faithfully from the recovered
 * data/pipeline/buildPlayerPipeline.js (260 ln). Resolves each roster player to
 * recruiting / ratings / production records by id → name-exact → fuzzy(≥0.82),
 * derives composite percent + OVR, computes starter metrics + coverage/stubCount.
 *
 * M4 additions vs the original JS:
 *  - classYear is canonicalized to FR/SO/JR/SR | null ('0'/unknown → null).
 *  - ratings.overall is DERIVED here (round(compositeRating × 100), unranked → 70)
 *    since real CFBD captures ship no ratings source; ratings.derived = true.
 */
import type { ClassYear, MatchMethod } from '../schema/common.ts'
import type { DatasetBySource } from '../schema/dataset.ts'
import type { PlayerAdvanced } from '../schema/advanced.ts'
import type {
  DepthChartEntry,
  MatchedBy,
  PipelineMetrics,
  PipelinePlayer,
  PlayerPipeline,
  SideMetrics,
  StarterEntry,
  TeamMetrics,
} from '../schema/pipeline.ts'
import { canonicalizePositionGroup } from '../normalize/positionMapping.ts'
import { computeTeamRatings, type RatingInput } from '../rating/overall.ts'

interface IdItem {
  playerId?: string
  name?: string
  [key: string]: unknown
}

const toMap = <T extends IdItem>(items: T[] = []): Map<string, T> =>
  new Map(items.filter((item) => item?.playerId).map((item) => [item.playerId as string, item]))

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

const normalizeName = (value = ''): string =>
  String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,'’`\-]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !NAME_SUFFIXES.has(token))
    .join(' ')

const levenshtein = (a: string, b: string): number => {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i += 1) dp[i]![0] = i
  for (let j = 0; j <= n; j += 1) dp[0]![j] = j
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }
  return dp[m]![n]!
}

const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

interface SourceLookup<T extends IdItem> {
  byId: Map<string, T>
  byName: Map<string, T>
}

const buildSourceLookup = <T extends IdItem>(items: T[] = []): SourceLookup<T> => {
  const byId = toMap(items)
  const byName = new Map<string, T>()

  for (const item of items) {
    if (!item?.name) continue
    const key = normalizeName(item.name)
    if (!key || byName.has(key)) continue
    byName.set(key, item)
  }

  return { byId, byName }
}

interface RosterLike {
  playerId: string
  name: string
}

const resolveSourceRecord = <T extends IdItem>(
  rosterPlayer: RosterLike,
  lookup: SourceLookup<T>,
): { record: T | null; matchedBy: MatchedBy } => {
  const byId = lookup?.byId ?? new Map<string, T>()
  const byName = lookup?.byName ?? new Map<string, T>()

  const byIdMatch = byId.get(rosterPlayer.playerId)
  if (byIdMatch) return { record: byIdMatch, matchedBy: 'id' }

  const rosterName = normalizeName(rosterPlayer.name)
  if (!rosterName || !byName.size) return { record: null, matchedBy: null }

  const exact = byName.get(rosterName)
  if (exact) return { record: exact, matchedBy: 'name-exact' }

  let best: { candidate: T; score: number } | null = null
  const rosterLastToken = rosterName.split(' ').slice(-1)[0]

  for (const [candidateName, candidate] of byName.entries()) {
    if (candidateName.split(' ').slice(-1)[0] !== rosterLastToken) continue
    const score = similarity(rosterName, candidateName)
    if (score < 0.82) continue
    if (!best || score > best.score) best = { candidate, score }
  }

  if (best) return { record: best.candidate, matchedBy: 'name-fuzzy' }
  return { record: null, matchedBy: null }
}

const toPercent = (compositeRating: unknown): number | null =>
  typeof compositeRating === 'number' ? Number((compositeRating * 100).toFixed(1)) : null

const average = (values: number[]): number | null => {
  if (!values.length) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
}

/** M4: canonicalize raw class year (string|null incl. '0') → FR/SO/JR/SR | null. */
const CLASS_YEARS = new Set(['FR', 'SO', 'JR', 'SR'])
const canonicalizeClassYear = (raw: string | null | undefined): ClassYear => {
  if (raw == null) return null
  const token = String(raw).trim().toUpperCase()
  return CLASS_YEARS.has(token) ? (token as ClassYear) : null
}

interface StarterSlot {
  side: string
  slot: string
  playerId: string
}

const collectStarterIds = (
  depthChart: { offense?: Record<string, string>; defense?: Record<string, string> } = {},
): StarterSlot[] => {
  const starterSlots: StarterSlot[] = []
  const sideEntries: Array<[string, Record<string, string> | undefined]> = [
    ['offense', depthChart?.offense],
    ['defense', depthChart?.defense],
  ]

  for (const [side, slots] of sideEntries) {
    for (const [slot, playerId] of Object.entries(slots ?? {})) {
      if (!playerId) continue
      starterSlots.push({ side: side.toUpperCase(), slot, playerId })
    }
  }

  return starterSlots
}

const buildStarterMetrics = (
  starters: StarterEntry[],
  playerMap: Map<string, PipelinePlayer>,
): PipelineMetrics => {
  const teamComposite: number[] = []
  const offenseComposite: number[] = []
  const defenseComposite: number[] = []
  const teamOverall: number[] = []

  for (const starter of starters) {
    const player = playerMap.get(starter.playerId)
    if (!player) continue

    if (typeof player.recruiting.compositePercent === 'number') {
      teamComposite.push(player.recruiting.compositePercent)
      if (starter.side === 'OFFENSE') offenseComposite.push(player.recruiting.compositePercent)
      if (starter.side === 'DEFENSE') defenseComposite.push(player.recruiting.compositePercent)
    }

    if (typeof player.ratings.overall === 'number') {
      teamOverall.push(player.ratings.overall)
    }
  }

  const team: TeamMetrics = {
    avgStarterComposite: average(teamComposite),
    avgStarterOverall: average(teamOverall),
    starterCount: starters.length,
  }
  const offense: SideMetrics = {
    avgStarterComposite: average(offenseComposite),
    starterCount: starters.filter((item) => item.side === 'OFFENSE').length,
  }
  const defense: SideMetrics = {
    avgStarterComposite: average(defenseComposite),
    starterCount: starters.filter((item) => item.side === 'DEFENSE').length,
  }

  return { team, offense, defense }
}

const buildDepthChartView = (
  depthChart: { offense?: Record<string, string>; defense?: Record<string, string> } | undefined,
  playerMap: Map<string, PipelinePlayer>,
): { offense: DepthChartEntry[]; defense: DepthChartEntry[] } => ({
  offense: Object.entries(depthChart?.offense ?? {}).map(([slot, playerId]) => ({
    slot,
    playerId,
    player: playerMap.get(playerId) ?? null,
  })),
  defense: Object.entries(depthChart?.defense ?? {}).map(([slot, playerId]) => ({
    slot,
    playerId,
    player: playerMap.get(playerId) ?? null,
  })),
})

export const buildPlayerPipeline = (datasetBySource: DatasetBySource): PlayerPipeline => {
  const rosterPlayers = datasetBySource?.roster?.players ?? []
  const recruitingLookup = buildSourceLookup(
    datasetBySource?.recruiting?.playerRecruitProfiles as IdItem[] | undefined,
  )
  const ratingsLookup = buildSourceLookup(
    datasetBySource?.ratings?.playerRatings as IdItem[] | undefined,
  )
  const productionLookup = buildSourceLookup(
    datasetBySource?.production?.playerProduction as IdItem[] | undefined,
  )

  const recruitingMap = recruitingLookup.byId
  const ratingsMap = ratingsLookup.byId
  const productionMap = productionLookup.byId

  // Advanced (usage/PPA) is id-keyed by CFBD athlete id. Absent for partial teams.
  const advancedById = new Map<string, PlayerAdvanced>(
    (datasetBySource?.advanced?.playerAdvanced ?? []).map((a) => [a.playerId, a]),
  )

  // ── Phase 1: resolve each roster player's source records into a draft shape. ──
  interface Draft {
    rosterPlayer: (typeof rosterPlayers)[number]
    recruiting: Record<string, unknown>
    ratings: Record<string, unknown>
    advanced: PlayerAdvanced | undefined
    compositeRating: number | null
    recruitingIsTransfer: boolean
    transferRating: number | null
    classYear: ClassYear
    positionGroup: string
    stats: Record<string, number>
    games: number | null
    usageOverall: number | null
    ppaAll: number | null
    isStub: boolean
    recruitMatchMethod: MatchMethod | null
    recruitingResolved: ReturnType<typeof resolveSourceRecord>
    ratingsResolved: ReturnType<typeof resolveSourceRecord>
    productionResolved: ReturnType<typeof resolveSourceRecord>
  }

  const drafts: Draft[] = rosterPlayers.map((rosterPlayer) => {
    const recruitingResolved = resolveSourceRecord(rosterPlayer, recruitingLookup)
    const ratingsResolved = resolveSourceRecord(rosterPlayer, ratingsLookup)
    const productionResolved = resolveSourceRecord(rosterPlayer, productionLookup)

    const recruiting = (recruitingResolved.record ?? {}) as Record<string, unknown>
    const ratings = (ratingsResolved.record ?? {}) as Record<string, unknown>
    const production = (productionResolved.record ?? {}) as Record<string, unknown>
    const advanced = advancedById.get(rosterPlayer.playerId)

    const compositeRating = (recruiting.compositeRating as number | null | undefined) ?? null
    const recruitingIsTransfer = Boolean(recruiting.isTransfer)
    const transferRating = (recruiting.transferRating as number | null | undefined) ?? null

    // Production stats are NESTED under production.stats now; games is a sibling.
    const nestedStats = (production.stats as Record<string, number> | undefined) ?? null
    const stats: Record<string, number> = nestedStats
      ? Object.fromEntries(
          Object.entries(nestedStats).filter(([, value]) => typeof value === 'number'),
        )
      : {}
    const games =
      typeof production.games === 'number' ? (production.games as number) : null

    const usageOverall = advanced?.usage?.overall ?? null
    const ppaAll = advanced?.ppa?.averagePPA?.all ?? null

    return {
      rosterPlayer,
      recruiting,
      ratings,
      advanced,
      compositeRating,
      recruitingIsTransfer,
      transferRating,
      classYear: canonicalizeClassYear(rosterPlayer.classYear ?? null),
      positionGroup: canonicalizePositionGroup(rosterPlayer.position),
      stats,
      games,
      usageOverall,
      ppaAll,
      isStub: rosterPlayer.playerId?.startsWith('ourlads-stub-') ?? false,
      recruitMatchMethod:
        (recruiting.matchMethod as MatchMethod | null | undefined) ??
        (recruitingResolved.record ? 'name-fuzzy' : null),
      recruitingResolved,
      ratingsResolved,
      productionResolved,
    }
  })

  // ── Phase 2: compute the blended OVR for the WHOLE team in one pass. ──
  const ratingInputs: RatingInput[] = drafts.map((d) => {
    const hasProduction =
      (d.games ?? 0) > 0 || d.ppaAll != null || d.usageOverall != null || Object.keys(d.stats).length > 0
    return {
      positionGroup: d.positionGroup,
      sideBucket: d.rosterPlayer.side === 'OFF' ? 'OFF' : d.rosterPlayer.side === 'DEF' ? 'DEF' : 'ST',
      compositeRating: d.compositeRating,
      classYear: d.classYear,
      isRedshirt: Boolean(d.rosterPlayer.isRedshirt),
      production: hasProduction
        ? { games: d.games, ppaAll: d.ppaAll, usageOverall: d.usageOverall, stats: Object.keys(d.stats).length ? d.stats : null }
        : null,
      isStub: d.isStub,
    }
  })
  const ratingResults = computeTeamRatings(ratingInputs)

  // ── Phase 3: assemble the final PipelinePlayer list. ──
  const players: PipelinePlayer[] = drafts.map((d, i) => {
    const { recruiting, ratings, recruitingResolved, ratingsResolved, productionResolved } = d
    const rating = ratingResults[i]!

    const attributes = Object.fromEntries(
      Object.entries(ratings).filter(
        ([key]) => !['playerId', 'overall', 'archetype'].includes(key),
      ),
    )

    const homeCity =
      (d.rosterPlayer.homeCity as string | null | undefined) ??
      (recruiting.homeCity as string | null | undefined) ??
      null
    const homeState =
      (d.rosterPlayer.homeState as string | null | undefined) ??
      (recruiting.homeState as string | null | undefined) ??
      null

    return {
      playerId: d.rosterPlayer.playerId,
      bio: {
        name: d.rosterPlayer.name,
        number: d.rosterPlayer.number ?? null,
        side: d.rosterPlayer.side,
        position: d.rosterPlayer.position,
        classYear: d.classYear,
        height: d.rosterPlayer.height ?? null,
        weight: d.rosterPlayer.weight ?? null,
        eligibilityRemaining: d.rosterPlayer.eligibilityRemaining ?? null,
        // Recruiting source is authoritative for isTransfer (247 portal match
        // beats the CFBD flag).
        isTransfer: Boolean(recruiting.isTransfer || d.rosterPlayer.isTransfer),
      },
      recruiting: {
        stars: (recruiting.stars as number | null | undefined) ?? null,
        transferPortalStars:
          (recruiting.transferPortalStars as number | null | undefined) ?? null,
        compositeRating: d.compositeRating,
        compositePercent: toPercent(
          d.recruitingIsTransfer && d.transferRating ? d.transferRating : d.compositeRating,
        ),
        transferRating: d.transferRating,
        fromSchool: (recruiting.fromSchool as string | null | undefined) ?? null,
        isTransfer: d.recruitingIsTransfer,
        nationalRank: (recruiting.nationalRank as number | null | undefined) ?? null,
        positionRank: (recruiting.positionRank as number | null | undefined) ?? null,
      },
      ratings: {
        overall: rating.overall,
        archetype: (ratings.archetype as string | null | undefined) ?? null,
        // OVR has no independent provider — it's computed (blended) here.
        derived: true,
        method: rating.method,
        breakdown: { ...rating.components, weights: rating.weights },
        attributes,
      },
      production: {
        season: datasetBySource?.production?.season ?? null,
        games: d.games,
        stats: d.stats,
      },
      advanced: {
        usageOverall: d.usageOverall,
        ppaAll: d.ppaAll,
      },
      hometown: { city: homeCity, state: homeState },
      isStub: d.isStub,
      recruitMatchMethod: d.recruitMatchMethod,
      dataCompleteness: {
        hasRecruiting: Boolean(recruitingResolved.record),
        hasRatings: Boolean(ratingsResolved.record),
        hasProduction: Boolean(productionResolved.record),
        recruitingMatchedBy: recruitingResolved.matchedBy,
        ratingsMatchedBy: ratingsResolved.matchedBy,
        productionMatchedBy: productionResolved.matchedBy,
      },
    }
  })

  const playerMap = new Map(players.map((player) => [player.playerId, player]))
  const validSides = new Set(['OFFENSE', 'DEFENSE'])
  const starters: StarterEntry[] = collectStarterIds(datasetBySource?.roster?.depthChart).map(
    (entry) => {
      if (!validSides.has(entry.side)) {
        console.warn(`Unknown depth chart side: "${entry.side}" for slot ${entry.slot}`)
      }
      return { ...entry }
    },
  )

  const stubCount = rosterPlayers.filter((p) => p.playerId?.startsWith('ourlads-stub-')).length
  const coverage = {
    rosterCount: rosterPlayers.length,
    stubCount,
    recruitingMatched: players.filter((p) => p.dataCompleteness.hasRecruiting).length,
    ratingsMatched: players.filter((p) => p.dataCompleteness.hasRatings).length,
    productionMatched: players.filter((p) => p.dataCompleteness.hasProduction).length,
    productionWithGames: players.filter((p) => (p.production.games ?? 0) > 0).length,
    advancedMatched: players.filter((p) => p.advanced.usageOverall != null || p.advanced.ppaAll != null).length,
    rated: players.filter((p) => p.ratings.overall != null).length,
    unmatchedRecruitingIds: [...recruitingMap.keys()].filter((id) => !playerMap.has(id)),
    unmatchedRatingsIds: [...ratingsMap.keys()].filter((id) => !playerMap.has(id)),
    unmatchedProductionIds: [...productionMap.keys()].filter((id) => !playerMap.has(id)),
  }

  return {
    players,
    starters,
    metrics: buildStarterMetrics(starters, playerMap),
    depthChart: buildDepthChartView(datasetBySource?.roster?.depthChart, playerMap),
    coverage,
  }
}
