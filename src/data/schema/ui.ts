/**
 * Types describing the REAL output of mapPipelineToUI (ported faithfully from
 * the recovered data/mapPipelineToUI.js). Components consume this flat UIPlayer
 * shape; offensive/defensiveStarters are formation maps (slot → ordered players,
 * starter first), and allPlayers is every rostered player.
 */

import type { MatchMethod } from './common.ts'
import type { PipelineCoverage, ReturningProductionSummary } from './pipeline.ts'
import type { RatingMethod } from '../rating/overall.ts'
import type { Usage, Ppa } from './advanced.ts'
import type { PerGameLog } from './production.ts'
import type { RecruitSourceTag } from './recruiting.ts'

/** A player's UI side. allPlayers may include 'ST' (special teams / neither). */
export type UISide = 'OFF' | 'DEF' | 'ST'

/** Rating sub-score breakdown surfaced in the modal. */
export interface UIRatingBreakdown {
  recruiting: number | null
  production: number | null
  class: number
  weights: { recruiting: number; production: number; class: number }
}

/** Per-player data-provenance flags for the completeness badges. */
export interface UIDataCompleteness {
  hasRecruiting: boolean
  hasProduction: boolean
  matchedBy: MatchMethod | null
}

export interface UIPlayer {
  /** Sequential UI id (stable within a single map call). */
  id: number
  /** Stable canonical player id (CFBD-<athleteId> / 247-… / ourlads-stub-…) — deep-link key. */
  playerId: string
  name: string
  number: number | null
  /** Display position (slot-overridden for formation players). */
  pos: string
  /** Class year string as carried from the pipeline (e.g. 'SR'); may be null. */
  year: string | null
  side: UISide
  stars: number
  transferStars: number | undefined
  isTransfer: boolean
  fromSchool: string | null
  /** Composite percent (0–100), one decimal. */
  composite: number
  compositeRating: number | null
  transferRating: number | null
  nationalRank: number | null
  positionRank: number | null
  ht: string | null
  wt: number | null
  /**
   * Blended OVR as a number for sorting/math. **0 means NR** (unrated) — the
   * existing `ovr > 0` convention across the comparison stack treats 0 as
   * "no rating", and `isRated` makes the distinction explicit for rendering.
   */
  ovr: number
  /** False when the player is NR (overall === null upstream). Render "NR"/"—". */
  isRated: boolean
  /** Rank by OVR within this team's position group (1 = best); null if unrated (U7). */
  posRank: number | null
  /** Number of players in this position group on the team (U7). */
  posGroupSize: number
  /** Which model path produced the OVR ('blended' | 'recruiting-projection' | …). */
  ratingMethod: RatingMethod
  /** Sub-score breakdown for the modal. */
  ratingBreakdown: UIRatingBreakdown
  eligibilityRemaining: number | null
  /** Abbreviated season stat line (PAS/YDS/TD/REC/TKL/…). */
  stats: Record<string, number>
  /** Distinct games played (from production.games) — drives per-game (/G) stats. */
  games: number | null
  /** Snap-share involvement (usage.overall, 0–1) — null when no advanced row. */
  usageOverall: number | null
  /** Per-play efficiency (ppa.averagePPA.all) — null when no advanced row. */
  ppaAll: number | null
  /** Full usage splits (overall/pass/rush + down situations); null when no advanced row. */
  usage: Usage | null
  /** Full PPA (averagePPA + totalPPA, each with all/pass/rush/down splits); null when no advanced row. */
  ppa: Ppa | null
  /** Per-game stat log for the modal game-by-game table; null when absent. */
  perGame: PerGameLog[] | null
  /** Hometown for the modal; null when neither city nor state is known. */
  hometown: { city: string | null; state: string | null } | null
  /** How recruiting was matched (name-fuzzy is flagged in the UI). */
  recruitMatchMethod: MatchMethod | null
  // ── C2: recruiting-source provenance (drives the modal source label) ──
  /** Where the rating came from (precedence-tagged); null for legacy teams. */
  recruitSource: RecruitSourceTag | null
  /** School that recruited this player out of HS (national-index committedTo). */
  recruitedSchool: string | null
  /** Recruiting class year (national index / portal). */
  recruitYear: number | null
  /** Transfer ORIGIN school (CFBD portal). */
  transferOrigin: string | null
  /** Remaining eligibility string (CFBD portal). */
  transferEligibility: string | null
  /** Depth-chart-only stub player (no roster/recruiting/production data). */
  isStub: boolean
  // ── Golden-master overlay (pilot-deepening round); null/false for legacy teams ──
  /** ESPN headshot URL — render a player photo when present. */
  headshotUrl: string | null
  /** High school (official-site overlay). */
  highSchool: string | null
  /** Previous school (official-site overlay / transfer). */
  previousSchool: string | null
  /** On the roster, no recruiting record (walk-on badge). */
  isWalkOn: boolean
  /** No 2025 CFBD data — new in 2026 (transfer/freshman badge). */
  newIn2026: boolean
  /** No stars from any recruiting source (unrated badge). */
  unrated: boolean
  /** Fields where sources disagreed (value + alt kept in master) — conflict badge. */
  conflictFields: string[]
  /** Provenance flags for the completeness badges. */
  dataCompleteness: UIDataCompleteness
}

/** Formation slot → ordered players (starter first, then backups). */
export type Formation = Record<string, UIPlayer[]>

/** Output of mapPipelineToUI. */
export interface UIDataset {
  offensiveStarters: Formation
  defensiveStarters: Formation
  allPlayers: UIPlayer[]
  /** Team-level data coverage (threaded from pipeline.coverage) for the banner. */
  coverage: PipelineCoverage
  /** Team returning-production strip; null when the team ships no context. */
  returningProduction: ReturningProductionSummary | null
}
