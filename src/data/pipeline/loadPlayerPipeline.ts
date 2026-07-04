/**
 * Top-level data entry point the App consumes. Loads a team's dataset (honest
 * mode), runs the join engine, and returns the pipeline + provenance.
 */
import { loadDataset } from '../loadDataset.ts'
import { buildPlayerPipeline } from './buildPlayerPipeline.ts'
import type { PlayerPipeline } from '../schema/pipeline.ts'

export interface LoadedPipeline {
  teamId: string
  pipeline: PlayerPipeline
  warnings: string[]
}

export async function loadPlayerPipeline(teamId: string): Promise<LoadedPipeline> {
  const summary = await loadDataset({ teamId })
  const pipeline = buildPlayerPipeline(summary.datasetBySource)
  return {
    teamId: summary.teamId,
    pipeline,
    warnings: summary.warnings,
  }
}
