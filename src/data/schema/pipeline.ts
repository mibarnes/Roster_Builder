import type { ClassYear, Side } from './common.ts'

/**
 * Canonical joined player produced by buildPlayerPipeline — one record per
 * roster player, enriched from recruiting / ratings / production by playerId.
 */
export interface PlayerRecord {
  playerId: string
  name: string
  number: number | null
  side: Side
  position: string
  classYear: ClassYear
  height: string | null
  weight: number | null
  isTransfer: boolean
  /** Placeholder injected from an OurLads depth slot with no CFBD roster match. */
  isStub: boolean
  recruiting: {
    stars: number | null
    /** 0–1 composite. */
    compositeRating: number | null
    nationalRank: number | null
    positionRank: number | null
    isTransfer: boolean
  }
  ratings: {
    /** Derived OVR (recruiting composite × 100, unranked → 70). */
    overall: number | null
    derived: boolean
  }
  production: Record<string, number>
  /** 0–1 fraction of sources that contributed real data for this player. */
  dataCompleteness: number
}

export interface SideMetrics {
  avgStarterComposite: number | null
  avgStarterOverall: number | null
  starterCount: number
}

export interface PipelineMetrics {
  team: SideMetrics
  offense: SideMetrics
  defense: SideMetrics
}

export interface SourceCoverage {
  matched: number
  unmatched: number
}

export interface PipelineCoverage {
  recruiting: SourceCoverage
  production: SourceCoverage
  /** Players that exist only as OurLads depth-chart stubs. */
  stubCount: number
  /** True when this team carries real CFBD data (vs mock fallback). */
  isReal: boolean
}

export interface DepthSlot {
  slot: string
  playerId: string | null
}

export interface PlayerPipeline {
  teamId: string
  /** 'bundled' = pre-collected JSON, 'mock' = synthetic, 'mock-fallback' = bundled load failed. */
  mode: 'bundled' | 'mock' | 'mock-fallback'
  players: PlayerRecord[]
  starters: { offense: PlayerRecord[]; defense: PlayerRecord[] }
  depthChart: { offense: DepthSlot[]; defense: DepthSlot[] }
  metrics: PipelineMetrics
  coverage: PipelineCoverage
  warnings: string[]
}
