/**
 * Rating model configuration — the single documented surface for every tunable
 * coefficient in the OVR model (extracted from overall.ts in F4/D7). Change a
 * number here, and both the app pipeline and the offline `buildLeagueArtifacts`
 * baseline pass move together. Golden-file + monotonicity tests pin these.
 */

/** Blend when a player has BOTH recruiting + production signal. */
export const RATING_WEIGHTS = { recruiting: 0.45, production: 0.45, class: 0.1 } as const

/** Recruiting-only ("projection") blend — a recruit who has not produced yet. */
export const PROJECTION_WEIGHTS = { recruiting: 0.82, production: 0, class: 0.18 } as const

/** Production-only blend — a producer with no recruiting record (walk-on/JUCO/…). */
export const PRODUCTION_ONLY_WEIGHTS = { recruiting: 0, production: 0.82, class: 0.18 } as const

/**
 * "No playing time" penalty on recruiting-projection players, scaled by class: a
 * true FR who hasn't played keeps the full projection; an upperclassman who never
 * took a snap is a career backup and is pushed below proven starters.
 */
export const PROJECTION_CLASS_PENALTY: Record<string, number> = { FR: 0, SO: 4, JR: 9, SR: 14 }

/** Class/experience base sub-scores (0–100) + redshirt developmental bonus. */
export const CLASS_BASE: Record<string, number> = { FR: 68, SO: 74, JR: 79, SR: 83 }
export const CLASS_BASE_DEFAULT = 71
export const REDSHIRT_BONUS = 2
export const CLASS_MIN = 60
export const CLASS_MAX = 90

/** z-score → sub-score mapping: mean maps to 73, each ±1σ is ±9, clamped 50–99. */
export const SUBSCORE_MEAN = 73
export const SUBSCORE_PER_SIGMA = 9
export const SUBSCORE_MIN = 50
export const SUBSCORE_MAX = 99

/** Final blended OVR clamp. */
export const OVERALL_MIN = 40
export const OVERALL_MAX = 99

/** Minimum sample in a normalization context before we trust its mean/sd. */
export const MIN_GROUP_N = 3

/** Absolute fallbacks when a group is too small to normalize (no distribution). */
export const PRODUCTION_ABSOLUTE_FALLBACK = 72
/** Recruiting composite → absolute sub-score: 0.80→~70, 0.90→~81.5, 1.0→~93. */
export const recruitingAbsolute = (composite: number): number => 70 + (composite - 0.8) * 115

// ── League calibration (F4/D7) ──────────────────────────────────────────────

/** A normalization distribution (mean/sd over `n` samples). */
export interface Baseline {
  mean: number
  sd: number
  n: number
}

/**
 * Cross-team position-group distributions, built offline from all collected
 * masters by `scripts/buildLeagueArtifacts.ts`. When supplied to
 * `computeTeamRatings`, OVR is z-scored against the LEAGUE (honest cross-team
 * comparison) instead of the player's own team.
 */
export interface LeagueBaselines {
  /** schemaVersion + provenance for the committed artifact. */
  generatedAt: string | null
  teamsIncluded: number
  recByGroup: Record<string, Baseline>
  prodByGroup: Record<string, Baseline>
  recBySide: Record<string, Baseline>
  prodBySide: Record<string, Baseline>
}
