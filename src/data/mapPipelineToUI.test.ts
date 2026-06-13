import { buildPlayerPipeline } from './pipeline/buildPlayerPipeline.ts'
import { mapPipelineToUI } from './mapPipelineToUI.ts'
import type { DatasetBySource } from './schema/dataset.ts'

const dataset = {
  roster: {
    sourceId: 'cfbd-roster-v1',
    sourceType: 'roster',
    season: 2025,
    players: [
      { playerId: 'CFBD-1', name: 'Quint Back', number: 1, side: 'OFF', position: 'QB', classYear: 'JR', isTransfer: false },
      { playerId: 'CFBD-2', name: 'Corner Back', number: 2, side: 'DEF', position: 'DB', classYear: 'SO', isTransfer: false },
      { playerId: 'CFBD-3', name: 'Bench Warmer', number: 3, side: 'OFF', position: 'WR', classYear: 'FR', isTransfer: false },
    ],
    // CB1 → canonical LCB; slot override turns DB into CB display position.
    depthChart: { offense: { QB: 'CFBD-1' }, defense: { LCB: 'CFBD-2' } },
  },
  recruiting: {
    sourceId: '247-v1',
    sourceType: 'recruiting',
    playerRecruitProfiles: [
      { playerId: 'CFBD-1', name: 'Quint Back', stars: 5, compositeRating: 0.98 },
      { playerId: 'CFBD-2', name: 'Corner Back', stars: 4, compositeRating: 0.9 },
    ],
  },
  production: {
    sourceId: 'cfbd-prod-v1',
    sourceType: 'production',
    season: 2025,
    playerProduction: [
      // Nested stats line (real CFBD shape) + games + perGame → production path.
      {
        playerId: 'CFBD-1',
        name: 'Quint Back',
        games: 12,
        stats: { passYds: 3200, passTD: 30 },
        perGame: [
          { gameId: '111', stats: { passYds: 280, passTD: 3 } },
          { gameId: '222', stats: { passYds: 310, passTD: 2 } },
        ],
      },
    ],
  },
  advanced: {
    sourceId: 'cfbd-adv-v1',
    sourceType: 'advanced',
    playerAdvanced: [
      {
        playerId: 'CFBD-1',
        name: 'Quint Back',
        usage: { overall: 0.85, pass: 0.9, rush: 0.1, thirdDown: 0.8 },
        ppa: { averagePPA: { all: 0.45, pass: 0.5 }, totalPPA: { all: 12.3, pass: 11.1 } },
      },
    ],
  },
  context: {
    sourceId: 'cfbd-context-v1',
    sourceType: 'context',
    returningProduction: { percentPPA: 0.55, percentPassingPPA: 0.73 },
  },
  ratings: undefined,
} as unknown as DatasetBySource

describe('mapPipelineToUI', () => {
  const pipeline = buildPlayerPipeline(dataset)
  const ui = mapPipelineToUI(pipeline)

  it('builds offense + defense formation maps with starters in slots', () => {
    expect(ui.offensiveStarters.QB).toHaveLength(1)
    expect(ui.offensiveStarters.QB![0]!.name).toBe('Quint Back')
    // LCB slot populated; pos overridden to CB.
    expect(ui.defensiveStarters.LCB).toHaveLength(1)
    expect(ui.defensiveStarters.LCB![0]!.pos).toBe('CB')
    // Empty slots present as empty arrays (formation skeleton).
    expect(ui.offensiveStarters.RB).toEqual([])
  })

  it('emits allPlayers for every rostered player with UI side', () => {
    expect(ui.allPlayers).toHaveLength(3)
    const qb = ui.allPlayers.find((p) => p.name === 'Quint Back')!
    expect(qb.side).toBe('OFF')
    // QB has recruiting (0.98) AND production (games + nested stats + usage/ppa)
    // → blended, a real rated number (not the old flat composite×100).
    expect(qb.isRated).toBe(true)
    expect(qb.ratingMethod).toBe('blended')
    expect(qb.ovr).toBeGreaterThan(40)
    expect(qb.composite).toBe(98) // compositePercent
    expect(qb.stars).toBe(5)
    // Advanced + games threaded through to the UI player.
    expect(qb.games).toBe(12)
    expect(qb.usageOverall).toBe(0.85)
    expect(qb.ppaAll).toBe(0.45)
    // H1.2: full usage + PPA detail.
    expect(qb.usage).not.toBeNull()
    expect(qb.usage!.pass).toBe(0.9)
    expect(qb.usage!.thirdDown).toBe(0.8)
    expect(qb.ppa!.averagePPA!.pass).toBe(0.5)
    expect(qb.ppa!.totalPPA!.all).toBe(12.3)
    // H1.3: per-game log threaded.
    expect(qb.perGame).not.toBeNull()
    expect(qb.perGame!).toHaveLength(2)
    expect(qb.perGame![0]!.stats.passYds).toBe(280)
    const cb = ui.allPlayers.find((p) => p.name === 'Corner Back')!
    expect(cb.side).toBe('DEF')
    // CB has no advanced/perGame rows → all the detail fields are null.
    expect(cb.usage).toBeNull()
    expect(cb.ppa).toBeNull()
    expect(cb.perGame).toBeNull()
  })

  it('H1.1: threads the team returning-production summary onto the UI dataset', () => {
    expect(ui.returningProduction).not.toBeNull()
    expect(ui.returningProduction!.percentPPA).toBe(0.55)
    expect(ui.returningProduction!.percentPassingPPA).toBe(0.73)
    // Absent splits stay null (honest), never fabricated.
    expect(ui.returningProduction!.percentRushingPPA).toBeNull()
  })

  it('threads team coverage onto the UI dataset', () => {
    expect(ui.coverage.rosterCount).toBe(3)
    expect(ui.coverage.recruitingMatched).toBe(2)
    expect(ui.coverage.productionWithGames).toBe(1)
    expect(ui.coverage.advancedMatched).toBe(1)
    expect(ui.coverage.rated).toBeGreaterThanOrEqual(2)
  })

  it('assigns unique sequential ids across formations and allPlayers', () => {
    const ids = [
      ...Object.values(ui.offensiveStarters).flat(),
      ...Object.values(ui.defensiveStarters).flat(),
      ...ui.allPlayers,
    ].map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
