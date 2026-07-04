import PositionGroup from './PositionGroup.tsx'
import type { Formation, UIPlayer } from '../data/schema/ui.ts'

const offensiveLineSlots = ['LT', 'LG', 'C', 'RG', 'RT']

interface OffenseFormationProps {
  offensiveStarters: Formation
  onPlayerClick: (player: UIPlayer) => void
}

export default function OffenseFormation({ offensiveStarters, onPlayerClick }: OffenseFormationProps) {
  return (
    <div className="w-max mx-auto flex flex-col justify-start gap-5 py-3 px-4">
      <div className="flex justify-center gap-3">
        {offensiveLineSlots.map((slot, i) => (
          <PositionGroup key={slot} players={offensiveStarters[slot]} onClick={onPlayerClick} baseDelay={i * 80} />
        ))}
        <PositionGroup players={offensiveStarters.TE} onClick={onPlayerClick} baseDelay={400} />
      </div>

      <div className="grid grid-cols-6 items-start gap-3">
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.WRX} onClick={onPlayerClick} baseDelay={480} />
        </div>
        <div />
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.QB} onClick={onPlayerClick} baseDelay={560} />
        </div>
        <div />
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.SLOT} onClick={onPlayerClick} baseDelay={640} />
        </div>
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.WRZ} onClick={onPlayerClick} baseDelay={720} />
        </div>
      </div>

      <div className="grid grid-cols-6 items-start gap-3">
        <div />
        <div />
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.RB} onClick={onPlayerClick} baseDelay={800} />
        </div>
        <div />
        <div />
        <div />
      </div>
    </div>
  )
}
