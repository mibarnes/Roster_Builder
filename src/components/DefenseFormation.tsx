import FormationField from './FormationField.tsx'
import { getDefenseScheme } from '../data/formations.ts'
import type { Formation, UIPlayer } from '../data/schema/ui.ts'

interface DefenseFormationProps {
  defensiveStarters: Formation
  onPlayerClick: (player: UIPlayer) => void
  /** Alignment scheme id (U9); defaults to the first defense scheme. */
  schemeId?: string
}

export default function DefenseFormation({ defensiveStarters, onPlayerClick, schemeId }: DefenseFormationProps) {
  return (
    <FormationField
      scheme={getDefenseScheme(schemeId ?? '')}
      formation={defensiveStarters}
      onPlayerClick={onPlayerClick}
    />
  )
}
