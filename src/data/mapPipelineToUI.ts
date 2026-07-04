/**
 * Pipeline → UI shape. Ported faithfully from the recovered
 * data/mapPipelineToUI.js (147 ln). Builds offense/defense formation maps
 * (slot → ordered players, starter first), applies slot-based position
 * overrides, and flattens every rostered player into allPlayers.
 */
import type { DepthChartEntry, PipelinePlayer, PlayerPipeline } from './schema/pipeline.ts'
import type { Formation, UIDataset, UIPlayer, UISide } from './schema/ui.ts'
import {
  DEFENSE_SLOT_ORDER,
  OFFENSE_SLOT_ORDER,
  SLOT_ALIASES,
  SLOT_POS_OVERRIDE,
} from './positions.ts'

const EMPTY_FORMATION: DepthChartEntry[] = []

export const STAT_ABBREVIATIONS: Record<string, string> = {
  // Legacy flattened keys (kept for backward-compat / mock data).
  passingYards: 'PAS',
  passingTD: 'PTD',
  interceptions: 'INT',
  qbr: 'RTG',
  rushingYards: 'RUSH',
  rushingTD: 'RTD',
  receptions: 'REC',
  receivingYards: 'RECYD',
  receivingTD: 'RECTD',
  tackles: 'TKL',
  sacks: 'SCK',
  tfl: 'TFL',
  forcedFumbles: 'FF',
  passBreakups: 'PD',
  starts: 'GS',
  // Nested CFBD production.stats keys (the real per-phase line). Distinct
  // abbreviations so passing/rushing/receiving phases never collapse.
  passCmpAtt: 'C/A',
  passYds: 'PYD',
  passTD: 'PTD',
  passINT: 'INT',
  rushAtt: 'CAR',
  rushYds: 'RYD',
  rushTD: 'RTD',
  rec: 'REC',
  recYds: 'RECYD',
  recTD: 'RECTD',
  soloTackles: 'SOLO',
  passDef: 'PD',
  defTD: 'DTD',
  fumbles: 'FUM',
  fumblesLost: 'FL',
  fumRec: 'FR',
}

const normalizeSlot = (slot: string): { slot: string; depth: number } => {
  const match = slot?.match(/^([A-Z]+)(\d+)?$/)
  if (!match) return { slot, depth: 1 }
  const base = SLOT_ALIASES[match[1] as string] ?? (match[1] as string)
  const depth = Number(match[2] ?? 1)
  return { slot: base, depth }
}

const toUiStats = (stats: Record<string, number> = {}): Record<string, number> => {
  const uiStats: Record<string, number> = {}

  for (const [key, value] of Object.entries(stats)) {
    if (key === 'games' || value == null) continue
    const statKey = STAT_ABBREVIATIONS[key] ?? key.toUpperCase()
    uiStats[statKey] = value
  }

  return uiStats
}

const toUiPlayer = (player: PipelinePlayer, id: number): UIPlayer => ({
  id,
  playerId: player.playerId,
  posRank: null,
  posGroupSize: 0,
  name: player.bio.name,
  number: player.bio.number,
  pos: player.bio.position,
  year: player.bio.classYear,
  side: player.bio.side,
  stars: player.recruiting.stars ?? 0,
  transferStars: player.recruiting.transferPortalStars ?? undefined,
  isTransfer: player.bio.isTransfer,
  fromSchool: player.recruiting.fromSchool ?? null,
  composite:
    player.recruiting.compositePercent ??
    (player.recruiting.compositeRating != null
      ? Number((player.recruiting.compositeRating * 100).toFixed(1))
      : 0),
  compositeRating: player.recruiting.compositeRating ?? null,
  transferRating: player.recruiting.transferRating ?? null,
  nationalRank: player.recruiting.nationalRank ?? null,
  positionRank: player.recruiting.positionRank ?? null,
  ht: player.bio.height,
  wt: player.bio.weight,
  // NR (overall === null) maps to 0 — the comparison stack's `ovr > 0`
  // convention treats 0 as unrated; isRated keeps the distinction explicit.
  ovr: player.ratings.overall ?? 0,
  isRated: player.ratings.overall != null,
  ratingMethod: player.ratings.method,
  confidence: player.ratings.confidence,
  ratingBreakdown: { ...player.ratings.breakdown },
  eligibilityRemaining: player.bio.eligibilityRemaining ?? null,
  stats: toUiStats(player.production.stats),
  games: player.production.games,
  usageOverall: player.advanced.usageOverall,
  ppaAll: player.advanced.ppaAll,
  usage: player.advanced.usage,
  ppa: player.advanced.ppa,
  perGame: player.production.perGame,
  hometown:
    player.hometown.city || player.hometown.state
      ? { city: player.hometown.city, state: player.hometown.state }
      : null,
  recruitMatchMethod: player.recruitMatchMethod,
  // ── C2: recruiting-source provenance ──
  recruitSource: player.recruiting.source ?? null,
  recruitedSchool: player.recruiting.recruitedSchool ?? null,
  recruitYear: player.recruiting.recruitYear ?? null,
  transferOrigin: player.recruiting.origin ?? player.recruiting.fromSchool ?? null,
  transferEligibility: player.recruiting.eligibility ?? null,
  isStub: player.isStub,
  // ── Golden-master overlay (null/false for legacy teams) ──
  headshotUrl: player.golden?.headshotUrl ?? null,
  highSchool: player.golden?.highSchool ?? null,
  previousSchool: player.golden?.previousSchool ?? null,
  isWalkOn: player.golden?.isWalkOn ?? false,
  newIn2026: player.golden?.newIn2026 ?? false,
  unrated: player.golden?.unrated ?? false,
  conflictFields: player.golden?.conflictFields ?? [],
  dataCompleteness: {
    hasRecruiting: player.dataCompleteness.hasRecruiting,
    hasProduction: player.dataCompleteness.hasProduction,
    matchedBy: player.recruitMatchMethod,
  },
})

const buildFormation = (
  slots: DepthChartEntry[],
  order: string[],
): Record<string, PipelinePlayer[]> => {
  const formation: Record<string, PipelinePlayer[]> = Object.fromEntries(
    order.map((slot) => [slot, [] as PipelinePlayer[]]),
  )
  // Track the original slot string per entry to sort by depth.
  const entrySlot = new Map<PipelinePlayer, string>()

  for (const entry of slots) {
    const { slot } = normalizeSlot(entry.slot)
    if (!formation[slot] || !entry.player) continue
    entrySlot.set(entry.player, entry.slot)
    formation[slot]!.push(entry.player)
  }

  for (const slot of Object.keys(formation)) {
    formation[slot] = formation[slot]!.sort(
      (a, b) =>
        normalizeSlot(entrySlot.get(a) ?? '').depth - normalizeSlot(entrySlot.get(b) ?? '').depth,
    )
  }

  return formation
}

export const mapPipelineToUI = (pipeline: PlayerPipeline): UIDataset => {
  const offenseFormation = buildFormation(
    pipeline?.depthChart?.offense ?? EMPTY_FORMATION,
    OFFENSE_SLOT_ORDER,
  )
  const defenseFormation = buildFormation(
    pipeline?.depthChart?.defense ?? EMPTY_FORMATION,
    DEFENSE_SLOT_ORDER,
  )

  let nextId = 1
  const mapPlayersWithIds = (formation: Record<string, PipelinePlayer[]>): Formation =>
    Object.fromEntries(
      Object.entries(formation).map(([slot, players]) => [
        slot,
        players.map((player) => toUiPlayer(player, nextId++)),
      ]),
    )

  const offensiveStarters = mapPlayersWithIds(offenseFormation)
  const defensiveStarters = mapPlayersWithIds(defenseFormation)

  // Apply slot-based position override so panels group players correctly.
  for (const [slot, players] of Object.entries(offensiveStarters)) {
    const override = SLOT_POS_OVERRIDE[slot]
    if (override) players.forEach((p) => (p.pos = override))
  }
  for (const [slot, players] of Object.entries(defensiveStarters)) {
    const override = SLOT_POS_OVERRIDE[slot]
    if (override) players.forEach((p) => (p.pos = override))
  }

  // allPlayers from the full pipeline list (not just depth chart), so Ratings
  // view shows every rostered player.
  const allPlayers: UIPlayer[] = (pipeline?.players ?? []).map((player) => {
    const ui = toUiPlayer(player, nextId++)
    const side: UISide =
      player.bio.side === 'OFF' ? 'OFF' : player.bio.side === 'DEF' ? 'DEF' : 'ST'
    return { ...ui, side }
  })

  // U7: within-team position rank — rank rated players by OVR inside their pos group.
  const byPos = new Map<string, UIPlayer[]>()
  for (const p of allPlayers) {
    const arr = byPos.get(p.pos)
    if (arr) arr.push(p)
    else byPos.set(p.pos, [p])
  }
  for (const group of byPos.values()) {
    group
      .filter((p) => p.isRated)
      .sort((a, b) => b.ovr - a.ovr)
      .forEach((p, i) => {
        p.posRank = i + 1
      })
    for (const p of group) p.posGroupSize = group.length
  }

  return {
    offensiveStarters,
    defensiveStarters,
    allPlayers,
    coverage: pipeline.coverage,
    returningProduction: pipeline.returningProduction ?? null,
  }
}
