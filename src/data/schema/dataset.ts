import type {
  AdvancedSource,
  ContextSource,
  PlayerMasterSource,
  ProductionSource,
  RatingsSource,
  RecruitingSource,
  RosterSource,
} from './index.ts'

/**
 * The per-team dataset the pipeline consumes, keyed by source. Ratings is
 * optional/absent for real CFBD captures (OVR is derived downstream).
 * `advanced` (usage/PPA) and `context` (team returning production) are present
 * only for the enriched pilot captures — undefined for older partial teams.
 */
export interface DatasetBySource {
  roster: RosterSource
  recruiting: RecruitingSource
  production: ProductionSource
  ratings: RatingsSource | undefined
  advanced: AdvancedSource | undefined
  context: ContextSource | undefined
  /** Golden player-master (pilot-deepening round); present only for pilots. */
  master?: PlayerMasterSource
}

/** Honest data mode for a loaded dataset. */
export type DataMode = 'bundled' | 'mock' | 'mock-fallback'

/** Envelope returned by loadDataset. */
export interface DatasetSummary {
  teamId: string
  mode: DataMode
  datasetBySource: DatasetBySource
  warnings: string[]
}
