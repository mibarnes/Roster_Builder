/**
 * Top-level data entry point the App consumes. Loads a team's dataset (honest
 * mode), runs the join engine, and returns the pipeline + provenance.
 */
import { loadDataset } from '../loadDataset.ts'
import { buildPlayerPipeline } from './buildPlayerPipeline.ts'
import type { PlayerPipeline } from '../schema/pipeline.ts'
import type { LeagueBaselines } from '../rating/ratingConfig.ts'
// League baselines (built offline by scripts/buildLeagueArtifacts.ts). Static
// import → OVR is z-scored against the LEAGUE, so cross-team comparison is honest.
import baselinesJson from '../collected/_baselines.json'

const LEAGUE_BASELINES = baselinesJson as unknown as LeagueBaselines

export interface LoadedPipeline {
  teamId: string
  pipeline: PlayerPipeline
  warnings: string[]
}

export async function loadPlayerPipeline(teamId: string): Promise<LoadedPipeline> {
  const summary = await loadDataset({ teamId })
  const pipeline = buildPlayerPipeline(summary.datasetBySource, LEAGUE_BASELINES)
  return {
    teamId: summary.teamId,
    pipeline,
    warnings: summary.warnings,
  }
}
