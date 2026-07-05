/**
 * Full-screen two-team comparison. Ported from the recovered
 * TeamComparisonView.jsx (967 ln) and adapted to the current contracts:
 *  - loads the RIGHT team via loadPlayerPipeline(teamId, mode) + mapPipelineToUI
 *  - team identity / accent / logo via teamRegistry (getTeamById, teamLogoUrl)
 *  - all aggregation math lives in the typed, unit-tested comparisonMath module
 *
 * HONEST-PARTIAL: when a side lacks enough rated starters the view surfaces a
 * "limited data" banner; OVRs/grades degrade to '—'/THIN rather than NaN; and
 * divergence badges never fire on derived-only (composite 0) players.
 */
import { useEffect, useMemo, useState } from 'react'
import { loadPlayerPipeline } from '../../data/pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from '../../data/mapPipelineToUI.ts'
import { TEAMS, getTeamById, teamLogoUrl } from '../../data/teamRegistry.ts'
import PlayerModal from '../PlayerModal.tsx'
import RadarChart, { type SpokeMeta } from './RadarChart.tsx'
import {
  DEF_ALL,
  DEPTH_COLORS,
  DEPTH_DESC,
  OFF_ALL,
  assessDataQuality,
  avgOvr,
  buildPosGroupRows,
  computeBenchPill,
  computeGroupWins,
  computeTeamOvr,
  depthGradeFor,
  formatSpotlightStats,
  multiGroupAvg,
  overallDepthGrade,
  slotPlayers,
  type DepthGrade,
  type PosGroupRow,
} from './comparisonMath.ts'
import { METRICS, METRIC_KEYS, getMetricConfig, type MetricConfig, type MetricKey } from './metricConfig.ts'
import type { PipelineMetrics } from '../../data/schema/pipeline.ts'
import type { UIDataset, UIPlayer } from '../../data/schema/ui.ts'

const DEPTH_RANK: Record<DepthGrade, number> = { THIN: 0, SOLID: 1, DEEP: 2 }
const shortName = (label: string): string => label.split(' ').pop() ?? label

interface OverallCardProps {
  label: string
  subtitle?: string
  leftOvr: number | null
  rightOvr: number | null
  leftGrade?: DepthGrade
  rightGrade?: DepthGrade
  leftColor: string
  rightColor: string
  leftStarterCount?: number | null
  rightStarterCount?: number | null
}

function OverallCard({
  label,
  subtitle,
  leftOvr,
  rightOvr,
  leftGrade,
  rightGrade,
  leftColor,
  rightColor,
  leftStarterCount,
  rightStarterCount,
}: OverallCardProps) {
  const leftWins = leftOvr != null && rightOvr != null && leftOvr > rightOvr
  const rightWins = leftOvr != null && rightOvr != null && rightOvr > leftOvr
  const gap = leftOvr != null && rightOvr != null ? Math.abs(leftOvr - rightOvr) : 0
  const showAdv = gap >= 3
  const dominantGrade: DepthGrade | undefined =
    leftGrade && rightGrade
      ? DEPTH_RANK[leftGrade] <= DEPTH_RANK[rightGrade]
        ? leftGrade
        : rightGrade
      : (leftGrade ?? rightGrade)
  const borderColor = dominantGrade ? `${DEPTH_COLORS[dominantGrade]}55` : '#1f2937'
  return (
    <div className="flex-1 bg-card-bg rounded-xl p-3 flex flex-col items-center gap-1" style={{ border: `1px solid ${borderColor}` }}>
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
      {subtitle && <span className="text-[7px] text-gray-600 -mt-0.5">{subtitle}</span>}
      <div className="flex items-center gap-3 w-full justify-center">
        <div className={`text-center ${leftWins ? 'opacity-100' : 'opacity-55'}`}>
          <div className="text-2xl font-black leading-none" style={{ color: leftWins ? leftColor : '#ffffff' }}>
            {leftOvr ?? '—'}
          </div>
          {leftGrade && (
            <div className="text-[8px] font-bold mt-0.5" style={{ color: DEPTH_COLORS[leftGrade] }}>
              {leftGrade}
            </div>
          )}
          {showAdv && leftWins && (
            <div className="text-[7px] font-black uppercase tracking-widest mt-0.5" style={{ color: leftColor }}>
              ADV
            </div>
          )}
          {leftStarterCount != null && <div className="text-[7px] text-gray-600 mt-0.5">{leftStarterCount} starters</div>}
        </div>
        <span className="text-[10px] text-gray-700 font-black">vs</span>
        <div className={`text-center ${rightWins ? 'opacity-100' : 'opacity-55'}`}>
          <div className="text-2xl font-black leading-none" style={{ color: rightWins ? rightColor : '#ffffff' }}>
            {rightOvr ?? '—'}
          </div>
          {rightGrade && (
            <div className="text-[8px] font-bold mt-0.5" style={{ color: DEPTH_COLORS[rightGrade] }}>
              {rightGrade}
            </div>
          )}
          {showAdv && rightWins && (
            <div className="text-[7px] font-black uppercase tracking-widest mt-0.5" style={{ color: rightColor }}>
              ADV
            </div>
          )}
          {rightStarterCount != null && <div className="text-[7px] text-gray-600 mt-0.5">{rightStarterCount} starters</div>}
        </div>
      </div>
      {leftGrade && rightGrade && (
        <div className="text-[7px] text-center leading-tight mt-0.5 px-1 space-x-0.5">
          <span style={{ color: DEPTH_COLORS[leftGrade] }}>{DEPTH_DESC[leftGrade]}</span>
          <span className="text-gray-700">·</span>
          <span style={{ color: DEPTH_COLORS[rightGrade] }}>{DEPTH_DESC[rightGrade]}</span>
        </div>
      )}
    </div>
  )
}

interface EdgeBarProps {
  label: string
  leftOvr: number | null
  rightOvr: number | null
  leftColor: string
  rightColor: string
  metric: MetricConfig
}

function EdgeBar({ label, leftOvr, rightOvr, leftColor, rightColor, metric }: EdgeBarProps) {
  // Bar widths use the metric's 0..1 normalize so usage/PPA scales (and negatives)
  // render sanely; edge direction stays on the raw values.
  const nl = leftOvr != null ? Math.max(0, metric.normalize(leftOvr)) : 0
  const nr = rightOvr != null ? Math.max(0, metric.normalize(rightOvr)) : 0
  const leftPct = nl + nr > 0 ? (nl / (nl + nr)) * 100 : 50
  const l = leftOvr ?? -Infinity
  const r = rightOvr ?? -Infinity
  const edge = leftOvr == null && rightOvr == null ? 'even' : l > r ? 'left' : l < r ? 'right' : 'even'
  return (
    <div className="mb-3">
      <div className="text-[9px] text-gray-500 font-semibold mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-black text-white w-7 text-right">{leftOvr ?? '—'}</span>
        <div className="flex-1 h-2.5 rounded-full overflow-hidden flex">
          <div style={{ width: `${leftPct}%`, background: leftColor, opacity: 0.8 }} className="transition-all duration-700" />
          <div style={{ width: `${100 - leftPct}%`, background: rightColor, opacity: 0.8 }} className="transition-all duration-700" />
        </div>
        <span className="text-[12px] font-black text-white w-7">{rightOvr ?? '—'}</span>
      </div>
      {edge !== 'even' && (
        <div
          className="text-[9px] font-bold uppercase tracking-widest text-center mt-0.5"
          style={{ color: edge === 'left' ? leftColor : rightColor }}
        >
          EDGE {edge === 'left' ? '←' : '→'}
        </div>
      )}
      {edge === 'even' && <div className="text-[9px] text-gray-600 text-center mt-0.5 font-semibold">Even</div>}
    </div>
  )
}

function DepthSpark({ starterOvr, backupOvr }: { starterOvr: number | null; backupOvr: number | null }) {
  if (starterOvr == null) return null
  const hasBackup = backupOvr != null
  const cliff = hasBackup ? starterOvr - backupOvr : null
  const isRedCliff = cliff != null && cliff > 20
  return (
    <div
      className="flex items-center gap-0.5 flex-shrink-0"
      title={hasBackup ? `Starter ${starterOvr} → Backup ${backupOvr}` : 'No backup data'}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: isRedCliff ? '#ef4444' : hasBackup ? '#60a5fa' : '#1f2937' }}
      />
    </div>
  )
}

export interface TeamComparisonViewProps {
  leftTeamId: string
  leftUiData: UIDataset | null
  leftMetrics: PipelineMetrics | null
  onBack: () => void
  /** Controlled right team (from the #/compare/:a/:b route); optional. */
  rightTeamId?: string
  /** Called when the user picks a different right team (updates the URL). */
  onRightTeamChange?: (rightId: string) => void
  /** Active comparison metric (U10); defaults to OVR. */
  metricKey?: MetricKey
  /** Called when the user switches the comparison metric (updates the URL). */
  onMetricChange?: (metric: MetricKey) => void
}

export default function TeamComparisonView({
  leftTeamId,
  leftUiData,
  leftMetrics,
  onBack,
  rightTeamId: rightTeamIdProp,
  onRightTeamChange,
  metricKey = 'ovr',
  onMetricChange,
}: TeamComparisonViewProps) {
  const mc = getMetricConfig(metricKey)
  /** Rounded metric value for a single player (or null when unrated for this metric). */
  const pval = (p: UIPlayer): number | null => {
    const v = mc.get(p)
    return mc.isValid(v) ? mc.roundAgg(v) : null
  }
  const leftTeam = getTeamById(leftTeamId)
  const leftColor = leftTeam?.accentColor ?? '#1a4d2e'

  const defaultRightId = TEAMS.find((t) => t.id !== leftTeamId)?.id ?? TEAMS[0]!.id
  const [internalRight, setInternalRight] = useState<string>(rightTeamIdProp ?? defaultRightId)
  const rightTeamId = rightTeamIdProp ?? internalRight
  const setRightTeamId = (id: string) => {
    setInternalRight(id)
    onRightTeamChange?.(id)
  }
  const [rightUiData, setRightUiData] = useState<UIDataset | null>(null)
  const [rightMetrics, setRightMetrics] = useState<PipelineMetrics | null>(null)
  const [rightLoading, setRightLoading] = useState(false)
  const [rightError, setRightError] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expandedRoster, setExpandedRoster] = useState<string | null>(null)
  const [pinnedSpotlight, setPinnedSpotlight] = useState<string | null>(null)
  const [isSwapped, setIsSwapped] = useState(false)

  // U3: an in-place player modal — the comparison view has BOTH teams' datasets
  // loaded, so a routed modal (which only knows the left team) won't do here.
  const [modalPlayer, setModalPlayer] = useState<UIPlayer | null>(null)
  const [modalReturnEl, setModalReturnEl] = useState<HTMLElement | null>(null)
  const openPlayer = (player: UIPlayer) => {
    setModalReturnEl(document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setModalPlayer(player)
  }

  const rightTeam = getTeamById(rightTeamId)
  const rightColor = rightTeam?.accentColor ?? '#7a1d2e'

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setRightLoading(true)
      setRightError('')
      setRightUiData(null)
      setRightMetrics(null)
      setExpandedGroup(null)
      try {
        const loaded = await loadPlayerPipeline(rightTeamId)
        if (!cancelled) {
          setRightUiData(mapPipelineToUI(loaded.pipeline))
          setRightMetrics(loaded.pipeline.metrics ?? null)
        }
      } catch (error) {
        if (!cancelled) setRightError(error instanceof Error ? error.message : String(error))
      } finally {
        if (!cancelled) setRightLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [rightTeamId])

  // The precomputed team.avgStarterOverall is an OVR figure — only use it for OVR;
  // every other metric is derived on the fly from the loaded datasets.
  const leftOvr = (metricKey === 'ovr' ? leftMetrics?.team?.avgStarterOverall : null) ?? computeTeamOvr(leftUiData, mc)
  const rightOvr = (metricKey === 'ovr' ? rightMetrics?.team?.avgStarterOverall : null) ?? computeTeamOvr(rightUiData, mc)

  const leftOffOvr = useMemo(() => avgOvr(slotPlayers(leftUiData?.offensiveStarters, OFF_ALL, 1, mc), mc), [leftUiData, mc])
  const rightOffOvr = useMemo(() => avgOvr(slotPlayers(rightUiData?.offensiveStarters, OFF_ALL, 1, mc), mc), [rightUiData, mc])
  const leftDefOvr = useMemo(() => avgOvr(slotPlayers(leftUiData?.defensiveStarters, DEF_ALL, 1, mc), mc), [leftUiData, mc])
  const rightDefOvr = useMemo(() => avgOvr(slotPlayers(rightUiData?.defensiveStarters, DEF_ALL, 1, mc), mc), [rightUiData, mc])

  const leftOvrGrade = useMemo(() => overallDepthGrade(leftUiData, mc), [leftUiData, mc])
  const rightOvrGrade = useMemo(() => overallDepthGrade(rightUiData, mc), [rightUiData, mc])
  const leftOffGrade = useMemo(() => depthGradeFor(leftUiData, 'OFF', OFF_ALL, mc), [leftUiData, mc])
  const rightOffGrade = useMemo(() => depthGradeFor(rightUiData, 'OFF', OFF_ALL, mc), [rightUiData, mc])
  const leftDefGrade = useMemo(() => depthGradeFor(leftUiData, 'DEF', DEF_ALL, mc), [leftUiData, mc])
  const rightDefGrade = useMemo(() => depthGradeFor(rightUiData, 'DEF', DEF_ALL, mc), [rightUiData, mc])

  const leftOvrStarters = useMemo(
    () => slotPlayers(leftUiData?.offensiveStarters, OFF_ALL, 1, mc).length + slotPlayers(leftUiData?.defensiveStarters, DEF_ALL, 1, mc).length,
    [leftUiData, mc],
  )
  const rightOvrStarters = useMemo(
    () => slotPlayers(rightUiData?.offensiveStarters, OFF_ALL, 1, mc).length + slotPlayers(rightUiData?.defensiveStarters, DEF_ALL, 1, mc).length,
    [rightUiData, mc],
  )
  const leftOffStarters = useMemo(() => slotPlayers(leftUiData?.offensiveStarters, OFF_ALL, 1, mc).length, [leftUiData, mc])
  const rightOffStarters = useMemo(() => slotPlayers(rightUiData?.offensiveStarters, OFF_ALL, 1, mc).length, [rightUiData, mc])
  const leftDefStarters = useMemo(() => slotPlayers(leftUiData?.defensiveStarters, DEF_ALL, 1, mc).length, [leftUiData, mc])
  const rightDefStarters = useMemo(() => slotPlayers(rightUiData?.defensiveStarters, DEF_ALL, 1, mc).length, [rightUiData, mc])

  const posGroupRows = useMemo<PosGroupRow[]>(() => buildPosGroupRows(leftUiData, rightUiData, mc), [leftUiData, rightUiData, mc])

  const leftRadar = useMemo(() => posGroupRows.map((r) => r.lStarterOvr), [posGroupRows])
  const rightRadar = useMemo(() => posGroupRows.map((r) => r.rStarterOvr), [posGroupRows])
  const spokeMeta = useMemo<SpokeMeta[]>(
    () =>
      posGroupRows.map(({ group, lOvr, rOvr, edge, lTopName, rTopName }) => ({
        groupId: group.groupId,
        lOvr,
        rOvr,
        edge,
        lName: lTopName,
        rName: rTopName,
      })),
    [posGroupRows],
  )

  const spotlight = useMemo<PosGroupRow[]>(() => {
    if (!leftUiData || !rightUiData) return []
    const sorted = [...posGroupRows]
      .filter((r) => r.lStarterOvr != null && r.rStarterOvr != null)
      .sort(
        (a, b) =>
          Math.abs((b.lStarterOvr ?? 0) - (b.rStarterOvr ?? 0)) - Math.abs((a.lStarterOvr ?? 0) - (a.rStarterOvr ?? 0)),
      )
    if (pinnedSpotlight) {
      const pinned = sorted.find((r) => r.group.groupId === pinnedSpotlight)
      const rest = sorted.filter((r) => r.group.groupId !== pinnedSpotlight)
      return pinned ? [pinned, ...rest].slice(0, 2) : sorted.slice(0, 2)
    }
    return sorted.slice(0, 2)
  }, [posGroupRows, leftUiData, rightUiData, pinnedSpotlight])

  const odMatchups = useMemo(() => {
    if (!leftUiData || !rightUiData) return []
    return [
      {
        label: 'Passing Game',
        leftAtk: multiGroupAvg(leftUiData, ['QB', 'WR', 'TE'], 1, mc),
        rightDef: multiGroupAvg(rightUiData, ['CB', 'S', 'LB'], 1, mc),
        rightAtk: multiGroupAvg(rightUiData, ['QB', 'WR', 'TE'], 1, mc),
        leftDef: multiGroupAvg(leftUiData, ['CB', 'S', 'LB'], 1, mc),
      },
      {
        label: 'Run Game',
        leftAtk: multiGroupAvg(leftUiData, ['RB', 'OL'], 1, mc),
        rightDef: multiGroupAvg(rightUiData, ['DL', 'LB'], 1, mc),
        rightAtk: multiGroupAvg(rightUiData, ['RB', 'OL'], 1, mc),
        leftDef: multiGroupAvg(leftUiData, ['DL', 'LB'], 1, mc),
      },
    ]
  }, [leftUiData, rightUiData, mc])

  const groupWins = useMemo(() => computeGroupWins(posGroupRows), [posGroupRows])

  const leftQuality = useMemo(() => assessDataQuality(leftUiData, mc), [leftUiData, mc])
  const rightQuality = useMemo(() => assessDataQuality(rightUiData, mc), [rightUiData, mc])

  const summaryBanner = useMemo(() => {
    if (leftOvr == null || rightOvr == null) return null
    const diff = leftOvr - rightOvr
    const absDiff = Math.abs(diff)
    if (absDiff >= mc.advantage) {
      return {
        type: 'advantage' as const,
        team: diff > 0 ? leftTeam : rightTeam,
        color: diff > 0 ? leftColor : rightColor,
        margin: absDiff,
      }
    }
    const battles = posGroupRows
      .filter((r) => r.lOvr != null && r.rOvr != null)
      .sort((a, b) => Math.abs((a.lOvr ?? 0) - (a.rOvr ?? 0)) - Math.abs((b.lOvr ?? 0) - (b.rOvr ?? 0)))
    return {
      type: 'tossup' as const,
      closestKey: battles[0]?.group.groupId ?? null,
      closestLeftOvr: battles[0]?.lOvr ?? null,
      closestRightOvr: battles[0]?.rOvr ?? null,
    }
  }, [leftOvr, rightOvr, leftTeam, rightTeam, leftColor, rightColor, posGroupRows, mc])

  const leftLogoSrc = teamLogoUrl(leftTeamId)
  const rightLogoSrc = teamLogoUrl(rightTeamId)
  const leftLabel = leftTeam?.label ?? leftTeamId
  const rightLabel = rightTeam?.label ?? rightTeamId
  const leftShort = shortName(leftLabel)
  const rightShort = shortName(rightLabel)

  const dLeftLabel = isSwapped ? rightLabel : leftLabel
  const dRightLabel = isSwapped ? leftLabel : rightLabel
  const dLeftColor = isSwapped ? rightColor : leftColor
  const dRightColor = isSwapped ? leftColor : rightColor
  const dLeftLogo = isSwapped ? rightLogoSrc : leftLogoSrc
  const dRightLogo = isSwapped ? leftLogoSrc : rightLogoSrc
  const dLeftShort = isSwapped ? rightShort : leftShort
  const dRightShort = isSwapped ? leftShort : rightShort

  const limitedNote =
    leftQuality.isLimited || rightQuality.isLimited
      ? `Limited rated data — ${leftQuality.isLimited ? `${leftShort} ` : ''}${
          leftQuality.isLimited && rightQuality.isLimited ? '& ' : ''
        }${rightQuality.isLimited ? `${rightShort} ` : ''}has few rated starters; figures shown reflect available players only.`
      : null

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none font-sans bg-card-bg">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 bg-surface border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {dLeftLogo && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden p-0.5 flex-shrink-0" style={{ background: dLeftColor }}>
                <img src={dLeftLogo} alt={dLeftLabel} className="w-full h-full object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
            )}
            <span className="text-sm font-black text-white truncate">{dLeftLabel.toUpperCase()}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <span className="text-[11px] font-black text-gray-600">VS</span>
            <button
              type="button"
              onClick={() => setIsSwapped((s) => !s)}
              className="text-[9px] font-bold text-gray-500 hover:text-white px-1 py-0.5 rounded hover:bg-gray-800 transition-colors"
              title="Swap teams"
            >
              ⇄
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            {dRightLogo && !rightLoading && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden p-0.5 flex-shrink-0" style={{ background: dRightColor }}>
                <img src={dRightLogo} alt={dRightLabel} className="w-full h-full object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
            )}
            <select
              value={rightTeamId}
              onChange={(e) => setRightTeamId(e.target.value)}
              aria-label="Comparison team"
              className="rounded-md border border-surface-border bg-card-bg px-2 py-1.5 text-xs font-semibold text-white focus:outline-none max-w-[180px]"
            >
              {TEAMS.filter((t) => t.id !== leftTeamId).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-surface-border text-[11px] font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            ← Team View
          </button>
        </div>
      </header>

      {/* U10: comparison-metric selector — OVR / recruiting / usage / PPA. */}
      <div className="flex-shrink-0 px-4 py-2 bg-surface border-b border-surface-border flex items-center gap-2 overflow-x-auto">
        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex-shrink-0">Compare by</span>
        {METRIC_KEYS.map((k) => {
          const cfg = METRICS[k]
          const active = k === metricKey
          return (
            <button
              key={k}
              type="button"
              onClick={() => onMetricChange?.(k)}
              aria-pressed={active}
              title={cfg.subtitle}
              className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                active ? 'text-white' : 'text-gray-400 border-surface-border hover:text-white hover:bg-gray-800'
              }`}
              style={active ? { background: `${leftColor}30`, borderColor: leftColor } : undefined}
            >
              {cfg.label}
            </button>
          )
        })}
        <span className="text-[8px] text-gray-600 flex-shrink-0 ml-1 whitespace-nowrap">{mc.subtitle}</span>
      </div>

      {rightLoading && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-surface border-b border-surface-border">
          <p className="text-[11px] font-semibold text-emerald-300">Loading {rightLabel}…</p>
        </div>
      )}
      {rightError && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-red-950 border-b border-surface-border">
          <p className="text-[11px] font-semibold text-red-300">Couldn’t load {rightLabel}: {rightError}</p>
        </div>
      )}
      {limitedNote && !rightLoading && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-amber-950 border-b border-surface-border">
          <p className="text-[11px] font-semibold text-amber-300">{limitedNote}</p>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
          {summaryBanner && !rightLoading && (
            <div
              className="rounded-xl border px-4 py-3 text-center"
              style={{
                background: summaryBanner.type === 'advantage' ? `${summaryBanner.color}20` : 'rgba(255,255,255,0.03)',
                borderColor: summaryBanner.type === 'advantage' ? `${summaryBanner.color}50` : '#374151',
              }}
            >
              {summaryBanner.type === 'advantage' ? (
                <>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Advantage</div>
                  <div className="text-lg font-black" style={{ color: summaryBanner.color }}>
                    {(summaryBanner.team?.label ?? '').toUpperCase()}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">+{summaryBanner.margin} {mc.label} edge overall</div>
                </>
              ) : (
                <>
                  <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Overall</div>
                  <div className="text-lg font-black text-white">TOSS-UP</div>
                  {summaryBanner.closestKey && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Key battleground: <span className="font-bold text-white">{summaryBanner.closestKey}</span> ({summaryBanner.closestLeftOvr} vs{' '}
                      {summaryBanner.closestRightOvr})
                    </div>
                  )}
                </>
              )}
              {groupWins.total > 0 && (
                <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-gray-800/60 text-[9px]">
                  <span style={{ color: leftColor }} className="font-bold">
                    {groupWins.l}/{groupWins.total}
                  </span>
                  <span className="text-gray-600">groups</span>
                  <span className="text-gray-700 font-black">vs</span>
                  <span className="text-gray-600">groups</span>
                  <span style={{ color: rightColor }} className="font-bold">
                    {groupWins.r}/{groupWins.total}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <OverallCard
              label="OVR"
              subtitle="all starters"
              leftOvr={leftOvr}
              rightOvr={rightOvr}
              leftGrade={leftOvrGrade}
              rightGrade={rightOvrGrade}
              leftColor={leftColor}
              rightColor={rightColor}
              leftStarterCount={leftOvrStarters || null}
              rightStarterCount={rightOvrStarters || null}
            />
            <OverallCard
              label="OFF"
              subtitle="offense only"
              leftOvr={leftOffOvr}
              rightOvr={rightOffOvr}
              leftGrade={leftOffGrade}
              rightGrade={rightOffGrade}
              leftColor={leftColor}
              rightColor={rightColor}
              leftStarterCount={leftOffStarters || null}
              rightStarterCount={rightOffStarters || null}
            />
            <OverallCard
              label="DEF"
              subtitle="defense only"
              leftOvr={leftDefOvr}
              rightOvr={rightDefOvr}
              leftGrade={leftDefGrade}
              rightGrade={rightDefGrade}
              leftColor={leftColor}
              rightColor={rightColor}
              leftStarterCount={leftDefStarters || null}
              rightStarterCount={rightDefStarters || null}
            />
          </div>

          <div className="flex items-center justify-center gap-8 text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dLeftColor }} />
              {dLeftLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dRightColor }} />
              {dRightLabel}
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-surface-border p-4">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest text-center mb-3">Position Unit Ratings</h2>
            <RadarChart
              leftValues={leftRadar}
              rightValues={rightRadar}
              leftColor={leftColor}
              rightColor={rightColor}
              spokeMeta={spokeMeta}
              leftLabel={leftShort}
              rightLabel={rightShort}
              normalize={mc.normalize}
            />
            <div className="mt-3 pt-3 border-t border-gray-800/60 flex items-center justify-center gap-5 flex-wrap">
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mr-1">Depth:</span>
              {([['DEEP', '≤5 gap'], ['SOLID', '≤12 gap'], ['THIN', '>12 gap']] as Array<[DepthGrade, string]>).map(([grade, desc]) => (
                <span key={grade} className="flex items-center gap-1 text-[8px]">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: DEPTH_COLORS[grade] }} />
                  <span className="font-bold" style={{ color: DEPTH_COLORS[grade] }}>
                    {grade}
                  </span>
                  <span className="text-gray-600">{desc}</span>
                </span>
              ))}
            </div>
          </div>

          {spotlight.length > 0 && (
            <div className="bg-surface rounded-2xl border border-surface-border p-4">
              <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Matchup Spotlight</h2>
              <div className="space-y-3">
                {spotlight.map(({ group, lStarterOvr, rStarterOvr, lStarters, rStarters, lBackups, rBackups }) => {
                  const lWins = (lStarterOvr ?? 0) > (rStarterOvr ?? 0)
                  return (
                    <div key={group.groupId} className="rounded-xl bg-black/40 border border-gray-800 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: lWins ? leftColor : '#6b7280' }}>
                          {dLeftShort}
                        </span>
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-3">{group.groupId}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: !lWins ? rightColor : '#6b7280' }}>
                          {dRightShort}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 space-y-1.5">
                          {lStarters.slice(0, 2).map((p) => {
                            const stats = formatSpotlightStats(p, group.groupId)
                            const v = pval(p)
                            return (
                              <div key={p.id}>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-black" style={{ color: v != null ? mc.color(v) : '#6b7280' }}>
                                    {v ?? '—'}
                                  </span>
                                  <span className="text-[10px] text-white font-semibold truncate">{p.name.split(' ').pop()}</span>
                                </div>
                                {stats && <div className="text-[8px] text-gray-500 ml-0.5">{stats}</div>}
                              </div>
                            )
                          })}
                          {lStarters.length === 0 && <span className="text-[10px] text-gray-600">—</span>}
                        </div>
                        <div className="text-center flex-shrink-0">
                          <div className="flex items-baseline gap-1 justify-center">
                            <span className="text-xl font-black" style={{ color: lWins ? leftColor : '#9ca3af' }}>
                              {lStarterOvr ?? '—'}
                            </span>
                            <span className="text-xs text-gray-700">–</span>
                            <span className="text-xl font-black" style={{ color: !lWins ? rightColor : '#9ca3af' }}>
                              {rStarterOvr ?? '—'}
                            </span>
                          </div>
                          <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: lWins ? leftColor : rightColor }}>
                            EDGE {lWins ? '←' : '→'}
                          </div>
                        </div>
                        <div className="flex-1 space-y-1.5 text-right">
                          {rStarters.slice(0, 2).map((p) => {
                            const stats = formatSpotlightStats(p, group.groupId)
                            const v = pval(p)
                            return (
                              <div key={p.id}>
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="text-[10px] text-white font-semibold truncate">{p.name.split(' ').pop()}</span>
                                  <span className="text-[11px] font-black" style={{ color: v != null ? mc.color(v) : '#6b7280' }}>
                                    {v ?? '—'}
                                  </span>
                                </div>
                                {stats && <div className="text-[8px] text-gray-500 mr-0.5">{stats}</div>}
                              </div>
                            )
                          })}
                          {rStarters.length === 0 && <span className="text-[10px] text-gray-600">—</span>}
                        </div>
                      </div>
                      {(() => {
                        const lPill = computeBenchPill(lStarters, lBackups, mc)
                        const rPill = computeBenchPill(rStarters, rBackups, mc)
                        if (!lPill && !rPill) return null
                        return (
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/60">
                            <div className="flex-1">
                              {lPill && (
                                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded" style={{ background: lPill.bg, color: lPill.color }}>
                                  {lPill.label}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 flex justify-end">
                              {rPill && (
                                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded" style={{ background: rPill.bg, color: rPill.color }}>
                                  {rPill.label}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Position group table */}
          <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Position Groups</h2>
              {mc.supportsDivergence && (
                <div className="flex items-center gap-3 text-[9px] font-semibold text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#34d399' }} />
                    Hidden Gem
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />
                    Not Living Up
                  </span>
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-900/60">
              {posGroupRows.map((row) => {
                const {
                  group,
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
                  edge,
                  lRosterBadge,
                  rRosterBadge,
                  lStarters,
                  rStarters,
                  lComp,
                  rComp,
                } = row
                return (
                  <div key={group.groupId}>
                    <div
                      className="flex items-center px-4 py-2.5 cursor-pointer"
                      onClick={() => setPinnedSpotlight((p) => (p === group.groupId ? null : group.groupId))}
                      style={{
                        background:
                          pinnedSpotlight === group.groupId
                            ? 'rgba(255,255,255,0.06)'
                            : edge === 'left'
                              ? `${leftColor}16`
                              : edge === 'right'
                                ? `${rightColor}16`
                                : 'transparent',
                        borderLeft: pinnedSpotlight === group.groupId ? '2px solid #60a5fa' : '2px solid transparent',
                      }}
                    >
                      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-lg font-black leading-none"
                            style={{
                              color: lOvr != null ? mc.color(lOvr) : '#6b7280',
                              outline: edge === 'left' ? `1px solid ${leftColor}44` : 'none',
                              borderRadius: '2px',
                              paddingLeft: edge === 'left' ? '2px' : undefined,
                            }}
                          >
                            {lOvr ?? '—'}
                          </span>
                          {lComp != null && lStarterOvr != null && Math.abs(Math.round(lComp - lStarterOvr)) >= 3 && (
                            <span
                              className="text-[8px] font-bold flex-shrink-0"
                              style={{ color: Math.round(lComp - lStarterOvr) > 0 ? '#fbbf24' : '#34d399' }}
                            >
                              {Math.round(lComp - lStarterOvr) > 0 ? '▲' : '▼'}
                              {Math.abs(Math.round(lComp - lStarterOvr))}
                            </span>
                          )}
                          <DepthSpark starterOvr={lStarterOvr} backupOvr={lBackupOvr} />
                          {lBadge && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedGroup(expandedGroup === `${group.groupId}-L` ? null : `${group.groupId}-L`)
                              }}
                              className="text-[7px] font-bold px-1.5 py-0.5 rounded leading-tight cursor-pointer hover:opacity-80"
                              style={{ background: lBadge.bg, color: lBadge.text }}
                            >
                              {lBadge.label}
                            </button>
                          )}
                          {lRosterBadge && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedRoster(expandedRoster === `${group.groupId}-L` ? null : `${group.groupId}-L`)
                              }}
                              className="text-[7px] font-bold px-1.5 py-0.5 rounded leading-tight cursor-pointer hover:opacity-80"
                              style={{
                                background: lRosterBadge === 'RELOADED' ? '#1e1b4b' : '#1c1917',
                                color: lRosterBadge === 'RELOADED' ? '#a5b4fc' : '#d6d3d1',
                              }}
                            >
                              {lRosterBadge}
                            </button>
                          )}
                        </div>
                        {lStarters[0] &&
                          (() => {
                            const stat = formatSpotlightStats(lStarters[0], group.groupId)
                            return stat ? <div className="text-[7px] text-gray-500 truncate">{stat}</div> : null
                          })()}
                      </div>
                      <div className="text-center w-16 flex-shrink-0">
                        <div className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{group.groupId}</div>
                        {edge !== 'even' && (
                          <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: edge === 'left' ? leftColor : rightColor }}>
                            EDGE
                          </div>
                        )}
                        {edge === 'even' && <div className="text-[8px] text-gray-700 font-semibold">EVEN</div>}
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5 items-end min-w-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          {rRosterBadge && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedRoster(expandedRoster === `${group.groupId}-R` ? null : `${group.groupId}-R`)
                              }}
                              className="text-[7px] font-bold px-1.5 py-0.5 rounded leading-tight cursor-pointer hover:opacity-80"
                              style={{
                                background: rRosterBadge === 'RELOADED' ? '#1e1b4b' : '#1c1917',
                                color: rRosterBadge === 'RELOADED' ? '#a5b4fc' : '#d6d3d1',
                              }}
                            >
                              {rRosterBadge}
                            </button>
                          )}
                          {rBadge && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedGroup(expandedGroup === `${group.groupId}-R` ? null : `${group.groupId}-R`)
                              }}
                              className="text-[7px] font-bold px-1.5 py-0.5 rounded leading-tight cursor-pointer hover:opacity-80"
                              style={{ background: rBadge.bg, color: rBadge.text }}
                            >
                              {rBadge.label}
                            </button>
                          )}
                          <DepthSpark starterOvr={rStarterOvr} backupOvr={rBackupOvr} />
                          {rComp != null && rStarterOvr != null && Math.abs(Math.round(rComp - rStarterOvr)) >= 3 && (
                            <span
                              className="text-[8px] font-bold flex-shrink-0"
                              style={{ color: Math.round(rComp - rStarterOvr) > 0 ? '#fbbf24' : '#34d399' }}
                            >
                              {Math.round(rComp - rStarterOvr) > 0 ? '▲' : '▼'}
                              {Math.abs(Math.round(rComp - rStarterOvr))}
                            </span>
                          )}
                          <span
                            className="text-lg font-black leading-none"
                            style={{
                              color: rOvr != null ? mc.color(rOvr) : '#6b7280',
                              outline: edge === 'right' ? `1px solid ${rightColor}44` : 'none',
                              borderRadius: '2px',
                              paddingRight: edge === 'right' ? '2px' : undefined,
                            }}
                          >
                            {rOvr ?? '—'}
                          </span>
                        </div>
                        {rStarters[0] &&
                          (() => {
                            const stat = formatSpotlightStats(rStarters[0], group.groupId)
                            return stat ? <div className="text-[7px] text-gray-500 truncate text-right">{stat}</div> : null
                          })()}
                      </div>
                    </div>

                    {(expandedRoster === `${group.groupId}-L` || expandedRoster === `${group.groupId}-R`) &&
                      (() => {
                        const side = expandedRoster?.endsWith('-L') ? 'left' : 'right'
                        const players = side === 'left' ? lStarters : rStarters
                        const badge = side === 'left' ? lRosterBadge : rRosterBadge
                        const color = side === 'left' ? leftColor : rightColor
                        return (
                          <div className="px-4 py-2 bg-black/30 border-t border-gray-900/60">
                            <div className="text-[8px] font-bold uppercase tracking-widest mb-1.5" style={{ color }}>
                              {badge === 'RELOADED' ? 'Reload Era — fresh talent' : 'Battle-Tested — proven veterans'}
                            </div>
                            <div className="space-y-0.5">
                              {players.map((p) => {
                                const v = pval(p)
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => openPlayer(p)}
                                    title={`Open ${p.name}`}
                                    className="w-full flex items-center gap-2 text-[9px] text-left rounded px-1 -mx-1 py-0.5 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-white/40 transition-colors"
                                  >
                                    <span className="font-semibold text-white truncate flex-1">{p.name}</span>
                                    <span className="text-gray-500 flex-shrink-0">{p.year ?? '—'}</span>
                                    <span className="font-black flex-shrink-0" style={{ color: v != null ? mc.color(v) : '#6b7280' }}>
                                      {v ?? '—'}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}

                    {(expandedGroup === `${group.groupId}-L` || expandedGroup === `${group.groupId}-R`) &&
                      (() => {
                        const side = expandedGroup?.endsWith('-L') ? 'left' : 'right'
                        const player = side === 'left' ? lDivPlayer : rDivPlayer
                        const badge = side === 'left' ? lBadge : rBadge
                        const color = side === 'left' ? leftColor : rightColor
                        const teamLabel = side === 'left' ? leftShort : rightShort
                        if (!player) return null
                        const statLine = formatSpotlightStats(player, group.groupId)
                        return (
                          <div className="px-4 py-2 bg-black/30 border-t border-gray-900/60">
                            <div className="flex items-start gap-3">
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: badge?.bg, color: badge?.text }}>
                                {badge?.label}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold" style={{ color }}>
                                    {player.name}
                                  </span>
                                  {player.number != null && <span className="text-[9px] text-gray-500">#{player.number}</span>}
                                </div>
                                <div className="text-[9px] text-gray-400 mt-0.5">
                                  {player.composite > 0 ? `${player.composite.toFixed(1)}% recruit` : 'unrated'} · {player.ovr} OVR
                                  {statLine && <span className="text-gray-500"> · {statLine}</span>}
                                </div>
                                <div className="text-[8px] text-gray-600 mt-0.5">
                                  {teamLabel} {group.groupId} · divergence:{' '}
                                  {player.composite > 0 ? `${Math.abs(player.composite - player.ovr).toFixed(0)} pts` : '—'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                  </div>
                )
              })}
            </div>
          </div>

          {odMatchups.length > 0 && leftUiData && rightUiData && (
            <div className="bg-surface rounded-2xl border border-surface-border p-4">
              <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Offense vs Defense</h2>
              <div className="space-y-5">
                {odMatchups.map(({ label, leftAtk, rightDef, rightAtk, leftDef }) => (
                  <div key={label}>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">{label}</div>
                    <EdgeBar label={`${dLeftShort} Attack vs ${dRightShort} Defense`} leftOvr={leftAtk} rightOvr={rightDef} leftColor={leftColor} rightColor={rightColor} metric={mc} />
                    <EdgeBar label={`${dRightShort} Attack vs ${dLeftShort} Defense`} leftOvr={rightAtk} rightOvr={leftDef} leftColor={rightColor} rightColor={leftColor} metric={mc} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>
      </main>

      <PlayerModal player={modalPlayer} onClose={() => setModalPlayer(null)} returnFocusEl={modalReturnEl} />
    </div>
  )
}
