/**
 * Pipeline → UI shape. Ported faithfully from the recovered
 * data/mapPipelineToUI.js (147 ln). Builds offense/defense formation maps
 * (slot → ordered players, starter first), applies slot-based position
 * overrides, and flattens every rostered player into allPlayers.
 */
import type { DepthChartEntry, PipelinePlayer, PlayerPipeline } from './schema/pipeline.ts'
import type { Formation, UIDataset, UIPlayer, UISide } from './schema/ui.ts'

const OFFENSE_SLOT_ORDER = ['LT', 'LG', 'C', 'RG', 'RT', 'WRX', 'SLOT', 'QB', 'RB', 'TE', 'WRZ']
const DEFENSE_SLOT_ORDER = ['LDE', 'NT', 'DT', 'RDE', 'LCB', 'SS', 'WLB', 'MLB', 'NB', 'FS', 'RCB']

const EMPTY_FORMATION: DepthChartEntry[] = []

const SLOT_ALIASES: Record<string, string> = {
  WR1: 'WRX',
  WR2: 'WRZ',
  WR3: 'SLOT',
  DE1: 'LDE',
  DE2: 'RDE',
  DT1: 'NT',
  DT2: 'DT',
  LB1: 'WLB',
  LB2: 'MLB',
  LB3: 'NB',
  CB1: 'LCB',
  CB2: 'RCB',
  S1: 'SS',
  S2: 'FS',
}

// Override display position based on the depth-chart slot a player occupies.
// Resolves the CFBD broad-code problem (all DBs stored as 'DB') using slot as
// ground truth.
const SLOT_POS_OVERRIDE: Record<string, string> = {
  SS: 'S',
  FS: 'S',
  LCB: 'CB',
  RCB: 'CB',
  NB: 'NB',
  LDE: 'DE',
  RDE: 'DE',
  NT: 'NT',
  DT: 'DT',
  WLB: 'LB',
  MLB: 'LB',
}

const STAT_ABBREVIATIONS: Record<string, string> = {
  passingYards: 'PAS',
  passingTD: 'TD',
  interceptions: 'INT',
  qbr: 'RTG',
  rushingYards: 'YDS',
  rushingTD: 'TD',
  receptions: 'REC',
  receivingYards: 'YDS',
  receivingTD: 'TD',
  tackles: 'TKL',
  sacks: 'SCK',
  tfl: 'TFL',
  forcedFumbles: 'FF',
  passBreakups: 'PD',
  starts: 'GS',
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
  ovr: player.ratings.overall ?? 0,
  eligibilityRemaining: player.bio.eligibilityRemaining ?? null,
  stats: toUiStats(player.production.stats),
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

  return { offensiveStarters, defensiveStarters, allPlayers }
}
