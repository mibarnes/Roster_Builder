import type { ClassYear, Side } from './common.ts'

/** Player shape consumed by the React components (formations, cards, modal, ratings). */
export interface UIPlayer {
  /** Sequential UI id (stable within a render). */
  id: string
  playerId: string
  name: string
  lastName: string
  number: number | null
  side: Side
  /** Canonical UI slot/position (e.g. 'WR1', 'LCB', 'QB'). */
  position: string
  positionGroup: string
  classYear: ClassYear
  isRedshirt: boolean
  isTransfer: boolean
  isStub: boolean
  ovr: number | null
  stars: number | null
  compositeRating: number | null
  nationalRank: number | null
  positionRank: number | null
  height: string | null
  weight: number | null
  /** Abbreviated season stat line for the modal/list. */
  stats: Record<string, number>
}

export interface UIDataset {
  teamId: string
  mode: PlayerPipelineMode
  offensiveStarters: UIPlayer[]
  defensiveStarters: UIPlayer[]
  allPlayers: UIPlayer[]
  /** Formation slot → ordered players (starter first). */
  offenseFormation: Record<string, UIPlayer[]>
  defenseFormation: Record<string, UIPlayer[]>
  warnings: string[]
}

export type PlayerPipelineMode = 'bundled' | 'mock' | 'mock-fallback'
