import { useEffect, useState } from 'react'
import { loadPlayerPipeline } from './data/pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from './data/mapPipelineToUI.ts'
import { TEAMS, requireTeam, teamLogoUrl } from './data/teamRegistry.ts'
import { routeTeamId, useHashRoute, type RouteTab } from './router.ts'
import { readStored, usePersistentState } from './hooks/usePersistentState.ts'

/** Was the URL free of an explicit route at first load? (→ resume last view, U4.) */
const INITIAL_HASH_EMPTY =
  typeof window !== 'undefined' && (!window.location.hash || window.location.hash === '#/')
import CompositeHeader from './components/CompositeHeader.tsx'
import DefenseFormation from './components/DefenseFormation.tsx'
import OffenseFormation from './components/OffenseFormation.tsx'
import PlayerModal from './components/PlayerModal.tsx'
import RatingsView, { type RatingsFilters } from './components/RatingsView.tsx'
import Star from './components/Star.tsx'
import TeamComparisonView from './components/comparison/TeamComparisonView.tsx'
import PositionDepthView from './components/comparison/PositionDepthView.tsx'
import { EMPTY_COVERAGE, type PipelineMetrics } from './data/schema/pipeline.ts'
import type { Formation, UIDataset, UIPlayer } from './data/schema/ui.ts'
import type { DataMode } from './data/schema/dataset.ts'

type Tab = 'offense' | 'defense' | 'ratings'
type DepthMode = 'starters' | 'second-team' | 'all'

const EMPTY_OFFENSE: Formation = { LT: [], LG: [], C: [], RG: [], RT: [], WRX: [], SLOT: [], QB: [], RB: [], TE: [], WRZ: [] }
const EMPTY_DEFENSE: Formation = { LDE: [], NT: [], DT: [], RDE: [], LCB: [], SS: [], WLB: [], MLB: [], NB: [], FS: [], RCB: [] }
const EMPTY_ROSTER: UIDataset = { offensiveStarters: EMPTY_OFFENSE, defensiveStarters: EMPTY_DEFENSE, allPlayers: [], coverage: EMPTY_COVERAGE, returningProduction: null }
const EMPTY_METRICS: PipelineMetrics = {
  offense: { avgStarterComposite: 0, starterCount: 0 },
  defense: { avgStarterComposite: 0, starterCount: 0 },
  team: { avgStarterComposite: 0, avgStarterOverall: 0, starterCount: 0 },
}

const hexToRgbString = (hex = '#1a4d2e'): string => {
  const clean = String(hex).replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '26, 77, 46'
  const r = Number.parseInt(clean.slice(0, 2), 16)
  const g = Number.parseInt(clean.slice(2, 4), 16)
  const b = Number.parseInt(clean.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export default function App() {
  const { route, navigate } = useHashRoute()
  const teamId = routeTeamId(route)

  const [lastTab, setLastTab] = useState<Tab>('offense')
  const tab: Tab = route.kind === 'team' ? route.tab : lastTab

  const [depthTeam, setDepthTeam] = useState<DepthMode>('starters')
  const [filters, setFilters] = usePersistentState<RatingsFilters>('rb:filters', { side: 'ALL', pos: 'ALL', stars: 0, sort: 'composite' })
  const [returnFocusEl, setReturnFocusEl] = useState<HTMLElement | null>(null)
  const [rosterData, setRosterData] = useState<UIDataset>(EMPTY_ROSTER)
  const [metrics, setMetrics] = useState<PipelineMetrics>(EMPTY_METRICS)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  // Keep the last formation/ratings tab so closing a player modal (a route with
  // no tab of its own) returns to the view the user was on; also persist it (U4).
  useEffect(() => {
    if (route.kind === 'team') {
      setLastTab(route.tab)
      try {
        window.localStorage.setItem('rb:lastView', JSON.stringify({ teamId: route.teamId, tab: route.tab }))
      } catch {
        /* storage unavailable — non-fatal */
      }
    }
  }, [route])

  // Resume the last-visited team/tab on a fresh visit with no explicit URL (U4).
  // URL wins: only restores when the page opened without a route in the hash.
  useEffect(() => {
    if (!INITIAL_HASH_EMPTY) return
    const last = readStored<{ teamId: string; tab: RouteTab }>('rb:lastView')
    if (last && TEAMS.some((t) => t.id === last.teamId)) {
      navigate({ kind: 'team', teamId: last.teamId, tab: last.tab })
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedTeam = requireTeam(teamId)
  const teamAccentColor = selectedTeam.accentColor
  const dataMode = (import.meta.env?.VITE_DATA_MODE as DataMode | undefined) ?? 'bundled'
  const logoSrc = teamLogoUrl(teamId)

  // ── Navigation helpers (URL is the source of truth for the active view) ──
  const defaultRightId = (leftId: string): string =>
    TEAMS.find((t) => t.id !== leftId)?.id ?? TEAMS[0]!.id
  const setTab = (next: Tab) => navigate({ kind: 'team', teamId, tab: next })
  const setTeamId = (id: string) => navigate({ kind: 'team', teamId: id, tab })
  const openCompare = () => navigate({ kind: 'compare', leftId: teamId, rightId: defaultRightId(teamId) })
  const backToTeam = () => navigate({ kind: 'team', teamId, tab })

  const selected: UIPlayer | null =
    route.kind === 'player'
      ? rosterData.allPlayers.find((p) => p.playerId === route.playerId) ?? null
      : null

  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      setIsLoading(true)
      setLoadError('')
      try {
        const loaded = await loadPlayerPipeline(teamId, dataMode)
        if (cancelled) return
        setRosterData(mapPipelineToUI(loaded.pipeline))
        setMetrics(loaded.pipeline.metrics ?? EMPTY_METRICS)
        setWarnings(loaded.warnings)
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : String(error))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [dataMode, teamId])

  // Reset depth toggle to starters when team changes.
  useEffect(() => {
    setDepthTeam('starters')
  }, [teamId])

  // Reset depth toggle when navigating away from formation tabs.
  useEffect(() => {
    if (tab !== 'offense' && tab !== 'defense') setDepthTeam('starters')
  }, [tab])

  const onPlayerClick = (player: UIPlayer) => {
    setReturnFocusEl(document.activeElement instanceof HTMLElement ? document.activeElement : null)
    navigate({ kind: 'player', teamId, playerId: player.playerId })
  }

  const { offensiveStarters, defensiveStarters, allPlayers } = rosterData

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'offense', label: 'OFFENSE' },
    { id: 'defense', label: 'DEFENSE' },
    { id: 'ratings', label: 'RATINGS' },
  ]

  const isFormationTab = tab === 'offense' || tab === 'defense'

  const depthModes: Array<{ id: DepthMode; label: string; disabled?: boolean }> = [
    { id: 'starters', label: 'Starters' },
    { id: 'second-team', label: '2nd Team' },
    ...(isFormationTab ? [{ id: 'all' as DepthMode, label: tab === 'offense' ? 'All Off' : 'All Def' }] : []),
  ]
  const depthIndex = depthTeam === 'second-team' ? 1 : 0
  const filterFormationByDepth = (formation: Formation, index: number): Formation =>
    Object.fromEntries(
      Object.entries(formation).map(([slot, players]) => [slot, players[index] ? [players[index]!] : []]),
    )
  const visibleOffense = filterFormationByDepth(offensiveStarters, depthIndex)
  const visibleDefense = filterFormationByDepth(defensiveStarters, depthIndex)

  // ── Full-screen two-team comparison (M5) — a deep-linkable route (#/compare/:a/:b) ──
  if (route.kind === 'compare') {
    return (
      <TeamComparisonView
        leftTeamId={route.leftId}
        leftUiData={rosterData}
        leftMetrics={metrics}
        rightTeamId={route.rightId}
        onRightTeamChange={(rightId) => navigate({ kind: 'compare', leftId: route.leftId, rightId })}
        dataMode={dataMode}
        onBack={backToTeam}
      />
    )
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col select-none font-sans bg-card-bg"
      style={
        {
          '--team-accent': teamAccentColor,
          '--team-accent-rgb': hexToRgbString(teamAccentColor),
        } as React.CSSProperties
      }
    >
      {/* ── Header ── */}
      <header className="flex-shrink-0 px-4 py-3 bg-surface border-b border-surface-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg team-accent-bg overflow-hidden p-0.5">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={`${selectedTeam.label} logo`}
                  className="w-full h-full object-contain"
                  style={{ filter: 'brightness(0) invert(1) drop-shadow(0 0 2px rgba(0,0,0,0.5))' }}
                />
              ) : (
                <span className="font-black text-lg text-white">{selectedTeam.label[0]}</span>
              )}
            </div>
            <div>
              <h1 className="text-base font-black text-white tracking-tight">{selectedTeam.label.toUpperCase()}</h1>
              <p className="text-[11px] text-gray-400 font-semibold">
                {rosterData.allPlayers.some((p) => p.headshotUrl) ? '2026 ROSTER · 2025 STATS' : '2025 ROSTER DEPTH CHART'}
              </p>
            </div>
          </div>
          <CompositeHeader metrics={metrics} />
        </div>
      </header>

      {/* ── Team Selector ── */}
      <div className="flex-shrink-0 px-4 py-2 bg-surface border-b border-surface-border">
        <div className="mx-auto max-w-6xl flex items-center gap-2">
          <button
            type="button"
            onClick={openCompare}
            disabled={isLoading}
            title="Compare this team against another"
            className="rounded-md px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap flex-shrink-0 team-accent-bg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Team Comparison
          </button>
          <div className="flex-1" />
          <label htmlFor="team-select" className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">
            Team
          </label>
          <select
            id="team-select"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            className="rounded-md border border-surface-border bg-card-bg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 team-accent-ring"
          >
            {TEAMS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <nav className="flex-shrink-0 flex bg-surface border-b border-surface-border" role="tablist" aria-label="Roster views">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-[11px] font-bold relative transition-all ${tab === t.id ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
            {tab === t.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full team-accent-bg" />}
          </button>
        ))}
      </nav>

      {/* ── Depth toggle (formation tabs only) ── */}
      {isFormationTab && (
        <div className="flex-shrink-0 px-4 py-2.5 bg-surface border-b border-surface-border">
          <div className="mx-auto w-fit rounded-xl border border-surface-border bg-black/40 p-1">
            <div className="flex items-center gap-1" role="group" aria-label="Depth chart team">
              {depthModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  disabled={mode.disabled}
                  onClick={() => !mode.disabled && setDepthTeam(mode.id)}
                  title={mode.id === 'all' ? 'Full position-group depth' : undefined}
                  className={`min-w-[92px] rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    mode.disabled
                      ? 'text-gray-600 cursor-not-allowed'
                      : depthTeam === mode.id
                        ? 'team-accent-bg text-white'
                        : 'text-gray-400 hover:text-white'
                  }`}
                  aria-pressed={depthTeam === mode.id}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950">Loading roster data…</div>
      )}
      {loadError && (
        <div className="px-4 py-2 text-xs font-semibold text-red-300 bg-red-950">Failed to load data: {loadError}</div>
      )}
      {warnings.length > 0 && (
        <div className="px-4 py-2 text-xs font-semibold text-amber-300 bg-amber-950">{warnings.join(' · ')}</div>
      )}

      {/* ── Team data-coverage banner (honest provenance at a glance) ── */}
      {!isLoading && !loadError && rosterData.coverage.rosterCount > 0 && (() => {
        const c = rosterData.coverage
        const nonStub = Math.max(c.rosterCount - c.stubCount, 1)
        const pct = (n: number) => Math.round((n / nonStub) * 100)
        // "Recruited" = non-stub players carrying a real star rating (recruitingMatched
        // also counts empty/unrated records, which over-counts past 100%).
        const recruitedCount = allPlayers.filter((p) => !p.isStub && p.stars > 0).length
        // Golden-overlay counts: present only for pilot teams; derived from allPlayers
        // (coverage carries reconciliation counts but not these per-flag tallies).
        const walkOns = allPlayers.filter((p) => p.isWalkOn).length
        const newIn2026 = allPlayers.filter((p) => p.newIn2026).length
        const conflicts = allPlayers.filter((p) => p.conflictFields.length > 0).length
        const isGolden = walkOns > 0 || newIn2026 > 0 || conflicts > 0
        // C2: transfer-rating closure — how many transfers carry a real rating.
        const transfers = allPlayers.filter((p) => p.isTransfer && !p.isStub)
        const transfersRated = transfers.filter(
          (p) => p.isRated || p.stars > 0 || p.transferRating != null || p.compositeRating != null,
        ).length
        return (
          <div
            className="flex-shrink-0 px-4 py-1.5 text-[11px] font-semibold text-gray-400 bg-black/40 border-b border-surface-border flex items-center gap-3 flex-wrap"
            aria-label="Team data coverage"
          >
            <span className="text-white font-bold">{c.rosterCount} players</span>
            {isGolden && (
              <>
                <span>·</span>
                <span className="uppercase tracking-wide text-gray-300">2026 roster</span>
              </>
            )}
            <span>·</span>
            <span>{pct(recruitedCount)}% recruited</span>
            <span>·</span>
            <span>{pct(c.productionWithGames)}% with snaps</span>
            <span>·</span>
            <span>{c.rated} rated</span>
            {transfers.length > 0 && (
              <>
                <span>·</span>
                <span
                  className={transfersRated === transfers.length ? 'text-emerald-300/80' : undefined}
                  title="Incoming transfers carrying a recruiting/portal rating"
                >
                  {transfersRated}/{transfers.length} transfers rated
                </span>
              </>
            )}
            {walkOns > 0 && (
              <>
                <span>·</span>
                <span className="text-gray-500" title="On the roster, no recruiting signal in any source (genuine walk-on / unrated)">
                  {walkOns} walk-on/unrated
                </span>
              </>
            )}
            {newIn2026 > 0 && (
              <>
                <span>·</span>
                <span title="New on the 2026 roster — no 2025 production">{newIn2026} new</span>
              </>
            )}
            {conflicts > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-300/80" title="Players where sources disagreed on a field">
                  {conflicts} conflicts
                </span>
              </>
            )}
            {c.stubCount > 0 && (
              <>
                <span>·</span>
                <span className="text-gray-500">{c.stubCount} depth-only</span>
              </>
            )}
          </div>
        )
      })()}

      {/* ── Team returning-production strip (CFBD /player/returning) ── */}
      {!isLoading && !loadError && rosterData.returningProduction && (() => {
        const rp = rosterData.returningProduction!
        const pct = (n: number | null) => (n != null ? `${Math.round(n * 100)}%` : null)
        const parts: Array<[string, string | null]> = [
          ['overall', pct(rp.percentPPA)],
          ['passing', pct(rp.percentPassingPPA)],
          ['receiving', pct(rp.percentReceivingPPA)],
          ['rushing', pct(rp.percentRushingPPA)],
        ]
        const shown = parts.filter(([, v]) => v != null)
        if (shown.length === 0) return null
        return (
          <div
            className="flex-shrink-0 px-4 py-1.5 text-[11px] font-semibold text-gray-400 bg-black/40 border-b border-surface-border flex items-center gap-3 flex-wrap"
            aria-label="Team returning production"
            title="Share of last season's predicted-points-added (PPA) production returning this year"
          >
            <span className="text-white font-bold uppercase tracking-wide">Returning production</span>
            {shown.map(([label, value], i) => (
              <span key={label} className="flex items-center gap-3">
                {i > 0 && <span>·</span>}
                <span>
                  <span className="text-white font-bold">{value}</span> {label}
                </span>
              </span>
            ))}
          </div>
        )
      })()}

      {/* ── Main Content ── */}
      <main className="flex-1 relative">
        {isFormationTab && (
          <div className="absolute inset-0">
            {[...Array(11)].map((_, i) => (
              <div key={i} className="absolute w-full h-px bg-white/5" style={{ top: `${(i + 1) * 8}%` }} />
            ))}
          </div>
        )}
        <div className="relative">
          {tab === 'offense' && depthTeam === 'all' && (
            <PositionDepthView allPlayers={allPlayers} onPlayerClick={onPlayerClick} side="ALL_OFFENSE" />
          )}
          {tab === 'offense' && depthTeam !== 'all' && (
            <div className="py-3">
              <div className="mx-auto max-w-6xl rounded-2xl border border-gray-900 bg-black px-3 overflow-x-auto">
                <OffenseFormation offensiveStarters={visibleOffense} onPlayerClick={onPlayerClick} />
              </div>
            </div>
          )}
          {tab === 'defense' && depthTeam === 'all' && (
            <PositionDepthView allPlayers={allPlayers} onPlayerClick={onPlayerClick} side="ALL_DEFENSE" />
          )}
          {tab === 'defense' && depthTeam !== 'all' && (
            <div className="py-3">
              <div className="mx-auto max-w-6xl rounded-2xl border border-gray-900 bg-black px-3 overflow-x-auto">
                <DefenseFormation defensiveStarters={visibleDefense} onPlayerClick={onPlayerClick} />
              </div>
            </div>
          )}
          {tab === 'ratings' && (
            <RatingsView allPlayers={allPlayers} filters={filters} setFilters={setFilters} onPlayerClick={onPlayerClick} />
          )}
        </div>
      </main>

      {/* ── Footer legend (formation tabs) ── */}
      {isFormationTab && (
        <footer className="flex-shrink-0 py-2.5 px-4 bg-surface border-t border-surface-border">
          <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <Star filled size="w-3.5 h-3.5" />
              Recruit Stars
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-rs-purple">RS</span>
              Redshirt
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-portal-orange">PTL</span>
              Portal
            </span>
            <span>
              <span className="text-green-400 font-bold">FR</span> <span className="text-blue-400 font-bold">SO</span>{' '}
              <span className="text-amber-400 font-bold">JR</span> <span className="text-red-400 font-bold">SR</span>
            </span>
          </div>
        </footer>
      )}

      <PlayerModal player={selected} onClose={backToTeam} returnFocusEl={returnFocusEl} />
    </div>
  )
}
