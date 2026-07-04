/**
 * Lazy per-team loader. Every team ships a golden `player-master.json` (the ESPN
 * 2026 spine + multi-source reconciliation), so that is the ONE data path: this
 * dynamic-imports the requested team's master, zod-validates it, and adapts it to
 * a DatasetBySource via `masterToDatasetBySource`. OVR is derived downstream (there
 * is no ratings source; real captures ship no ratings.json).
 *
 * The legacy 3-file path (roster/production/recruiting.json) was retired in D1 once
 * all teams became golden — `masterToDataset` is a complete superset of what it
 * produced. There is intentionally NO monolithic scaffold import.
 */
import { PlayerMasterSourceSchema } from './schema/index.ts'
import { masterToDatasetBySource } from './masterToDataset.ts'
import type { DatasetBySource } from './schema/dataset.ts'

// Vite resolves this glob at build time; the dynamic import picks one per team id,
// so only the requested team's master is fetched (true lazy loading).
const masterModules = import.meta.glob('./collected/*/player-master.json')

type JsonModule = { default: unknown }

async function loadJson(
  modules: Record<string, () => Promise<unknown>>,
  teamId: string,
  file: string,
): Promise<unknown> {
  const key = `./collected/${teamId}/${file}`
  const loader = modules[key]
  if (!loader) throw new Error(`No ${file} for team "${teamId}" (looked for ${key})`)
  const mod = (await loader()) as JsonModule
  return mod.default
}

export async function loadTeamData(teamId: string): Promise<DatasetBySource> {
  const masterRaw = await loadJson(masterModules, teamId, 'player-master.json')
  const master = PlayerMasterSourceSchema.parse(masterRaw)
  return masterToDatasetBySource(master)
}
