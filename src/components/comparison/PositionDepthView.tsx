/**
 * Grid of per-position-group scrollable depth panels. Ported from the recovered
 * PositionDepthView.jsx and adapted to the current UIPlayer contract + the shared
 * positionGrouping helpers. Used by App's depth "all" mode.
 *
 * HONEST-PARTIAL: players whose OVR is purely derived (no real recruiting
 * composite, `composite <= 0`) are visually distinguished — the OVR pill is
 * muted and tagged "EST" so a derived 70-floor never reads as a real rating.
 * Empty groups render a clear "No data" state rather than a blank panel.
 */
import { useRef } from 'react'
import Star from '../Star.tsx'
import { getEffectiveStars, getOvrColor, getClassColor } from '../../utils/playerHelpers.ts'
import {
  groupPlayersBySide,
  isDerivedOnly,
  type DepthGroupDef,
  type DepthSide,
} from './positionGrouping.ts'
import type { UIPlayer } from '../../data/schema/ui.ts'

interface PanelProps {
  group: DepthGroupDef
  players: UIPlayer[]
  onPlayerClick: (player: UIPlayer) => void
  compact?: boolean
}

function PositionPanel({ group, players, onPlayerClick, compact = false }: PanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col bg-card-bg rounded-2xl border border-gray-800 overflow-hidden min-h-0">
      <div className="flex-shrink-0 px-3 py-2 team-accent-bg flex items-center justify-between">
        <span className="text-[11px] font-black text-white uppercase tracking-widest">{group.label}</span>
        <span className="text-[10px] text-white/60 font-semibold">{players.length} players</span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-y-auto divide-y divide-gray-900/50"
        style={compact ? { maxHeight: '240px' } : { maxHeight: '380px' }}
      >
        {players.length === 0 && (
          <div className="py-6 text-center text-[11px] text-gray-600 font-medium">No data</div>
        )}
        {players.map((player, rank) => {
          const stars = getEffectiveStars(player)
          const classYear = player.year?.replace('RS ', '') ?? ''
          const derived = isDerivedOnly(player)
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onPlayerClick(player)}
              className={`w-full flex items-center ${compact ? 'gap-1.5 px-2 py-1.5' : 'gap-2.5 px-3 py-2.5'} text-left hover:bg-gray-900/60 active:bg-gray-800 transition-colors`}
            >
              <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-black text-gray-600 w-4 flex-shrink-0`}>
                {rank + 1}
              </span>
              <div
                className={`${compact ? 'w-7 h-7 text-[9px]' : 'w-9 h-9 text-sm'} rounded-xl flex items-center justify-center font-black flex-shrink-0 ${derived ? 'bg-gray-800' : 'team-accent-bg'}`}
                style={{ color: derived ? '#6b7280' : getOvrColor(player.ovr) }}
                title={derived ? 'Estimated — no recruiting rating' : undefined}
              >
                {player.ovr > 0 ? player.ovr : '—'}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
                  <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-bold text-white truncate`}>
                    {player.name}
                  </span>
                  {derived && (
                    <span
                      className={`${compact ? 'text-[6px]' : 'text-[7px]'} font-black text-gray-300 px-1.5 py-0.5 rounded-full bg-gray-700 flex-shrink-0`}
                      title="Estimated OVR — no recruiting composite"
                    >
                      EST
                    </span>
                  )}
                  {player.isTransfer && (
                    <span
                      className={`${compact ? 'text-[6px]' : 'text-[7px]'} font-black text-white px-1.5 py-0.5 rounded-full bg-portal-orange flex-shrink-0`}
                    >
                      PTL
                    </span>
                  )}
                  {player.year?.includes('RS') && (
                    <span
                      className={`${compact ? 'text-[6px]' : 'text-[7px]'} font-black text-white px-1.5 py-0.5 rounded-full bg-rs-purple flex-shrink-0`}
                    >
                      RS
                    </span>
                  )}
                </div>
                <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'} mt-0.5`}>
                  <span className={`${compact ? 'text-[7px]' : 'text-[9px]'} font-bold`} style={{ color: getClassColor(classYear) }}>
                    {classYear}
                  </span>
                  {player.number != null && (
                    <span className={`${compact ? 'text-[7px]' : 'text-[9px]'} text-gray-500`}>#{player.number}</span>
                  )}
                  {player.fromSchool && (
                    <span className="text-[8px] text-orange-400 font-semibold truncate max-w-[60px]">{player.fromSchool}</span>
                  )}
                  {!player.fromSchool && stars > 0 && (
                    <div className="flex gap-0.5">
                      {[...Array(stars)].map((_, i) => (
                        <Star key={i} filled size={compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`${compact ? 'text-[9px]' : 'text-[12px]'} font-black text-white`}>
                  {player.composite > 0 ? player.composite.toFixed(1) : '—'}
                </div>
                <div className="text-[8px] text-gray-600 uppercase">COMP</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface PositionDepthViewProps {
  allPlayers: UIPlayer[]
  onPlayerClick: (player: UIPlayer) => void
  side: DepthSide
  compact?: boolean
}

export default function PositionDepthView({ allPlayers, onPlayerClick, side, compact = false }: PositionDepthViewProps) {
  const grouped = groupPlayersBySide(allPlayers, side)
  const anyPlayers = grouped.some((g) => g.players.length > 0)

  return (
    <div className="h-full overflow-y-auto py-3 px-3">
      {!anyPlayers && (
        <div className="mx-auto max-w-md mt-8 rounded-xl border border-surface-border bg-card-bg px-4 py-6 text-center">
          <div className="text-sm font-black text-white">Limited depth data</div>
          <div className="text-[11px] text-gray-400 mt-1">
            No {side === 'ALL_OFFENSE' ? 'offensive' : 'defensive'} players found for this team.
          </div>
        </div>
      )}
      <div
        className={
          compact
            ? 'grid grid-cols-3 gap-9 mx-auto max-w-6xl px-6 py-2'
            : 'grid grid-cols-2 lg:grid-cols-4 gap-3 mx-auto max-w-6xl'
        }
      >
        {grouped.map(({ group, players }) => (
          <PositionPanel key={group.label} group={group} players={players} onPlayerClick={onPlayerClick} compact={compact} />
        ))}
      </div>
    </div>
  )
}
