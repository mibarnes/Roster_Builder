import { useEffect, useRef } from 'react'
import Star from './Star.tsx'
import Headshot from './Headshot.tsx'
import {
  getConflictTitle,
  getEffectiveStars,
  getOvrDisplay,
  getOvrDisplayColor,
  RATING_METHOD_LABEL,
} from '../utils/playerHelpers.ts'
import { STAT_ABBREVIATIONS } from '../data/mapPipelineToUI.ts'
import type { UIPlayer } from '../data/schema/ui.ts'

/** Per-game column header label — reuse the season abbreviation map, else upper-case. */
const perGameColLabel = (key: string): string => STAT_ABBREVIATIONS[key] ?? key.toUpperCase()

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Stat labels shown per-game where applicable (counting stats that scale with
// availability). Covers both the new nested abbreviations and legacy keys.
const PER_GAME_STATS = new Set([
  'REC', 'YDS', 'PAS', 'TKL', 'SCK', 'TD', 'ATT', 'TFL', 'PD',
  'PYD', 'RYD', 'RECYD', 'CAR', 'SOLO', 'PTD', 'RTD', 'RECTD',
])

interface StatCardProps {
  label: string
  value: number | undefined
  perGame: string | null
}

function StatCard({ label, value, perGame }: StatCardProps) {
  return (
    <div className="text-center bg-black rounded-xl py-2.5 px-1">
      <div className="text-xl font-black text-white">{value ?? '—'}</div>
      {perGame != null && <div className="text-[9px] text-emerald-400 font-bold">{perGame}/G</div>}
      <div className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5">{label}</div>
    </div>
  )
}

interface SubScoreProps {
  label: string
  value: number | null
  weight: number
}

/** One recruiting/production/class sub-score chip in the rating breakdown. */
function SubScore({ label, value, weight }: SubScoreProps) {
  return (
    <div className="text-center bg-black rounded-xl py-2 px-1">
      <div className="text-lg font-black text-white">{value != null ? Math.round(value) : '—'}</div>
      <div className="text-[8px] text-gray-400 uppercase font-semibold mt-0.5">{label}</div>
      <div className="text-[8px] text-gray-600 font-semibold">{Math.round(weight * 100)}%</div>
    </div>
  )
}

interface PlayerModalProps {
  player: UIPlayer | null
  onClose: () => void
  returnFocusEl: HTMLElement | null
}

export default function PlayerModal({ player, onClose, returnFocusEl }: PlayerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!player || !modalRef.current) return

    const focusables = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    const firstFocusable = focusables[0] ?? modalRef.current
    firstFocusable.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const current = modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      if (!current.length) {
        event.preventDefault()
        modalRef.current?.focus()
        return
      }
      const first = current[0]!
      const last = current[current.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      returnFocusEl?.focus?.()
    }
  }, [player, onClose, returnFocusEl])

  if (!player) return null

  const stats = player.stats ?? {}
  const stars = getEffectiveStars(player)
  // Real games count drives the per-game (/G) path (previously dead — no games).
  const gamesPlayed = player.games && player.games > 0 ? player.games : null
  const hasStats = Object.keys(stats).length > 0

  const statEntries = Object.entries(stats).filter(([k]) => k !== 'GP')
  const statCards = statEntries.map(([key, val]) => ({
    label: key,
    value: val,
    perGame: gamesPlayed && PER_GAME_STATS.has(key) ? (val / gamesPlayed).toFixed(1) : null,
  }))

  const ovrText = getOvrDisplay(player)
  const methodLabel = RATING_METHOD_LABEL[player.ratingMethod]
  const bd = player.ratingBreakdown
  const hometownLabel = player.hometown
    ? [player.hometown.city, player.hometown.state].filter(Boolean).join(', ')
    : null
  const hasConflict = player.conflictFields.length > 0
  // New-in-2026 players carry no 2025 CFBD production — surface an honest empty state.
  const noProductionNew = player.newIn2026 && !hasStats
  // Bio rows surfaced from the golden-master overlay (only when present).
  const bioRows: Array<[string, string]> = [
    ...(player.highSchool ? ([['High School', player.highSchool]] as Array<[string, string]>) : []),
    ...(player.isTransfer && player.previousSchool
      ? ([['Previous School', player.previousSchool]] as Array<[string, string]>)
      : []),
    ...(hometownLabel ? ([['Hometown', hometownLabel]] as Array<[string, string]>) : []),
  ]
  const usagePct = player.usageOverall != null ? Math.round(player.usageOverall * 100) : null

  // ── H1.2: full usage / PPA detail (only present for players with an advanced row) ──
  const usage = player.usage
  const ppaAvg = player.ppa?.averagePPA ?? null
  const ppaTotal = player.ppa?.totalPPA ?? null
  const fmtPct = (n: number | null | undefined): string | null =>
    n != null ? `${Math.round(n * 100)}%` : null
  const fmtPpa = (n: number | null | undefined): string | null =>
    n != null ? n.toFixed(2) : null
  const usageSplits: Array<[string, string | null]> = (
    usage
      ? ([
          ['Pass', fmtPct(usage.pass)],
          ['Rush', fmtPct(usage.rush)],
          ['1st Dn', fmtPct(usage.firstDown)],
          ['2nd Dn', fmtPct(usage.secondDown)],
          ['3rd Dn', fmtPct(usage.thirdDown)],
          ['Std Dn', fmtPct(usage.standardDowns)],
          ['Pass Dn', fmtPct(usage.passingDowns)],
        ] as Array<[string, string | null]>)
      : []
  ).filter(([, v]) => v != null)
  const ppaSplits: Array<[string, string | null, string | null]> = (
    ppaAvg || ppaTotal
      ? ([
          ['All', fmtPpa(ppaAvg?.all), fmtPpa(ppaTotal?.all)],
          ['Pass', fmtPpa(ppaAvg?.pass), fmtPpa(ppaTotal?.pass)],
          ['Rush', fmtPpa(ppaAvg?.rush), fmtPpa(ppaTotal?.rush)],
        ] as Array<[string, string | null, string | null]>)
      : []
  ).filter(([, avg, total]) => avg != null || total != null)
  const hasUsageDetail = usageSplits.length > 0
  const hasPpaDetail = ppaSplits.length > 0

  // ── H1.3: per-game log table. Columns = the union of stat keys this player
  // actually recorded, in first-seen order; one row per game (ordered as stored). ──
  const perGame = player.perGame ?? null
  const perGameColumns: string[] = perGame
    ? (() => {
        const seen: string[] = []
        for (const g of perGame) {
          for (const k of Object.keys(g.stats)) if (!seen.includes(k)) seen.push(k)
        }
        return seen
      })()
    : []
  const hasPerGame = perGame != null && perGame.length > 0 && perGameColumns.length > 0
  const ppaTone = (v: number) => (v >= 0 ? 'text-emerald-400' : 'text-red-400')

  const classYear = player.year?.replace('RS ', '') ?? ''
  const isRS = player.year?.includes('RS') ?? false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl bg-card-bg border-2 team-accent-border shadow-[0_30px_60px_rgba(0,0,0,0.8)] animate-[modalSlideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 p-5 bg-surface border-b border-surface-border">
          <button
            onClick={onClose}
            aria-label="Close player details"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white/80 hover:text-white hover:bg-gray-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            <Headshot url={player.headshotUrl} name={player.name} fallback={player.pos} size={72} className="flex-shrink-0" />
            <div
              className={`w-[72px] h-[72px] rounded-2xl flex flex-col items-center justify-center font-black text-white shadow-xl team-accent-bg flex-shrink-0 ${player.isRated ? 'text-3xl' : 'text-xl'}`}
              style={{ color: getOvrDisplayColor(player) }}
              title={player.isRated ? `Overall ${player.ovr} (${methodLabel})` : 'Not rated'}
            >
              {ovrText}
              {!player.isRated && <span className="text-[8px] font-bold tracking-wide mt-0.5 opacity-80">UNRATED</span>}
            </div>
            <div className="min-w-0">
              <h2 id="player-modal-title" className="text-xl font-black text-white tracking-tight leading-tight">
                {player.name?.toUpperCase() ?? '—'}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-gray-400 text-sm font-semibold">
                  #{player.number} • {player.pos}
                </span>
                <span
                  className={`text-xs font-bold ${classYear === 'FR' ? 'text-green-400' : classYear === 'SO' ? 'text-blue-400' : classYear === 'JR' ? 'text-amber-400' : classYear ? 'text-red-400' : 'text-gray-400'}`}
                >
                  {classYear}
                </span>
                {isRS && (
                  <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-rs-purple">RS</span>
                )}
                {player.isTransfer && (
                  <span
                    className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-portal-orange"
                    title={player.previousSchool ?? player.fromSchool ?? 'Transfer'}
                  >
                    {player.fromSchool ? `TRANSFER · ${player.fromSchool}` : 'TRANSFER'}
                  </span>
                )}
                {player.newIn2026 && (
                  <span
                    className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-sky-600"
                    title="New on the 2026 roster — no 2025 production"
                  >
                    NEW 2026
                  </span>
                )}
                {player.isWalkOn && (
                  <span
                    className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-gray-500"
                    title="Walk-on — on the roster, no recruiting record"
                  >
                    WALK-ON
                  </span>
                )}
                {hasConflict && (
                  <span
                    className="text-[9px] font-bold text-amber-200 bg-amber-900/50 ring-1 ring-amber-400/30 px-2 py-0.5 rounded-full"
                    title={getConflictTitle(player.conflictFields)}
                  >
                    ⚑ conflict
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 flex-wrap">
                <span>{player.ht}</span>
                <span>•</span>
                <span>{player.wt ? `${player.wt} lbs` : '—'}</span>
                {hometownLabel && (
                  <>
                    <span>•</span>
                    <span title="Hometown">{hometownLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* ── Rating breakdown (blended OVR provenance) ── */}
          <div className="bg-gray-900 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 uppercase font-semibold">Overall Rating</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: getOvrDisplayColor(player) }}
              >
                {methodLabel}
              </span>
            </div>
            {player.isRated ? (
              <div className="grid grid-cols-3 gap-2">
                <SubScore label="Recruiting" value={bd.recruiting} weight={bd.weights.recruiting} />
                <SubScore label="Production" value={bd.production} weight={bd.weights.production} />
                <SubScore label="Class" value={bd.class} weight={bd.weights.class} />
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 font-medium">
                No recruiting or production signal — rated NR rather than a fabricated number.
              </p>
            )}
          </div>

          {/* ── Bio (golden-master overlay: HS / previous school / hometown) ── */}
          {bioRows.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-3 space-y-1.5">
              <div className="text-[11px] text-gray-400 uppercase font-semibold mb-1">Bio</div>
              {bioRows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide flex-shrink-0">
                    {label}
                  </span>
                  <span className="text-[12px] text-white font-semibold text-right">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Advanced usage / efficiency (CFBD) ── */}
          {(usagePct != null || player.ppaAll != null) && (
            <div className="bg-gray-900 rounded-xl p-3">
              <div className="text-[11px] text-gray-400 uppercase font-semibold mb-2">Advanced (2025)</div>
              <div className="grid grid-cols-2 gap-2">
                {usagePct != null && (
                  <div className="text-center bg-black rounded-xl py-2.5">
                    <div className="text-xl font-black text-white">{usagePct}%</div>
                    <div className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5" title="Snap-share involvement">
                      Usage
                    </div>
                  </div>
                )}
                {player.ppaAll != null && (
                  <div className="text-center bg-black rounded-xl py-2.5">
                    <div className={`text-xl font-black ${player.ppaAll >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {player.ppaAll.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5" title="Predicted points added per play">
                      PPA/Play
                    </div>
                  </div>
                )}
              </div>

              {/* ── H1.2: usage by situation ── */}
              {hasUsageDetail && (
                <div className="mt-3">
                  <div className="text-[9px] text-gray-500 uppercase font-bold mb-1.5 tracking-wide">
                    Usage by situation
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {usageSplits.map(([label, value]) => (
                      <div key={label} className="text-center bg-black rounded-lg py-1.5">
                        <div className="text-sm font-black text-white">{value}</div>
                        <div className="text-[8px] text-gray-400 uppercase font-semibold mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── H1.2: PPA splits (avg + total, all/pass/rush) ── */}
              {hasPpaDetail && (
                <div className="mt-3">
                  <div className="grid grid-cols-3 gap-1.5 text-[8px] text-gray-500 uppercase font-bold mb-1 tracking-wide">
                    <span>PPA</span>
                    <span className="text-right">Avg</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="space-y-1">
                    {ppaSplits.map(([label, avg, total]) => (
                      <div key={label} className="grid grid-cols-3 gap-1.5 items-center bg-black rounded-lg px-2 py-1.5">
                        <span className="text-[10px] text-gray-300 font-semibold">{label}</span>
                        <span className={`text-right text-[11px] font-black ${avg != null ? ppaTone(Number(avg)) : 'text-gray-600'}`}>
                          {avg ?? '—'}
                        </span>
                        <span className={`text-right text-[11px] font-black ${total != null ? ppaTone(Number(total)) : 'text-gray-600'}`}>
                          {total ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Provenance flags ── */}
          {(player.isStub || player.recruitMatchMethod === 'name-fuzzy' || !player.dataCompleteness.hasProduction) && (
            <div className="flex flex-wrap gap-2">
              {player.isStub && (
                <span className="text-[9px] font-bold text-gray-300 bg-gray-700/60 px-2 py-1 rounded-full">
                  Depth-chart only
                </span>
              )}
              {!player.isStub && player.recruitMatchMethod === 'name-fuzzy' && (
                <span className="text-[9px] font-bold text-yellow-300 bg-yellow-900/40 px-2 py-1 rounded-full">
                  Fuzzy-matched recruiting
                </span>
              )}
              {!player.isStub && !player.dataCompleteness.hasProduction && (
                <span className="text-[9px] font-bold text-gray-400 bg-gray-800/60 px-2 py-1 rounded-full">
                  No production data
                </span>
              )}
            </div>
          )}

          {player.isTransfer && player.fromSchool && (
            <div className="bg-orange-950/40 border border-orange-700/40 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Transfer from</span>
              <span className="text-white font-bold text-sm">{player.fromSchool}</span>
            </div>
          )}

          <div className="bg-gray-900 rounded-xl p-3 space-y-2">
            <div className="text-[11px] text-gray-400 uppercase font-semibold">Recruiting</div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-0.5" aria-label={`${stars} out of 5 stars`}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} filled={i < stars} size="w-5 h-5" />
                ))}
              </div>
              {player.isTransfer && player.transferRating != null && (
                <span className="text-[11px] font-bold text-orange-300">
                  T-Score: {(player.transferRating * 100).toFixed(0)}
                </span>
              )}
              {!player.isTransfer && player.compositeRating != null && (
                <span className="text-[11px] font-bold text-blue-300">
                  Composite: {(player.compositeRating * 100).toFixed(0)}
                </span>
              )}
            </div>
            {(player.nationalRank || player.positionRank) && (
              <div className="flex gap-4 text-[11px] text-gray-400">
                {player.nationalRank && (
                  <span>
                    National: <span className="text-white font-bold">#{player.nationalRank}</span>
                  </span>
                )}
                {player.positionRank && (
                  <span>
                    {player.pos}: <span className="text-white font-bold">#{player.positionRank}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-900 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase font-semibold">Composite Score</span>
              <span className="text-2xl font-black text-white">
                {player.composite > 0 ? player.composite.toFixed(1) : '—'}
              </span>
            </div>
            {player.composite > 0 && (
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full team-accent-bg transition-[width] duration-500 ease-out"
                  style={{ width: `${player.composite}%` }}
                />
              </div>
            )}
          </div>

          {hasStats && (
            <div className="bg-gray-900 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">2025 Season Stats</span>
                {gamesPlayed && <span className="text-[10px] text-gray-500">{gamesPlayed} games</span>}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {statCards.map(({ label, value, perGame }) => (
                  <StatCard key={label} label={label} value={value} perGame={perGame} />
                ))}
              </div>
            </div>
          )}

          {!hasStats && (
            <div className="bg-gray-900/40 rounded-xl px-3 py-4 text-center text-[11px] text-gray-600 font-medium">
              {noProductionNew ? 'No 2025 data (new in 2026)' : 'No 2025 season stats recorded'}
            </div>
          )}

          {/* ── H1.3: per-game log table ── */}
          {hasPerGame && (
            <div className="bg-gray-900 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">Game Log</span>
                <span className="text-[10px] text-gray-500">{perGame!.length} games</span>
              </div>
              <div className="max-h-48 overflow-auto rounded-lg border border-surface-border">
                <table className="w-full text-[10px] border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface">
                    <tr>
                      <th className="text-left font-bold text-gray-400 uppercase px-2 py-1.5 whitespace-nowrap">Gm</th>
                      {perGameColumns.map((col) => (
                        <th key={col} className="text-right font-bold text-gray-400 uppercase px-2 py-1.5 whitespace-nowrap" title={col}>
                          {perGameColLabel(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perGame!.map((g, i) => (
                      <tr key={String(g.gameId)} className={i % 2 === 0 ? 'bg-black/40' : 'bg-black/20'}>
                        <td className="text-left text-gray-400 font-semibold px-2 py-1 whitespace-nowrap">{i + 1}</td>
                        {perGameColumns.map((col) => {
                          const v = g.stats[col]
                          return (
                            <td key={col} className="text-right text-white font-semibold px-2 py-1 whitespace-nowrap">
                              {v != null ? v : '·'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
