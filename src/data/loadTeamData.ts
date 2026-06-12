/**
 * Lazy per-team JSON loader (M4). Dynamic-imports the three collected source
 * files for a team, zod-validates each against the source schemas, and
 * assembles a DatasetBySource (ratings is always undefined — OVR is derived
 * downstream; real CFBD captures ship no ratings.json).
 *
 * There is intentionally NO monolithic cfbdScaffoldData import — that path was
 * dropped in the hardened rebuild.
 */
import {
  ProductionSourceSchema,
  RecruitingSourceSchema,
  RosterSourceSchema,
} from './schema/index.ts'
import type { DatasetBySource } from './schema/dataset.ts'

// Vite resolves these globs at build time; the dynamic import picks one per team
// id, so only the requested team's JSON is fetched (true lazy loading).
const rosterModules = import.meta.glob('./collected/*/roster.json')
const recruitingModules = import.meta.glob('./collected/*/recruiting.json')
const productionModules = import.meta.glob('./collected/*/production.json')

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
  const [rosterRaw, recruitingRaw, productionRaw] = await Promise.all([
    loadJson(rosterModules, teamId, 'roster.json'),
    loadJson(recruitingModules, teamId, 'recruiting.json'),
    loadJson(productionModules, teamId, 'production.json'),
  ])

  const roster = RosterSourceSchema.parse(rosterRaw)
  const recruiting = RecruitingSourceSchema.parse(recruitingRaw)
  const production = ProductionSourceSchema.parse(productionRaw)

  return { roster, recruiting, production, ratings: undefined }
}
