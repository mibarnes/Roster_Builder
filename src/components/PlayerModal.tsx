import { useEffect, useRef } from 'react'
import Star from './Star.tsx'
import {
  getEffectiveStars,
  getOvrDisplay,
  getOvrDisplayColor,
  RATING_METHOD_LABEL,
} from '../utils/playerHelpers.ts'
import type { UIPlayer } from '../data/schema/ui.ts'

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
  const usagePct = player.usageOverall != null ? Math.round(player.usageOverall * 100) : null

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
                  <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-portal-orange">
                    PORTAL
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
              No 2025 season stats recorded
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
