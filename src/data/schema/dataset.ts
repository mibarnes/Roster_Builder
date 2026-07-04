import type {
  AdvancedSource,
  ContextSource,
  PlayerMasterSource,
  ProductionSource,
  RecruitingSource,
  RosterSource,
} from './index.ts'

/**
 * The per-team dataset the pipeline consumes, keyed by source. OVR is DERIVED
 * downstream (blended recruiting + production + class) — there is no independent
 * ratings source. `advanced` (usage/PPA) and `context` (team returning
 * production) are present only for the enriched pilot captures — undefined for
 * older partial teams.
 */
export interface DatasetBySource {
  roster: RosterSource
  recruiting: RecruitingSource
  production: ProductionSource
  advanced: AdvancedSource | undefined
  context: ContextSource | undefined
  /** Golden player-master (pilot-deepening round); present only for pilots. */
  master?: PlayerMasterSource
}

/** Envelope returned by loadDataset. */
export interface DatasetSummary {
  teamId: string
  datasetBySource: DatasetBySource
  warnings: string[]
}
