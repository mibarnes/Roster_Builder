/**
 * Pure position-group bucketing for PositionDepthView. Extracted so the grouping
 * logic is unit-testable. A player belongs to a group iff its display `pos`
 * (already slot-overridden by mapPipelineToUI) is in the group's position list.
 */
import type { UIPlayer } from '../../data/schema/ui.ts'

export interface DepthGroupDef {
  label: string
  positions: string[]
}

export const OFFENSE_GROUPS: readonly DepthGroupDef[] = [
  { label: 'QB', positions: ['QB'] },
  { label: 'RB', positions: ['RB'] },
  { label: 'WR', positions: ['WR'] },
  { label: 'TE', positions: ['TE'] },
  { label: 'OL', positions: ['LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG'] },
]

export const DEFENSE_GROUPS: readonly DepthGroupDef[] = [
  { label: 'DL', positions: ['DE', 'DT', 'NT', 'DL'] },
  { label: 'LB', positions: ['LB'] },
  { label: 'CB', positions: ['CB'] },
  { label: 'S', positions: ['S'] },
  { label: 'NB', positions: ['NB'] },
  { label: 'DB', positions: ['DB'] },
]

/** Players in a group, OVR-descending. */
export const playersInGroup = (group: DepthGroupDef, players: UIPlayer[]): UIPlayer[] =>
  players.filter((p) => group.positions.includes(p.pos)).sort((a, b) => b.ovr - a.ovr)

export type DepthSide = 'ALL_OFFENSE' | 'ALL_DEFENSE'

/** Returns a label→players map for the given side, used by the depth grid. */
export const groupPlayersBySide = (
  allPlayers: UIPlayer[],
  side: DepthSide,
): Array<{ group: DepthGroupDef; players: UIPlayer[] }> => {
  const groups = side === 'ALL_OFFENSE' ? OFFENSE_GROUPS : DEFENSE_GROUPS
  const sideKey = side === 'ALL_OFFENSE' ? 'OFF' : 'DEF'
  const sidePlayers = allPlayers.filter((p) => p.side === sideKey)
  return groups.map((group) => ({ group, players: playersInGroup(group, sidePlayers) }))
}

/** A player whose OVR is purely derived (no real recruiting composite). */
export const isDerivedOnly = (player: UIPlayer): boolean => player.composite <= 0
