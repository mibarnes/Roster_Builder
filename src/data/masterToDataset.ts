/**
 * Adapter: golden `player-master.json` → the legacy `DatasetBySource` the
 * pipeline consumes. Lets `buildPlayerPipeline` keep working unchanged for
 * pilots (master) AND non-pilots (legacy roster.json) — only the data SOURCE
 * differs. The golden-only fields (headshot, highSchool, previousSchool,
 * walk-on/new-2026/unrated/conflict flags) ride along on the roster players +
 * an attached `master` reference for downstream UI mapping.
 */
import type { DatasetBySource } from './schema/dataset.ts'
import type {
  AdvancedSource,
  ContextSource,
  PlayerMasterSource,
  ProductionSource,
  RecruitingSource,
  RosterPlayer,
  RosterSource,
} from './schema/index.ts'
import { safePosition } from './positions.ts'

/** A DatasetBySource carrying the original master for golden-field access. */
export interface MasterDataset extends DatasetBySource {
  master: PlayerMasterSource
}

const sideOf = (s: string | null): 'OFF' | 'DEF' | 'ST' =>
  s === 'DEF' ? 'DEF' : s === 'ST' ? 'ST' : 'OFF'

const CLASS = new Set(['FR', 'SO', 'JR', 'SR'])
const safeClass = (c: string | null): string | null => (c && CLASS.has(c) ? c : null)

export function masterToDatasetBySource(master: PlayerMasterSource): MasterDataset {
  // ── roster (from golden fields; carries the new overlay fields) ──
  const players: RosterPlayer[] = master.players.map((m) => {
    const conflictFields = Object.keys(m).filter((k) => {
      const f = (m as Record<string, unknown>)[k] as { _meta?: { conflict?: boolean } } | undefined
      return f && typeof f === 'object' && '_meta' in f && f._meta?.conflict === true
    })
    return {
      playerId: m.playerId,
      name: m.name,
      number: m.jersey.value ?? null,
      side: sideOf(m.side.value),
      position: safePosition(m.position.value),
      classYear: safeClass(m.classYear.value),
      isRedshirt: m.flags.isRedshirt,
      height: m.height.value ?? null,
      weight: m.weight.value ?? null,
      eligibilityRemaining: null,
      isTransfer: m.flags.isTransfer,
      homeCity: m.hometown.value ? m.hometown.value.split(',')[0]!.trim() : null,
      homeState: m.homeState.value ?? null,
      homeLat: null,
      homeLon: null,
      headshotUrl: m.headshotUrl.value,
      highSchool: m.highSchool.value,
      previousSchool: m.previousSchool.value,
      hometownText: m.hometown.value,
      isWalkOn: m.flags.isWalkOn,
      newIn2026: m.flags.newIn2026,
      unrated: m.flags.unrated,
      conflictFields,
    }
  })

  const roster: RosterSource = {
    sourceId: 'cfbd-roster-v2',
    sourceType: 'roster',
    team: master.team,
    season: master.provenance.rosterSeason,
    players,
    depthChart: master.depthChart,
    depthChartMeta: master.depthChartMeta,
  }

  // ── recruiting (from golden recruiting summary; id-keyed) ──
  const recruiting: RecruitingSource = {
    sourceId: 'master-recruiting-v1',
    sourceType: 'recruiting',
    team: master.team,
    playerRecruitProfiles: master.players.map((m) => ({
      playerId: m.playerId,
      name: m.name,
      stars: m.recruiting.stars,
      compositeRating: m.recruiting.compositeRating,
      nationalRank: m.recruiting.nationalRank,
      positionRank: m.recruiting.positionRank,
      transferPortalStars: m.recruiting.transferPortalStars ?? null,
      transferRating: m.recruiting.transferRating ?? null,
      fromSchool: m.recruiting.fromSchool ?? null,
      isTransfer: m.flags.isTransfer,
      matchMethod:
        m.recruiting.matchMethod === 'on3' ? 'name-fuzzy' : m.recruiting.matchMethod,
      // ── C2: full-spine precedence provenance (for the UI source label) ──
      source: m.recruiting.recruitSource ?? null,
      recruitedSchool: m.recruiting.recruitedSchool ?? null,
      recruitYear: m.recruiting.recruitYear ?? null,
      origin: m.recruiting.origin ?? null,
      eligibility: m.recruiting.eligibility ?? null,
    })),
  }

  // ── production (CFBD 2025; id-keyed) ──
  const production: ProductionSource = {
    sourceId: 'master-production-v1',
    sourceType: 'production',
    team: master.team,
    season: master.provenance.productionSeason,
    playerProduction: master.players
      .filter((m) => m.production.season != null)
      .map((m) => ({
        playerId: m.playerId,
        name: m.name,
        games: m.production.games ?? 0,
        stats: m.production.stats,
        ...(m.production.perGame && m.production.perGame.length
          ? { perGame: m.production.perGame }
          : {}),
      })),
  }

  // ── advanced (full usage/ppa splits; id-keyed) ──
  const advanced: AdvancedSource = {
    sourceId: 'master-advanced-v1',
    sourceType: 'advanced',
    team: master.team,
    playerAdvanced: master.players
      .filter((m) => m.advanced.usage || m.advanced.ppa)
      .map((m) => ({
        playerId: m.playerId,
        name: m.name,
        usage: m.advanced.usage ?? undefined,
        ppa: m.advanced.ppa ?? undefined,
      })),
  }

  // ── context (team returning production) — reconstructed for the UI banner ──
  const context: ContextSource = {
    sourceId: 'master-context-v1',
    sourceType: 'context',
    team: master.team,
    season: master.provenance.productionSeason,
    returningProduction: master.returningProduction,
  }

  return { roster, recruiting, production, advanced, ratings: undefined, context, master }
}
