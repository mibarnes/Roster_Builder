const OFFENSE_SLOT_ORDER = ['LT', 'LG', 'C', 'RG', 'RT', 'WRX', 'SLOT', 'QB', 'RB', 'TE', 'WRZ'];
const DEFENSE_SLOT_ORDER = ['LDE', 'NT', 'DT', 'RDE', 'LCB', 'SS', 'WLB', 'MLB', 'NB', 'FS', 'RCB'];

const EMPTY_FORMATION = Object.freeze([]);

const SLOT_ALIASES = {
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
  S2: 'FS'
};

const STAT_ABBREVIATIONS = {
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
  starts: 'GS'
};

const normalizeSlot = (slot) => {
  const match = slot?.match(/^([A-Z]+)(\d+)?$/);
  if (!match) return { slot, depth: 1 };
  const base = SLOT_ALIASES[match[1]] ?? match[1];
  const depth = Number(match[2] ?? 1);
  return { slot: base, depth };
};

const toUiStats = (stats = {}) => {
  const uiStats = {};

  for (const [key, value] of Object.entries(stats)) {
    if (key === 'games' || value == null) continue;
    const statKey = STAT_ABBREVIATIONS[key] ?? key.toUpperCase();
    uiStats[statKey] = value;
  }

  return uiStats;
};

const toUiPlayer = (player, id) => ({
  id,
  name: player.bio.name,
  number: player.bio.number,
  pos: player.bio.position,
  year: player.bio.classYear,
  stars: player.recruiting.stars ?? 0,
  transferStars: player.recruiting.transferPortalStars ?? undefined,
  isTransfer: player.bio.isTransfer,
  composite: Number(((player.recruiting.compositeRating ?? 0) * 100).toFixed(1)),
  ht: player.bio.height,
  wt: player.bio.weight,
  ovr: player.ratings.overall ?? 0,
  stats: toUiStats(player.production.stats)
});

const buildFormation = (slots, order) => {
  const formation = Object.fromEntries(order.map((slot) => [slot, []]));

  for (const entry of slots) {
    const { slot } = normalizeSlot(entry.slot);
    if (!formation[slot] || !entry.player) continue;
    formation[slot].push(entry);
  }

  for (const slot of Object.keys(formation)) {
    formation[slot] = formation[slot]
      .sort((a, b) => normalizeSlot(a.slot).depth - normalizeSlot(b.slot).depth)
      .map((entry) => entry.player);
  }

  return formation;
};

export const mapPipelineToUI = (pipeline) => {
  const offenseFormation = buildFormation(pipeline?.depthChart?.offense ?? EMPTY_FORMATION, OFFENSE_SLOT_ORDER);
  const defenseFormation = buildFormation(pipeline?.depthChart?.defense ?? EMPTY_FORMATION, DEFENSE_SLOT_ORDER);

  let nextId = 1;
  const mapPlayersWithIds = (formation) =>
    Object.fromEntries(
      Object.entries(formation).map(([slot, players]) => [
        slot,
        players.map((player) => toUiPlayer(player, nextId++))
      ])
    );

  const offensiveStarters = mapPlayersWithIds(offenseFormation);
  const defensiveStarters = mapPlayersWithIds(defenseFormation);

  const allPlayers = [
    ...Object.values(offensiveStarters).flat().map((player) => ({ ...player, side: 'OFF' })),
    ...Object.values(defensiveStarters).flat().map((player) => ({ ...player, side: 'DEF' }))
  ];

  return { offensiveStarters, defensiveStarters, allPlayers };
};
