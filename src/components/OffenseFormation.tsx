import FormationField from './FormationField.tsx'
import { getOffenseScheme } from '../data/formations.ts'
import type { Formation, UIPlayer } from '../data/schema/ui.ts'

interface OffenseFormationProps {
  offensiveStarters: Formation
  onPlayerClick: (player: UIPlayer) => void
  /** Alignment scheme id (U9); defaults to the first offense scheme. */
  schemeId?: string
}

export default function OffenseFormation({ offensiveStarters, onPlayerClick, schemeId }: OffenseFormationProps) {
  return (
    <FormationField
      scheme={getOffenseScheme(schemeId ?? '')}
      formation={offensiveStarters}
      onPlayerClick={onPlayerClick}
    />
  )
}
