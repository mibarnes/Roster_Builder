/**
 * FormationField — renders a data-driven FormationScheme (U9). Each scheme row
 * is a centered flex of equal-width cells; a cell is either that slot's
 * PositionGroup (players from the formation map) or a spacer holding a column
 * open. Replaces the hard-coded JSX arrangements in Offense/DefenseFormation.
 */
import PositionGroup from './PositionGroup.tsx'
import type { FormationScheme } from '../data/formations.ts'
import type { Formation, UIPlayer } from '../data/schema/ui.ts'

interface FormationFieldProps {
  scheme: FormationScheme
  formation: Formation
  onPlayerClick: (player: UIPlayer) => void
}

export default function FormationField({ scheme, formation, onPlayerClick }: FormationFieldProps) {
  let delay = 0
  return (
    <div className="w-max mx-auto flex flex-col justify-start gap-5 py-3 px-4">
      {scheme.rows.map((row, ri) => (
        <div key={ri} className="flex justify-center items-start gap-3">
          {row.map((cell, ci) => {
            if (!cell) return <div key={`sp-${ci}`} className="w-[100px] flex-shrink-0" aria-hidden="true" />
            delay += 80
            return (
              <PositionGroup
                key={cell.slot}
                players={formation[cell.slot]}
                onClick={onPlayerClick}
                baseDelay={delay}
                label={cell.label}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
