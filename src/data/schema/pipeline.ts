import type { ClassYear, MatchMethod, Side } from './common.ts'
import type { RatingMethod, RatingConfidence, RatingInput } from '../rating/overall.ts'
import type { Usage, Ppa } from './advanced.ts'
import type { PerGameLog } from './production.ts'
import type { RecruitSourceTag } from './recruiting.ts'

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
  // ── C2: full-spine precedence provenance (drives the UI source label) ──
  /** Where the rating came from (precedence-tagged); null for legacy teams. */
  source: RecruitSourceTag | null
  /** School that recruited this player out of HS (national-index committedTo). */
  recruitedSchool: string | null
  /** Recruiting class year (national index / portal). */
  recruitYear: number | null
  /** Transfer ORIGIN school (CFBD portal). */
  origin: string | null
  /** Remaining eligibility string (CFBD portal). */
  eligibility: string | null
}

/** Per-player blended-rating sub-scores + weights (from computeTeamRatings). */
export interface PlayerRatingBreakdown {
  recruiting: number | null
  production: number | null
  class: number
  weights: { recruiting: number; production: number; class: number }
}

export interface PlayerRatings {
  /** Blended OVR (recruiting/production/class). null === NR (render honestly). */
  overall: number | null
  archetype: string | null
  /** True — ratings have no independent provider; OVR is computed (blended). */
  derived: boolean
  /** Which path produced this OVR ('blended' | 'recruiting-projection' | …). */
  method: RatingMethod
  /** OVR confidence from data completeness — 'low' renders with a hollow badge. */
  confidence: RatingConfidence
  /** Sub-score breakdown + weights for the modal. */
  breakdown: PlayerRatingBreakdown
  attributes: Record<string, unknown>
}

export interface PlayerProduction {
  season: number | null
  /** Distinct games the athlete appeared in (from production.games). */
  games: number | null
  /** Nested season counting-stat line (production.stats). */
  stats: Record<string, number>
  /** Optional per-game stat log (one entry per appearance); null when absent. */
  perGame: PerGameLog[] | null
}

/** Advanced (CFBD usage/PPA) summary carried per player when available. */
export interface PlayerAdvancedSummary {
  /** usage.overall (snap-share involvement, 0–1) — null when no advanced row. */
  usageOverall: number | null
  /** ppa.averagePPA.all (per-play efficiency) — null when no advanced row. */
  ppaAll: number | null
  /** Full usage splits (overall/pass/rush + down situations); null when no row. */
  usage: Usage | null
  /** Full PPA (averagePPA + totalPPA, each with all/pass/rush/down splits); null when no row. */
  ppa: Ppa | null
}

export interface PlayerHometown {
  city: string | null
  state: string | null
}

/**
 * Golden-master overlay fields (pilot-deepening round). All optional — absent for
 * the 31 legacy teams that ship the old roster.json. Populated when a team has a
 * reconciled player-master.json.
 */
export interface PlayerGolden {
  /** ESPN headshot URL. */
  headshotUrl: string | null
  /** High school (official-site overlay only). */
  highSchool: string | null
  /** Previous school (official-site overlay / transfer). */
  previousSchool: string | null
  /** On the roster, no recruiting record (walk-on signal). */
  isWalkOn: boolean
  /** No 2025 CFBD data (transfer-in / true freshman new in 2026). */
  newIn2026: boolean
  /** No stars from any recruiting source. */
  unrated: boolean
  /** Fields where two present sources disagreed (value + alt kept in master). */
  conflictFields: string[]
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
  advanced: PlayerAdvancedSummary
  /** Hometown (city/state) from roster or recruiting; null fields when unknown. */
  hometown: PlayerHometown
  /** True when this player exists only as an OurLads depth-chart stub. */
  isStub: boolean
  /** How recruiting was matched to this player (cfbd-id/247-id/name-fuzzy/none). */
  recruitMatchMethod: MatchMethod | null
  /** Golden-master overlay (headshot/HS/prev-school + flags); null for legacy teams. */
  golden: PlayerGolden | null
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
  /** Players with games > 0 (actual on-field contributors). */
  productionWithGames: number
  /** Players carrying advanced (usage/PPA) rows. */
  advancedMatched: number
  /** Players with a real (non-NR) computed OVR. */
  rated: number
  unmatchedRecruitingIds: string[]
  unmatchedRatingsIds: string[]
  unmatchedProductionIds: string[]
}

/** A zeroed coverage block (for empty/placeholder UI datasets). */
export const EMPTY_COVERAGE: PipelineCoverage = {
  rosterCount: 0,
  stubCount: 0,
  recruitingMatched: 0,
  ratingsMatched: 0,
  productionMatched: 0,
  productionWithGames: 0,
  advancedMatched: 0,
  rated: 0,
  unmatchedRecruitingIds: [],
  unmatchedRatingsIds: [],
  unmatchedProductionIds: [],
}

/**
 * Team-level returning-production summary (from context.json's
 * returningProduction), threaded to the UI for a one-line banner. null for the
 * non-pilot teams that ship no context source.
 */
export interface ReturningProductionSummary {
  /** Share of last season's total PPA that returns (0–1). */
  percentPPA: number | null
  percentPassingPPA: number | null
  percentReceivingPPA: number | null
  percentRushingPPA: number | null
  /** Share of returning usage (snaps) overall + by phase (0–1). */
  usage: number | null
  passingUsage: number | null
  receivingUsage: number | null
  rushingUsage: number | null
}

/** Data vintage (F5 as-of framing) — from the golden master's provenance. */
export interface DataVintage {
  collectedAt: string | null
  rosterSeason: number | null
  productionSeason: number | null
}

/** Full pipeline product consumed by mapPipelineToUI. */
export interface PlayerPipeline {
  players: PipelinePlayer[]
  starters: StarterEntry[]
  depthChart: DepthChartView
  metrics: PipelineMetrics
  coverage: PipelineCoverage
  /** Team returning-production strip; null when the team ships no context. */
  returningProduction: ReturningProductionSummary | null
  /** Data vintage for the as-of header + aging chip (F5); null if no master. */
  vintage: DataVintage | null
  /** Rating inputs index-aligned with `players` (offline baseline builder only). */
  ratingInputs?: RatingInput[]
}
