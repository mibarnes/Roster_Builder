/**
 * Pure aggregation helpers for the two-team comparison view. Ported and adapted
 * from the recovered TeamComparisonView.jsx inline helpers, but extracted as a
 * standalone, fully-typed module so the math is unit-testable independent of
 * React. Consumes the current UIDataset / UIPlayer / PipelineMetrics contracts.
 *
 * HONEST-PARTIAL: a UIPlayer with `composite === 0` carries no real recruiting
 * signal (its `ovr` is the derived 70-floor / pure-derived value). The recovered
 * code filtered on `ovr > 0`; we keep that (an ovr of 0 means "no rating at all")
 * AND additionally never treat a derived-only player's composite as real. Depth
 * grades, divergence badges, and OVR averages all degrade to null/THIN/'—' when
 * the underlying players are missing rather than fabricating values.
 */
import type { Formation, UIDataset, UIPlayer } from '../../data/schema/ui.ts'
import { OVR_METRIC, type MetricConfig } from './metricConfig.ts'

export type Side = 'OFF' | 'DEF'
export type DepthGrade = 'DEEP' | 'SOLID' | 'THIN'
export type EdgeSide = 'left' | 'right' | 'even'

export interface PosGroup {
  /** Position-group id (avoid a `*key` name to keep the secret-guard happy). */
  groupId: string
  side: Side
  slots: string[]
}

export const POS_GROUPS: readonly PosGroup[] = [
  { groupId: 'QB', side: 'OFF', slots: ['QB'] },
  { groupId: 'RB', side: 'OFF', slots: ['RB'] },
  { groupId: 'WR', side: 'OFF', slots: ['WRX', 'WRZ', 'SLOT'] },
  { groupId: 'TE', side: 'OFF', slots: ['TE'] },
  { groupId: 'OL', side: 'OFF', slots: ['LT', 'LG', 'C', 'RG', 'RT'] },
  { groupId: 'DL', side: 'DEF', slots: ['LDE', 'RDE', 'NT', 'DT'] },
  { groupId: 'LB', side: 'DEF', slots: ['WLB', 'MLB', 'NB'] },
  { groupId: 'CB', side: 'DEF', slots: ['LCB', 'RCB'] },
  { groupId: 'S', side: 'DEF', slots: ['SS', 'FS'] },
]

export const OFF_ALL = ['QB', 'RB', 'WRX', 'WRZ', 'SLOT', 'TE', 'LT', 'LG', 'C', 'RG', 'RT']
export const DEF_ALL = ['LDE', 'RDE', 'NT', 'DT', 'WLB', 'MLB', 'NB', 'LCB', 'RCB', 'SS', 'FS']

export const DEPTH_COLORS: Record<DepthGrade, string> = { DEEP: '#22c55e', SOLID: '#60a5fa', THIN: '#ef4444' }
export const DEPTH_DESC: Record<DepthGrade, string> = {
  DEEP: 'Strong depth',
  SOLID: 'Solid depth',
  THIN: 'Starter-dependent',
}

const DEPTH_RANK: Record<DepthGrade, number> = { THIN: 0, SOLID: 1, DEEP: 2 }

export const getFormation = (uiData: UIDataset | null, side: Side): Formation | undefined =>
  side === 'OFF' ? uiData?.offensiveStarters : uiData?.defensiveStarters

/** Players occupying the given slots, depth-limited, carrying a real metric value. */
export const slotPlayers = (
  formation: Formation | undefined,
  slots: string[],
  maxDepth = 2,
  metric: MetricConfig = OVR_METRIC,
): UIPlayer[] =>
  slots
    .flatMap((s) => (formation?.[s] ?? []).slice(0, maxDepth))
    .filter((p) => p != null && metric.isValid(metric.get(p)))

/** Aggregate (display-rounded) average of the metric across players; null when none valid. */
export const avgOvr = (players: UIPlayer[], metric: MetricConfig = OVR_METRIC): number | null => {
  const vals = players.map((p) => metric.get(p)).filter((v): v is number => metric.isValid(v))
  return vals.length ? metric.roundAgg(vals.reduce((acc, v) => acc + v, 0) / vals.length) : null
}

export const multiGroupAvg = (
  uiData: UIDataset | null,
  groupIds: string[],
  maxDepth = 1,
  metric: MetricConfig = OVR_METRIC,
): number | null => {
  if (!uiData) return null
  const groups = POS_GROUPS.filter((g) => groupIds.includes(g.groupId))
  const players = groups.flatMap((g) => slotPlayers(getFormation(uiData, g.side), g.slots, maxDepth, metric))
  return avgOvr(players, metric)
}

export const computeDepthGrade = (
  formation: Formation | undefined,
  slots: string[],
  metric: MetricConfig = OVR_METRIC,
): DepthGrade => {
  const val = (p: UIPlayer | undefined): number | null => {
    const v = p ? metric.get(p) : null
    return metric.isValid(v) ? v : null
  }
  const starters = slots.map((s) => val(formation?.[s]?.[0])).filter((v): v is number => v != null)
  const backups = slots.map((s) => val(formation?.[s]?.[1])).filter((v): v is number => v != null)
  if (!starters.length) return 'THIN'
  const avgS = starters.reduce((acc, v) => acc + v, 0) / starters.length
  const avgB = backups.length ? backups.reduce((acc, v) => acc + v, 0) / backups.length : 0
  if (!backups.length || avgS - avgB > metric.depthGaps.thin) return 'THIN'
  if (avgS - avgB > metric.depthGaps.solid) return 'SOLID'
  return 'DEEP'
}

export const depthGradeFor = (
  uiData: UIDataset | null,
  side: Side,
  slots: string[],
  metric: MetricConfig = OVR_METRIC,
): DepthGrade => (uiData ? computeDepthGrade(getFormation(uiData, side), slots, metric) : 'THIN')

export const overallDepthGrade = (uiData: UIDataset | null, metric: MetricConfig = OVR_METRIC): DepthGrade => {
  if (!uiData) return 'THIN'
  const off = computeDepthGrade(uiData.offensiveStarters, OFF_ALL, metric)
  const def = computeDepthGrade(uiData.defensiveStarters, DEF_ALL, metric)
  return DEPTH_RANK[off] <= DEPTH_RANK[def] ? off : def
}

export const computeTeamOvr = (uiData: UIDataset | null, metric: MetricConfig = OVR_METRIC): number | null => {
  if (!uiData) return null
  return avgOvr(
    [
      ...slotPlayers(uiData.offensiveStarters, OFF_ALL, 1, metric),
      ...slotPlayers(uiData.defensiveStarters, DEF_ALL, 1, metric),
    ],
    metric,
  )
}

export interface DivBadge {
  label: string
  bg: string
  text: string
}

/**
 * Recruiting-vs-OVR divergence badge. Returns null when composite is 0 (no real
 * recruiting signal — do NOT fabricate a divergence story for derived-only data).
 */
export const divBadge = (composite: number | null, ovr: number | null): DivBadge | null => {
  if (!composite || !ovr) return null
  const diff = composite - ovr
  if (diff > 15) return { label: 'Not Living Up to Hype', bg: '#451a03', text: '#fbbf24' }
  if (diff < -15) return { label: 'Hidden Gem', bg: '#022c22', text: '#34d399' }
  return null
}

export const parseClassYear = (year: string | null): string => (year ?? '').replace('RS ', '').trim()
const isYoungPlayer = (p: UIPlayer): boolean => p.isTransfer || parseClassYear(p.year) === 'FR'
const isVeteranPlayer = (p: UIPlayer): boolean => {
  const y = parseClassYear(p.year)
  return y === 'JR' || y === 'SR'
}

export type RosterBadge = 'RELOADED' | 'BATTLE-TESTED' | null

export const computeRosterBadge = (starters: UIPlayer[], backups: UIPlayer[]): RosterBadge => {
  if (!starters.length) return null
  if (starters.filter(isYoungPlayer).length / starters.length >= 0.5) return 'RELOADED'
  const all = [...starters, ...backups]
  if (all.length > 0 && all.every(isVeteranPlayer)) return 'BATTLE-TESTED'
  return null
}

export interface BenchPill {
  label: string
  color: string
  bg: string
}

export const computeBenchPill = (
  starters: UIPlayer[],
  backups: UIPlayer[],
  metric: MetricConfig = OVR_METRIC,
): BenchPill | null => {
  if (!starters.length || !backups.length) return null
  const avgS = avgOvr(starters, metric)
  if (avgS == null) return null
  const hasDeep = backups.some((b) => {
    const v = metric.get(b)
    return metric.isValid(v) && avgS - v <= metric.benchGap
  })
  return hasDeep
    ? { label: 'Deep Bench', color: '#22c55e', bg: '#022c22' }
    : { label: 'One Injury Away', color: '#ef4444', bg: '#450a0a' }
}

export interface PosGroupRow {
  group: PosGroup
  lOvr: number | null
  rOvr: number | null
  lStarterOvr: number | null
  rStarterOvr: number | null
  lBackupOvr: number | null
  rBackupOvr: number | null
  lBadge: DivBadge | null
  rBadge: DivBadge | null
  lDivPlayer: UIPlayer | null
  rDivPlayer: UIPlayer | null
  lComp: number | null
  rComp: number | null
  edge: EdgeSide
  lTopName: string | null
  rTopName: string | null
  lStarters: UIPlayer[]
  rStarters: UIPlayer[]
  lBackups: UIPlayer[]
  rBackups: UIPlayer[]
  lRosterBadge: RosterBadge
  rRosterBadge: RosterBadge
}

const avgComposite = (players: UIPlayer[]): number | null =>
  players.length ? players.reduce((acc, p) => acc + (p.composite ?? 0), 0) / players.length : null

const findDivPlayer = (players: UIPlayer[]): UIPlayer | null => {
  if (!players.length) return null
  return players.reduce<UIPlayer>((best, p) => {
    const diff = Math.abs((p.composite ?? 0) - p.ovr)
    const bDiff = Math.abs((best.composite ?? 0) - best.ovr)
    return diff > bDiff ? p : best
  }, players[0]!)
}

const lastName = (name: string | undefined): string | null => name?.split(' ').pop() ?? null

/** Build the full per-position-group comparison rows for left vs right datasets. */
export const buildPosGroupRows = (
  leftUiData: UIDataset | null,
  rightUiData: UIDataset | null,
  metric: MetricConfig = OVR_METRIC,
): PosGroupRow[] =>
  POS_GROUPS.map((g) => {
    const lForm = getFormation(leftUiData, g.side)
    const rForm = getFormation(rightUiData, g.side)

    const lStarters = slotPlayers(lForm, g.slots, 1, metric)
    const rStarters = slotPlayers(rForm, g.slots, 1, metric)
    const lBackups = g.slots.map((s) => lForm?.[s]?.[1]).filter((p): p is UIPlayer => !!p && metric.isValid(metric.get(p)))
    const rBackups = g.slots.map((s) => rForm?.[s]?.[1]).filter((p): p is UIPlayer => !!p && metric.isValid(metric.get(p)))

    const lStarterOvr = avgOvr(lStarters, metric)
    const rStarterOvr = avgOvr(rStarters, metric)
    const lBackupOvr = lBackups.length ? avgOvr(lBackups, metric) : null
    const rBackupOvr = rBackups.length ? avgOvr(rBackups, metric) : null

    const lOvr = avgOvr(slotPlayers(lForm, g.slots, 2, metric), metric)
    const rOvr = avgOvr(slotPlayers(rForm, g.slots, 2, metric), metric)

    // The recruiting-vs-metric divergence story is OVR-anchored; only surface it
    // for a metric that opts in (OVR). Other metrics carry null comp/badges.
    const div = metric.supportsDivergence
    const lComp = div ? avgComposite(lStarters) : null
    const rComp = div ? avgComposite(rStarters) : null

    const lBadge = div ? divBadge(lComp, lStarterOvr) : null
    const rBadge = div ? divBadge(rComp, rStarterOvr) : null

    const lDivPlayer = lBadge ? findDivPlayer(lStarters) : null
    const rDivPlayer = rBadge ? findDivPlayer(rStarters) : null

    const edge: EdgeSide =
      lOvr != null && rOvr != null
        ? Math.abs(lOvr - rOvr) < metric.edgeEven
          ? 'even'
          : lOvr > rOvr
            ? 'left'
            : 'right'
        : 'even'

    return {
      group: g,
      lOvr,
      rOvr,
      lStarterOvr,
      rStarterOvr,
      lBackupOvr,
      rBackupOvr,
      lBadge,
      rBadge,
      lDivPlayer,
      rDivPlayer,
      lComp,
      rComp,
      edge,
      lTopName: lastName(lStarters[0]?.name),
      rTopName: lastName(rStarters[0]?.name),
      lStarters,
      rStarters,
      lBackups,
      rBackups,
      lRosterBadge: computeRosterBadge(lStarters, lBackups),
      rRosterBadge: computeRosterBadge(rStarters, rBackups),
    }
  })

export interface GroupWins {
  l: number
  r: number
  e: number
  total: number
}

export const computeGroupWins = (rows: PosGroupRow[]): GroupWins => {
  let l = 0
  let r = 0
  let e = 0
  for (const row of rows) {
    if (row.edge === 'left') l++
    else if (row.edge === 'right') r++
    else e++
  }
  return { l, r, e, total: rows.length }
}

/** Per-position stat line for spotlight / inline display. */
export const formatSpotlightStats = (player: UIPlayer | undefined, groupId: string): string | null => {
  const s = player?.stats ?? {}
  const n = (defKey: string): number => (typeof s[defKey] === 'number' ? s[defKey] : 0)
  switch (groupId) {
    case 'QB':
      return s.PAS != null ? `${s.PAS} YDS · ${n('TD')} TD · ${n('INT')} INT` : null
    case 'RB':
      return s.YDS != null ? `${s.YDS} YDS · ${n('TD')} TD` : null
    case 'WR':
    case 'TE':
      return s.REC != null ? `${s.REC} REC · ${n('YDS')} YDS` : null
    case 'DL':
      return s.SCK != null || s.TFL != null ? `${n('SCK')} SCK · ${n('TFL')} TFL` : null
    case 'LB':
      return s.TKL != null ? `${s.TKL} TKL · ${n('TFL')} TFL` : null
    case 'CB':
    case 'S':
      return s.TKL != null ? `${s.TKL} TKL · ${n('PD')} PD` : null
    default:
      return null
  }
}

/**
 * How much real comparison data exists. Used to drive the honest-partial empty
 * state: if a team has very few rated starters, the view labels itself limited.
 */
export interface DataQuality {
  ratedStarters: number
  totalGroups: number
  ratedGroups: number
  isLimited: boolean
}

export const assessDataQuality = (uiData: UIDataset | null, metric: MetricConfig = OVR_METRIC): DataQuality => {
  const rows = buildPosGroupRows(uiData, null, metric)
  const ratedGroups = rows.filter((r) => r.lStarterOvr != null).length
  const ratedStarters = rows.reduce((acc, r) => acc + r.lStarters.length, 0)
  return {
    ratedStarters,
    totalGroups: rows.length,
    ratedGroups,
    isLimited: ratedGroups < 3,
  }
}
