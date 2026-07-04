/**
 * Blended player OVR model (Round 2, E3). Replaces the flat-70 placeholder.
 *
 * OVR = 0.45·Recruiting + 0.45·Production + 0.10·Class, each on a 0–100 scale,
 * **normalized within position group** (so an OL and a WR are rated against their
 * own peers, not raw counting stats). Players with neither recruiting nor
 * production signal are "NR" (overall = null) — never a fake number.
 *
 *   - both signals  → 'blended'                (0.45 / 0.45 / 0.10)
 *   - recruiting only → 'recruiting-projection' (0.82 / — / 0.18)
 *   - production only → 'production-only'        (— / 0.82 / 0.18)
 *   - neither        → 'nr'                      (overall = null)
 *
 * All coefficients live in ratingConfig.ts (single documented source, tunable).
 * When a `leagueBaselines` argument is supplied, the within-group z-scores are
 * taken against the LEAGUE distribution (honest cross-team comparison) instead of
 * the player's own team — see F4/D7.
 */

import {
  CLASS_BASE,
  CLASS_BASE_DEFAULT,
  CLASS_MAX,
  CLASS_MIN,
  MIN_GROUP_N,
  OVERALL_MAX,
  OVERALL_MIN,
  PRODUCTION_ABSOLUTE_FALLBACK,
  PRODUCTION_ONLY_WEIGHTS,
  PROJECTION_CLASS_PENALTY,
  PROJECTION_WEIGHTS,
  RATING_WEIGHTS,
  recruitingAbsolute,
  REDSHIRT_BONUS,
  SUBSCORE_MAX,
  SUBSCORE_MEAN,
  SUBSCORE_MIN,
  SUBSCORE_PER_SIGMA,
  type Baseline,
  type LeagueBaselines,
} from './ratingConfig.ts'

export { RATING_WEIGHTS, PROJECTION_CLASS_PENALTY } from './ratingConfig.ts'
export type { LeagueBaselines, Baseline } from './ratingConfig.ts'

export type RatingMethod = 'blended' | 'recruiting-projection' | 'production-only' | 'nr'

/** OVR confidence from data completeness — the UI renders 'low' with a hollow badge. */
export type RatingConfidence = 'high' | 'medium' | 'low'

export interface RatingProductionInput {
  games: number | null
  /** averagePPA.all (efficiency), when available (~contributors only). */
  ppaAll: number | null
  /** usage.overall (involvement), when available. */
  usageOverall: number | null
  /** Raw per-position counting-stat line (production.stats). */
  stats: Record<string, number> | null
}

export interface RatingInput {
  /** Canonical position group (QB/RB/WR/TE/OL/T/G/C/DE/DT/LB/.../CB/S/NB). */
  positionGroup: string
  /** Broad side bucket for group fallback when a group is tiny. */
  sideBucket: 'OFF' | 'DEF' | 'ST'
  /** 247/CFBD composite, 0–1. */
  compositeRating: number | null
  classYear: 'FR' | 'SO' | 'JR' | 'SR' | null
  isRedshirt: boolean
  production: RatingProductionInput | null
  /** Stub players (depth-chart-only, no data) are always NR. */
  isStub: boolean
}

export interface RatingResult {
  overall: number | null
  method: RatingMethod
  confidence: RatingConfidence
  components: { recruiting: number | null; production: number | null; class: number }
  weights: { recruiting: number; production: number; class: number }
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/** Class/experience sub-score (0–100 scale). Redshirt adds a developmental year. */
const classScore = (classYear: RatingInput['classYear'], isRedshirt: boolean): number => {
  const base = CLASS_BASE[classYear ?? 'FR'] ?? CLASS_BASE_DEFAULT
  return clamp(base + (isRedshirt ? REDSHIRT_BONUS : 0), CLASS_MIN, CLASS_MAX)
}

/**
 * OVR confidence from signal completeness: real production games + a recruiting
 * record → high; one solid signal → medium; projection/thin → low.
 */
const ratingConfidence = (
  method: RatingMethod,
  hasRecruiting: boolean,
  games: number | null,
): RatingConfidence => {
  if (method === 'nr') return 'low'
  const playedEnough = (games ?? 0) >= 4
  if (method === 'blended' && playedEnough && hasRecruiting) return 'high'
  if (method === 'production-only' && playedEnough) return 'high'
  if (method === 'blended' || method === 'production-only') return 'medium'
  return 'low' // recruiting-projection (no production yet)
}

/**
 * Per-position counting-stat → a single raw "production value". Position-aware so
 * the number is comparable within a group; cross-group comparability is handled
 * by the later within-group normalization.
 */
export const statValue = (group: string, s: Record<string, number>): number => {
  const v = (k: string): number => s[k] ?? 0
  switch (group) {
    case 'QB':
      return v('passYds') * 0.04 + v('passTD') * 4 - v('passINT') * 2 + v('rushYds') * 0.05 + v('rushTD') * 4
    case 'RB':
      return v('rushYds') * 0.1 + v('rushTD') * 6 + v('recYds') * 0.1 + v('rec') * 0.5
    case 'WR':
    case 'TE':
      return v('recYds') * 0.1 + v('recTD') * 6 + v('rec') * 0.5 + v('rushYds') * 0.1
    case 'DE':
    case 'DT':
    case 'LB':
    case 'MLB':
    case 'WLB':
    case 'SLB':
      return v('tackles') * 1 + v('tfl') * 2.5 + v('sacks') * 4 + v('passDef') * 1 + v('defTD') * 6
    case 'CB':
    case 'NB':
    case 'FS':
    case 'SS':
    case 'S':
      return v('tackles') * 1 + v('passDef') * 2.5 + v('tfl') * 1 + v('defTD') * 6
    default:
      // OL and anyone without a counting line: production credit comes from games only.
      return 0
  }
}

/**
 * A single production "intensity" per player, blending availability + efficiency
 * + involvement + counting output. Games anchors it so a 12-game starter with no
 * box-score (e.g. OL) still earns production credit.
 */
export const productionRaw = (group: string, p: RatingProductionInput): number | null => {
  const hasAny = (p.games ?? 0) > 0 || p.ppaAll != null || p.usageOverall != null || p.stats != null
  if (!hasAny) return null
  const games = p.games ?? 0
  const gameFactor = clamp(games / 12, 0, 1) // availability, 0–1
  const stat = p.stats ? statValue(group, p.stats) : 0
  const ppa = p.ppaAll ?? 0 // efficiency, roughly [-1, 1.5]
  const usage = p.usageOverall ?? 0 // involvement, 0–1
  // Weighted intensity. Counting stats dominate where present; games/usage/ppa
  // give credit to starters without a box score and reward efficiency/involvement.
  return gameFactor * 8 + stat + ppa * 12 + usage * 25
}

interface NormCtx {
  mean: number
  sd: number
  n: number
}

const normContext = (values: number[]): NormCtx => {
  const n = values.length
  if (n === 0) return { mean: 0, sd: 0, n }
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return { mean, sd: Math.sqrt(variance), n }
}

/** z-score → 0–100 OVR sub-score (mean→SUBSCORE_MEAN, ±1σ→±PER_SIGMA), small-sample-aware. */
const toSubScore = (value: number, ctx: NormCtx, absoluteFallback: number): number => {
  if (ctx.n < MIN_GROUP_N || ctx.sd === 0) return clamp(Math.round(absoluteFallback), SUBSCORE_MIN, SUBSCORE_MAX)
  const z = (value - ctx.mean) / ctx.sd
  return clamp(Math.round(SUBSCORE_MEAN + z * SUBSCORE_PER_SIGMA), SUBSCORE_MIN, SUBSCORE_MAX)
}

/** A committed league Baseline is structurally a NormCtx — adapt directly. */
const baselineCtx = (b: Baseline | undefined): NormCtx | null =>
  b && b.n >= MIN_GROUP_N ? { mean: b.mean, sd: b.sd, n: b.n } : null

/**
 * Compute OVR for every player on a team.
 *
 * Without `leagueBaselines`, each signal is z-scored WITHIN the team's position
 * group (side-bucket fallback for tiny groups) — team-relative. With
 * `leagueBaselines` (built offline across all collected teams), the z-score is
 * taken against the LEAGUE distribution for that group instead, making OVR honest
 * ACROSS teams (F4/D7). Team distributions remain the fallback when a group is
 * absent from the baselines.
 */
export function computeTeamRatings(
  players: RatingInput[],
  leagueBaselines?: LeagueBaselines,
): RatingResult[] {
  // Build per-group and per-side distributions for each signal.
  const recByGroup = new Map<string, number[]>()
  const recBySide = new Map<string, number[]>()
  const prodByGroup = new Map<string, number[]>()
  const prodBySide = new Map<string, number[]>()
  const push = (m: Map<string, number[]>, k: string, v: number) => {
    const arr = m.get(k) ?? []
    arr.push(v)
    m.set(k, arr)
  }

  const prodRawCache: Array<number | null> = []
  players.forEach((p) => {
    if (!p.isStub && typeof p.compositeRating === 'number') {
      push(recByGroup, p.positionGroup, p.compositeRating)
      push(recBySide, p.sideBucket, p.compositeRating)
    }
    const praw = p.isStub || !p.production ? null : productionRaw(p.positionGroup, p.production)
    prodRawCache.push(praw)
    if (praw != null) {
      push(prodByGroup, p.positionGroup, praw)
      push(prodBySide, p.sideBucket, praw)
    }
  })

  return players.map((p, i) => {
    if (p.isStub) {
      return { overall: null, method: 'nr', confidence: 'low', components: { recruiting: null, production: null, class: classScore(p.classYear, p.isRedshirt) }, weights: { ...RATING_WEIGHTS } }
    }

    const cls = classScore(p.classYear, p.isRedshirt)
    const hasRecruiting = typeof p.compositeRating === 'number'
    const games = p.production?.games ?? null

    // Recruiting sub-score. League baseline (cross-team) when provided, else the
    // team group-normalized distribution (side fallback), else absolute fallback.
    let recruiting: number | null = null
    if (typeof p.compositeRating === 'number') {
      const grp = recByGroup.get(p.positionGroup) ?? []
      const teamCtx = grp.length >= MIN_GROUP_N ? normContext(grp) : normContext(recBySide.get(p.sideBucket) ?? grp)
      const ctx = leagueBaselines
        ? baselineCtx(leagueBaselines.recByGroup[p.positionGroup]) ?? baselineCtx(leagueBaselines.recBySide[p.sideBucket]) ?? teamCtx
        : teamCtx
      recruiting = toSubScore(p.compositeRating, ctx, recruitingAbsolute(p.compositeRating))
    }

    // Production sub-score.
    let production: number | null = null
    const praw = prodRawCache[i] ?? null
    if (praw != null) {
      const grp = prodByGroup.get(p.positionGroup) ?? []
      const teamCtx = grp.length >= MIN_GROUP_N ? normContext(grp) : normContext(prodBySide.get(p.sideBucket) ?? grp)
      const ctx = leagueBaselines
        ? baselineCtx(leagueBaselines.prodByGroup[p.positionGroup]) ?? baselineCtx(leagueBaselines.prodBySide[p.sideBucket]) ?? teamCtx
        : teamCtx
      production = toSubScore(praw, ctx, PRODUCTION_ABSOLUTE_FALLBACK)
    }

    if (recruiting != null && production != null) {
      const W = RATING_WEIGHTS
      const overall = Math.round(W.recruiting * recruiting + W.production * production + W.class * cls)
      return { overall: clamp(overall, OVERALL_MIN, OVERALL_MAX), method: 'blended', confidence: ratingConfidence('blended', hasRecruiting, games), components: { recruiting, production, class: cls }, weights: { ...W } }
    }
    if (recruiting != null) {
      // No production at all → a "projection". A true FR who hasn't had a chance
      // legitimately projects on recruiting alone; but an upperclassman who never
      // took a snap is a career backup, not a star — penalize by class so a g=0
      // recruit can't outrank proven starters. (Redshirt FR keep the FR grace.)
      const w = PROJECTION_WEIGHTS
      const penalty = PROJECTION_CLASS_PENALTY[p.classYear ?? 'FR'] ?? 0
      const overall = clamp(Math.round(w.recruiting * recruiting + w.class * cls) - penalty, OVERALL_MIN, OVERALL_MAX)
      return { overall, method: 'recruiting-projection', confidence: ratingConfidence('recruiting-projection', hasRecruiting, games), components: { recruiting, production: null, class: cls }, weights: { ...w } }
    }
    if (production != null) {
      const w = PRODUCTION_ONLY_WEIGHTS
      const overall = Math.round(w.production * production + w.class * cls)
      return { overall: clamp(overall, OVERALL_MIN, OVERALL_MAX), method: 'production-only', confidence: ratingConfidence('production-only', hasRecruiting, games), components: { recruiting: null, production, class: cls }, weights: { ...w } }
    }
    return { overall: null, method: 'nr', confidence: 'low', components: { recruiting: null, production: null, class: cls }, weights: { ...RATING_WEIGHTS } }
  })
}
