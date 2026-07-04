import PlayerCard from './PlayerCard.tsx'
import type { UIPlayer } from '../data/schema/ui.ts'

interface PositionGroupProps {
  players: UIPlayer[] | undefined
  onClick: (player: UIPlayer) => void
  baseDelay?: number
  /** Position label for the slot — renders a labeled placeholder when empty (U11). */
  label?: string
}

export default function PositionGroup({ players, onClick, baseDelay = 0, label }: PositionGroupProps) {
  const list = players ?? []
  return (
    <div className="flex flex-col items-center gap-1">
      {list.length === 0 && label ? (
        <div
          className="w-[90px] h-[92px] rounded-[10px] border border-dashed border-[#2a2a2a] flex items-center justify-center text-[11px] font-bold text-gray-600 select-none"
          aria-label={`${label} — no player`}
          title={`${label} — no player assigned`}
        >
          {label}
        </div>
      ) : (
        list.map((p, i) => (
          <PlayerCard key={p.id} player={p} isStarter={i === 0} onClick={onClick} delay={baseDelay + i * 60} />
        ))
      )}
    </div>
  )
}
