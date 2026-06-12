import type { ClassYear, Side } from './common.ts'

/**
 * Types describing the REAL output of buildPlayerPipeline (ported faithfully
 * from the recovered data/pipeline/buildPlayerPipeline.js). The pipeline keeps
 * a nested player shape — bio / recruiting / ratings / production /
 * dataCompleteness — so these interfaces mirror that exactly (not a flattened
 * guess). One PipelinePlayer per roster player, enriched by id→name→fuzzy join.
 */

export interface PlayerBio {
  name: string
  number: number | null
  side: Side
  position: string
  /** Canonicalized to FR/SO/JR/SR | null in the pipeline (raw '0'/unknown → null). */
  classYear: ClassYear
  height: string | null
  weight: number | null
  eligibilityRemaining: number | null
  isTransfer: boolean
}

export interface PlayerRecruiting {
  stars: number | null
  transferPortalStars: number | null
  /** 247 composite, 0–1 scale. */
  compositeRating: number | null
  /** compositeRating (or transferRating for transfers) × 100, one decimal. */
  compositePercent: number | null
  transferRating: number | null
  fromSchool: string | null
  isTransfer: boolean
  nationalRank: number | null
  positionRank: number | null
}

export interface PlayerRatings {
  /** Derived OVR = round(compositeRating × 100), unranked → 70. Label: derived. */
  overall: number | null
  archetype: string | null
  /** True — ratings have no independent provider; OVR is derived. */
  derived: boolean
  attributes: Record<string, unknown>
}

export interface PlayerProduction {
  season: number | null
  stats: Record<string, number>
}

export type MatchedBy = 'id' | 'name-exact' | 'name-fuzzy' | null

export interface PlayerDataCompleteness {
  hasRecruiting: boolean
  hasRatings: boolean
  hasProduction: boolean
  recruitingMatchedBy: MatchedBy
  ratingsMatchedBy: MatchedBy
  productionMatchedBy: MatchedBy
}

export interface PipelinePlayer {
  playerId: string
  bio: PlayerBio
  recruiting: PlayerRecruiting
  ratings: PlayerRatings
  production: PlayerProduction
  dataCompleteness: PlayerDataCompleteness
}

export interface StarterEntry {
  /** 'OFFENSE' | 'DEFENSE' — derived from the depth-chart section. */
  side: string
  slot: string
  playerId: string
}

export interface TeamMetrics {
  avgStarterComposite: number | null
  avgStarterOverall: number | null
  starterCount: number
}

export interface SideMetrics {
  avgStarterComposite: number | null
  starterCount: number
}

export interface PipelineMetrics {
  team: TeamMetrics
  offense: SideMetrics
  defense: SideMetrics
}

export interface DepthChartEntry {
  slot: string
  playerId: string
  player: PipelinePlayer | null
}

export interface DepthChartView {
  offense: DepthChartEntry[]
  defense: DepthChartEntry[]
}

export interface PipelineCoverage {
  rosterCount: number
  /** Players that exist only as OurLads depth-chart stubs (ourlads-stub-*). */
  stubCount: number
  recruitingMatched: number
  ratingsMatched: number
  productionMatched: number
  unmatchedRecruitingIds: string[]
  unmatchedRatingsIds: string[]
  unmatchedProductionIds: string[]
}

/** Full pipeline product consumed by mapPipelineToUI. */
export interface PlayerPipeline {
  players: PipelinePlayer[]
  starters: StarterEntry[]
  depthChart: DepthChartView
  metrics: PipelineMetrics
  coverage: PipelineCoverage
}
