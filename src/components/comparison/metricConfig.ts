/**
 * U10 — comparison-metric registry. The two-team comparison stack was hard-wired
 * to `p.ovr` (blended overall, ~65–99 scale, with `ovr > 0` as the "unrated"
 * sentinel). This module lifts that single assumption into a `MetricConfig` so
 * the user can compare on OVR, recruiting composite, snap-share usage, or per-play
 * PPA. Each metric owns its own scale-dependent behavior:
 *
 *  - `get`         — pull the value off a UIPlayer (null when absent)
 *  - `isValid`     — the per-metric "real value" predicate. OVR/composite use a
 *                    `> 0` floor (0 means *unrated*); usage/PPA accept any finite
 *                    value (a 0 snap-share is real, a PPA is legitimately negative)
 *  - `roundAgg`    — display rounding for an aggregate (int for OVR, 2dp for usage/PPA)
 *  - `normalize`   — map a value into 0..1 for the radar + edge-bar geometry
 *  - `color`       — value → tier color
 *  - `depthGaps` / `benchGap` / `edgeEven` / `advantage` — the OVR-point thresholds,
 *    re-expressed in each metric's own units
 *  - `supportsDivergence` — the recruiting-vs-OVR "Hidden Gem / Not Living Up"
 *    story is intrinsically OVR-anchored; only OVR opts in.
 *
 * Defaulting every comparisonMath function's `metric` param to `OVR_METRIC` keeps
 * all existing call sites (and their tests) byte-for-byte identical.
 */
import type { UIPlayer } from '../../data/schema/ui.ts'
import { getOvrColor } from '../../utils/playerHelpers.ts'

export type MetricKey = 'ovr' | 'composite' | 'usage' | 'ppa'

export const METRIC_KEYS: readonly MetricKey[] = ['ovr', 'composite', 'usage', 'ppa']

export const isMetricKey = (s: string | undefined | null): s is MetricKey =>
  s != null && (METRIC_KEYS as readonly string[]).includes(s)

export interface MetricConfig {
  key: MetricKey
  /** Selector button label. */
  label: string
  /** Short scale hint shown beside the selector + as a card subtitle. */
  subtitle: string
  /** Pull the raw metric value off a player; null when the player has none. */
  get: (p: UIPlayer) => number | null
  /** Is this a *real* (countable) value, excluding the metric's "absent" sentinel? */
  isValid: (v: number | null | undefined) => v is number
  /** Round an aggregate to a display-ready number (also used by the edge math). */
  roundAgg: (v: number) => number
  /** Map a value to 0..1 for the radar spokes + edge-bar widths. */
  normalize: (v: number) => number
  /** Tier color for a value. */
  color: (v: number) => string
  /** Starter→backup gap thresholds (in metric units) for DEEP/SOLID/THIN. */
  depthGaps: { solid: number; thin: number }
  /** Deep-bench gap: a backup within this of the starter avg reads as "Deep Bench". */
  benchGap: number
  /** |left − right| below this is an EVEN group. */
  edgeEven: number
  /** Overall gap at/above this drives the "Advantage" summary banner. */
  advantage: number
  /** Whether the recruiting-vs-metric divergence badges are meaningful (OVR only). */
  supportsDivergence: boolean
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))
const round2 = (n: number): number => Math.round(n * 100) / 100

/** Shared teal→green→lime→gold ramp keyed off a 0..1 normalized value. */
const rampColor = (n: number): string =>
  n >= 0.8 ? '#fbbf24' : n >= 0.6 ? '#84cc16' : n >= 0.4 ? '#22c55e' : '#14b8a6'

const positive = (v: number | null | undefined): v is number => typeof v === 'number' && v > 0
const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

const compositeNorm = (v: number): number => clamp01((v - 70) / 30)
const ppaNorm = (v: number): number => clamp01((v + 0.2) / 0.7)

export const OVR_METRIC: MetricConfig = {
  key: 'ovr',
  label: 'OVR',
  subtitle: 'blended rating',
  get: (p) => p.ovr,
  isValid: positive,
  roundAgg: Math.round,
  normalize: (v) => clamp01((v - 65) / 28),
  color: getOvrColor,
  depthGaps: { solid: 5, thin: 12 },
  benchGap: 15,
  edgeEven: 2,
  advantage: 5,
  supportsDivergence: true,
}

const COMPOSITE_METRIC: MetricConfig = {
  key: 'composite',
  label: 'Recruiting',
  subtitle: '247 composite %',
  get: (p) => p.composite,
  isValid: positive,
  roundAgg: Math.round,
  normalize: compositeNorm,
  color: (v) => rampColor(compositeNorm(v)),
  depthGaps: { solid: 4, thin: 10 },
  benchGap: 12,
  edgeEven: 2,
  advantage: 5,
  supportsDivergence: false,
}

const USAGE_METRIC: MetricConfig = {
  key: 'usage',
  label: 'Usage',
  subtitle: 'snap share 0–1',
  get: (p) => p.usageOverall,
  isValid: finite,
  roundAgg: round2,
  normalize: clamp01,
  color: (v) => rampColor(clamp01(v)),
  depthGaps: { solid: 0.1, thin: 0.25 },
  benchGap: 0.3,
  edgeEven: 0.03,
  advantage: 0.1,
  supportsDivergence: false,
}

const PPA_METRIC: MetricConfig = {
  key: 'ppa',
  label: 'PPA',
  subtitle: 'per-play eff.',
  get: (p) => p.ppaAll,
  isValid: finite,
  roundAgg: round2,
  normalize: ppaNorm,
  color: (v) => rampColor(ppaNorm(v)),
  depthGaps: { solid: 0.1, thin: 0.25 },
  benchGap: 0.3,
  edgeEven: 0.03,
  advantage: 0.1,
  supportsDivergence: false,
}

export const METRICS: Record<MetricKey, MetricConfig> = {
  ovr: OVR_METRIC,
  composite: COMPOSITE_METRIC,
  usage: USAGE_METRIC,
  ppa: PPA_METRIC,
}

export const getMetricConfig = (key: MetricKey): MetricConfig => METRICS[key]
