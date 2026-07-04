/**
 * Lazy per-team JSON loader (M4). Dynamic-imports the three collected source
 * files for a team, zod-validates each against the source schemas, and
 * assembles a DatasetBySource (OVR is derived downstream — there is no ratings
 * source; real CFBD captures ship no ratings.json).
 *
 * There is intentionally NO monolithic cfbdScaffoldData import — that path was
 * dropped in the hardened rebuild.
 */
import {
  AdvancedSourceSchema,
  ContextSourceSchema,
  PlayerMasterSourceSchema,
  ProductionSourceSchema,
  RecruitingSourceSchema,
  RosterSourceSchema,
} from './schema/index.ts'
import { masterToDatasetBySource } from './masterToDataset.ts'
import type { DatasetBySource } from './schema/dataset.ts'

// Vite resolves these globs at build time; the dynamic import picks one per team
// id, so only the requested team's JSON is fetched (true lazy loading).
const rosterModules = import.meta.glob('./collected/*/roster.json')
const recruitingModules = import.meta.glob('./collected/*/recruiting.json')
const productionModules = import.meta.glob('./collected/*/production.json')
// advanced/context are the E3 enrichment — present only for re-collected teams,
// so these loads are OPTIONAL (a missing file yields undefined, not a throw).
const advancedModules = import.meta.glob('./collected/*/advanced.json')
const contextModules = import.meta.glob('./collected/*/context.json')
// player-master is the pilot-deepening golden record — present only for pilots.
// When present it is the PREFERRED source (ESPN 2026 spine + reconciliation).
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

/** Like loadJson but returns null when the file isn't present (optional source). */
async function loadJsonOptional(
  modules: Record<string, () => Promise<unknown>>,
  teamId: string,
  file: string,
): Promise<unknown> {
  const key = `./collected/${teamId}/${file}`
  const loader = modules[key]
  if (!loader) return null
  const mod = (await loader()) as JsonModule
  return mod.default
}

export async function loadTeamData(teamId: string): Promise<DatasetBySource> {
  // ── Pilots: prefer the golden player-master.json (ESPN 2026 spine) ──
  const masterRaw = await loadJsonOptional(masterModules, teamId, 'player-master.json')
  if (masterRaw != null) {
    const master = PlayerMasterSourceSchema.parse(masterRaw)
    return masterToDatasetBySource(master)
  }

  // ── Legacy path (the 31 non-pilot teams still ship the old roster.json shape) ──
  const [rosterRaw, recruitingRaw, productionRaw, advancedRaw, contextRaw] = await Promise.all([
    loadJson(rosterModules, teamId, 'roster.json'),
    loadJson(recruitingModules, teamId, 'recruiting.json'),
    loadJson(productionModules, teamId, 'production.json'),
    loadJsonOptional(advancedModules, teamId, 'advanced.json'),
    loadJsonOptional(contextModules, teamId, 'context.json'),
  ])

  const roster = RosterSourceSchema.parse(rosterRaw)
  const recruiting = RecruitingSourceSchema.parse(recruitingRaw)
  const production = ProductionSourceSchema.parse(productionRaw)
  const advanced = advancedRaw != null ? AdvancedSourceSchema.parse(advancedRaw) : undefined
  const context = contextRaw != null ? ContextSourceSchema.parse(contextRaw) : undefined

  return { roster, recruiting, production, advanced, context }
}
