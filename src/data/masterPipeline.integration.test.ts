/**
 * Pipeline-from-master integration: pilots load the golden player-master.json
 * (ESPN 2026 spine) and the new golden fields surface all the way to the UIPlayer.
 * Asserts 100% spine coverage end-to-end + no dropped flagged players.
 */
import { loadTeamData } from './loadTeamData.ts'
import { loadPlayerPipeline } from './pipeline/loadPlayerPipeline.ts'
import { mapPipelineToUI } from './mapPipelineToUI.ts'
import { PlayerMasterSourceSchema } from './schema/index.ts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PILOTS = ['florida-gators', 'miami-hurricanes']

describe('master-backed pipeline (pilots)', () => {
  it.each(PILOTS)('%s: on-disk player-master.json validates + has 100% spine coverage', (teamId) => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), 'src/data/collected', teamId, 'player-master.json'), 'utf8'),
    )
    const master = PlayerMasterSourceSchema.parse(raw)
    expect(master.provenance.rosterSeason).toBe(2026)
    expect(master.provenance.productionSeason).toBe(2025)
    // Coverage guarantee: master ≥ spine; report self-consistent.
    expect(master.reconciliation.masterCount).toBe(master.players.length)
    expect(master.players.length).toBeGreaterThanOrEqual(master.reconciliation.spineCount)
    // Headshots present on a meaningful share (ESPN-only field).
    expect(master.reconciliation.headshotPct).toBeGreaterThan(50)
    // No secret leakage: no field literally named like an api key.
    expect(JSON.stringify(master)).not.toMatch(/CFBD_API_KEY|Bearer /)
  })

  it.each(PILOTS)('%s: loadTeamData adapts the master into the legacy DatasetBySource', async (teamId) => {
    const ds = await loadTeamData(teamId)
    expect(ds.master).toBeDefined()
    expect(ds.roster.season).toBe(2026)
    expect(ds.roster.players.length).toBeGreaterThan(100)
    // golden overlay fields rode onto the roster players.
    const withHeadshot = ds.roster.players.filter((p) => p.headshotUrl).length
    expect(withHeadshot).toBeGreaterThan(50)
    // context (team returning production) reconstructed for the banner.
    expect(ds.context).toBeDefined()
  })

  it('florida-gators: golden fields (headshot/HS/flags) surface to the UIPlayer', async () => {
    const { pipeline } = await loadPlayerPipeline('florida-gators', 'bundled')
    const ui = mapPipelineToUI(pipeline)

    // Every depth + roster player survived (no dropped flagged players).
    expect(ui.allPlayers.length).toBe(pipeline.players.length)

    // A known returning contributor carries a headshot + production season 2025.
    const lagway = ui.allPlayers.find((p) => p.name === 'DJ Lagway')!
    expect(lagway.headshotUrl).toContain('.png')
    expect(lagway.newIn2026).toBe(false)
    expect(lagway.unrated).toBe(false)
    expect(lagway.ovr).toBeGreaterThan(0) // rated

    // At least one new-2026 player exists and is flagged (transfers/freshmen).
    const newOnes = ui.allPlayers.filter((p) => p.newIn2026)
    expect(newOnes.length).toBeGreaterThan(0)

    // Some players carry HS (official overlay parsed for Florida).
    const withHs = ui.allPlayers.filter((p) => p.highSchool).length
    expect(withHs).toBeGreaterThan(0)

    // Conflict fields are an array (empty or populated) on every player.
    for (const p of ui.allPlayers) expect(Array.isArray(p.conflictFields)).toBe(true)
  })
})
