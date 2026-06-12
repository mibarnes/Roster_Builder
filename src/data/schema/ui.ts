/**
 * Types describing the REAL output of mapPipelineToUI (ported faithfully from
 * the recovered data/mapPipelineToUI.js). Components consume this flat UIPlayer
 * shape; offensive/defensiveStarters are formation maps (slot → ordered players,
 * starter first), and allPlayers is every rostered player.
 */

/** A player's UI side. allPlayers may include 'ST' (special teams / neither). */
export type UISide = 'OFF' | 'DEF' | 'ST'

export interface UIPlayer {
  /** Sequential UI id (stable within a single map call). */
  id: number
  name: string
  number: number | null
  /** Display position (slot-overridden for formation players). */
  pos: string
  /** Class year string as carried from the pipeline (e.g. 'SR'); may be null. */
  year: string | null
  side: UISide
  stars: number
  transferStars: number | undefined
  isTransfer: boolean
  fromSchool: string | null
  /** Composite percent (0–100), one decimal. */
  composite: number
  compositeRating: number | null
  transferRating: number | null
  nationalRank: number | null
  positionRank: number | null
  ht: string | null
  wt: number | null
  /** Derived OVR (recruiting composite × 100, unranked → 70 upstream). */
  ovr: number
  eligibilityRemaining: number | null
  /** Abbreviated season stat line (PAS/YDS/TD/REC/TKL/…). */
  stats: Record<string, number>
}

/** Formation slot → ordered players (starter first, then backups). */
export type Formation = Record<string, UIPlayer[]>

/** Output of mapPipelineToUI. */
export interface UIDataset {
  offensiveStarters: Formation
  defensiveStarters: Formation
  allPlayers: UIPlayer[]
}
