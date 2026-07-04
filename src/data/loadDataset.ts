/**
 * Per-team dataset loader. Every team ships a real golden `player-master.json`, so
 * there is a single honest path: validate the team id, load + adapt the master via
 * `loadTeamData`, cache by team id. A load failure propagates (App surfaces it via
 * its error boundary) — there is no synthetic/mock fallback.
 */
import { loadTeamData } from './loadTeamData.ts'
import { requireTeam } from './teamRegistry.ts'
import type { DatasetSummary } from './schema/dataset.ts'

const cache = new Map<string, DatasetSummary>()

export interface LoadDatasetOptions {
  teamId: string
}

export async function loadDataset({ teamId }: LoadDatasetOptions): Promise<DatasetSummary> {
  // Validate the team id (throws on unknown) so callers fail loudly, not silently.
  requireTeam(teamId)

  const cached = cache.get(teamId)
  if (cached) return cached

  const datasetBySource = await loadTeamData(teamId)
  const payload: DatasetSummary = { teamId, datasetBySource, warnings: [] }
  cache.set(teamId, payload)
  return payload
}
