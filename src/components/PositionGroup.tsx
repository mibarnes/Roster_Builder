import PlayerCard from './PlayerCard.tsx'
import type { UIPlayer } from '../data/schema/ui.ts'

interface PositionGroupProps {
  players: UIPlayer[] | undefined
  onClick: (player: UIPlayer) => void
  baseDelay?: number
}

export default function PositionGroup({ players, onClick, baseDelay = 0 }: PositionGroupProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {(players ?? []).map((p, i) => (
        <PlayerCard key={p.id} player={p} isStarter={i === 0} onClick={onClick} delay={baseDelay + i * 60} />
      ))}
    </div>
  )
}
