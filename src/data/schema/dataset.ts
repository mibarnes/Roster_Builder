import type {
  ProductionSource,
  RatingsSource,
  RecruitingSource,
  RosterSource,
} from './index.ts'

/**
 * The per-team dataset the pipeline consumes, keyed by source. Ratings is
 * optional/absent for real CFBD captures (OVR is derived downstream).
 */
export interface DatasetBySource {
  roster: RosterSource
  recruiting: RecruitingSource
  production: ProductionSource
  ratings: RatingsSource | undefined
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
