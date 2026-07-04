/**
 * Honest data-mode loader (M4). Two modes:
 *  - 'bundled' (default): real per-team JSON via loadTeamData.
 *  - 'mock': a tiny synthetic team (pilots never use this).
 * On a bundled load failure we DON'T silently pretend — we fall back to the
 * minimal mock and surface mode 'mock-fallback' + a visible warning.
 *
 * Mode is read from VITE_DATA_MODE (default 'bundled'), overridable per call.
 */
import { loadTeamData } from './loadTeamData.ts'
import { requireTeam } from './teamRegistry.ts'
import type { DataMode, DatasetBySource, DatasetSummary } from './schema/dataset.ts'
import type {
  ProductionSource,
  RecruitingSource,
  RosterSource,
} from './schema/index.ts'

const cache = new Map<string, DatasetSummary>()

const getDataMode = (mode?: DataMode): DataMode =>
  mode ?? (import.meta.env?.VITE_DATA_MODE as DataMode | undefined) ?? 'bundled'

/** A minimal honest synthetic team — used for 'mock' and as the fallback. */
function buildMockDataset(teamId: string): DatasetBySource {
  const roster: RosterSource = {
    sourceId: 'mock-roster-v1',
    sourceType: 'roster',
    team: teamId,
    season: 2025,
    players: [
      {
        playerId: 'mock-qb',
        name: 'Mock Quarterback',
        number: 1,
        side: 'OFF',
        position: 'QB',
        classYear: 'JR',
        height: "6'2\"",
        weight: 210,
        isTransfer: false,
      },
      {
        playerId: 'mock-cb',
        name: 'Mock Cornerback',
        number: 2,
        side: 'DEF',
        position: 'DB',
        classYear: 'SO',
        height: "6'0\"",
        weight: 190,
        isTransfer: false,
      },
    ],
    depthChart: {
      offense: { QB: 'mock-qb' },
      defense: { CB1: 'mock-cb' },
    },
  }
  const recruiting: RecruitingSource = {
    sourceId: 'mock-recruiting-v1',
    sourceType: 'recruiting',
    team: teamId,
    playerRecruitProfiles: [
      { playerId: 'mock-qb', name: 'Mock Quarterback', stars: 4, compositeRating: 0.9 },
      { playerId: 'mock-cb', name: 'Mock Cornerback', stars: 3, compositeRating: 0.85 },
    ],
  }
  const production: ProductionSource = {
    sourceId: 'mock-production-v1',
    sourceType: 'production',
    season: 2025,
    playerProduction: [
      { playerId: 'mock-qb', name: 'Mock Quarterback', YDS: 2500, TD: 20 },
      { playerId: 'mock-cb', name: 'Mock Cornerback', TKL: 45, INT: 2 },
    ],
  }
  return { roster, recruiting, production, advanced: undefined, context: undefined }
}

export interface LoadDatasetOptions {
  teamId: string
  mode?: DataMode
}

export async function loadDataset({ teamId, mode }: LoadDatasetOptions): Promise<DatasetSummary> {
  const resolvedMode = getDataMode(mode)
  // Validate the team id (throws on unknown) so callers fail loudly, not silently.
  requireTeam(teamId)
  const cacheKey = `${resolvedMode}:${teamId}`

  const cached = cache.get(cacheKey)
  if (cached) return cached

  if (resolvedMode === 'mock') {
    const payload: DatasetSummary = {
      teamId,
      mode: 'mock',
      datasetBySource: buildMockDataset(teamId),
      warnings: ['Mock data mode — synthetic team, not real data.'],
    }
    cache.set(cacheKey, payload)
    return payload
  }

  try {
    const datasetBySource = await loadTeamData(teamId)
    const payload: DatasetSummary = {
      teamId,
      mode: 'bundled',
      datasetBySource,
      warnings: [],
    }
    cache.set(cacheKey, payload)
    return payload
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const payload: DatasetSummary = {
      teamId,
      mode: 'mock-fallback',
      datasetBySource: buildMockDataset(teamId),
      warnings: [`Bundled load failed for "${teamId}", fell back to mock: ${message}`],
    }
    cache.set(cacheKey, payload)
    return payload
  }
}
