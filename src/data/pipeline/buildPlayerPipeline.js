const toMap = (items = []) =>
  new Map(items.filter((item) => item?.playerId).map((item) => [item.playerId, item]));

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

const normalizeName = (value = '') =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,'’`\-]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !NAME_SUFFIXES.has(token))
    .join(' ');

const levenshtein = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

const similarity = (a, b) => {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
};

const buildSourceLookup = (items = []) => {
  const byId = toMap(items);
  const byName = new Map();

  for (const item of items) {
    if (!item?.name) continue;
    const key = normalizeName(item.name);
    if (!key || byName.has(key)) continue;
    byName.set(key, item);
  }

  return { byId, byName };
};

const resolveSourceRecord = (rosterPlayer, lookup) => {
  const byId = lookup?.byId ?? new Map();
  const byName = lookup?.byName ?? new Map();

  const byIdMatch = byId.get(rosterPlayer.playerId);
  if (byIdMatch) return { record: byIdMatch, matchedBy: 'id' };

  const rosterName = normalizeName(rosterPlayer.name);
  if (!rosterName || !byName.size) return { record: null, matchedBy: null };

  const exact = byName.get(rosterName);
  if (exact) return { record: exact, matchedBy: 'name-exact' };

  let best = null;
  const rosterLastToken = rosterName.split(' ').slice(-1)[0];

  for (const [candidateName, candidate] of byName.entries()) {
    if (candidateName.split(' ').slice(-1)[0] !== rosterLastToken) continue;
    const score = similarity(rosterName, candidateName);
    if (score < 0.82) continue;
    if (!best || score > best.score) best = { candidate, score };
  }

  if (best) return { record: best.candidate, matchedBy: 'name-fuzzy' };
  return { record: null, matchedBy: null };
};

const toPercent = (compositeRating) =>
  typeof compositeRating === 'number' ? Number((compositeRating * 100).toFixed(1)) : null;

const average = (values) => {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

const collectStarterIds = (depthChart = {}) => {
  const starterSlots = [];
  const sideEntries = [
    ['offense', depthChart?.offense],
    ['defense', depthChart?.defense]
  ];

  for (const [side, slots] of sideEntries) {
    for (const [slot, playerId] of Object.entries(slots ?? {})) {
      if (!playerId) continue;
      starterSlots.push({ side: side.toUpperCase(), slot, playerId });
    }
  }

  return starterSlots;
};

const buildStarterMetrics = (starters, playerMap) => {
  const teamComposite = [];
  const offenseComposite = [];
  const defenseComposite = [];
  const teamOverall = [];

  for (const starter of starters) {
    const player = playerMap.get(starter.playerId);
    if (!player) continue;

    if (typeof player.recruiting.compositePercent === 'number') {
      teamComposite.push(player.recruiting.compositePercent);
      if (starter.side === 'OFFENSE') offenseComposite.push(player.recruiting.compositePercent);
      if (starter.side === 'DEFENSE') defenseComposite.push(player.recruiting.compositePercent);
    }

    if (typeof player.ratings.overall === 'number') {
      teamOverall.push(player.ratings.overall);
    }
  }

  return {
    team: {
      avgStarterComposite: average(teamComposite),
      avgStarterOverall: average(teamOverall),
      starterCount: starters.length
    },
    offense: {
      avgStarterComposite: average(offenseComposite),
      starterCount: starters.filter((item) => item.side === 'OFFENSE').length
    },
    defense: {
      avgStarterComposite: average(defenseComposite),
      starterCount: starters.filter((item) => item.side === 'DEFENSE').length
    }
  };
};

const buildDepthChartView = (depthChart, playerMap) => {
  return {
    offense: Object.entries(depthChart?.offense ?? {}).map(([slot, playerId]) => ({
      slot,
      playerId,
      player: playerMap.get(playerId) ?? null
    })),
    defense: Object.entries(depthChart?.defense ?? {}).map(([slot, playerId]) => ({
      slot,
      playerId,
      player: playerMap.get(playerId) ?? null
    }))
  };
};

export const buildPlayerPipeline = (datasetBySource) => {
  const rosterPlayers = datasetBySource?.roster?.players ?? [];
  const recruitingLookup = buildSourceLookup(datasetBySource?.recruiting?.playerRecruitProfiles);
  const ratingsLookup = buildSourceLookup(datasetBySource?.ratings?.playerRatings);
  const productionLookup = buildSourceLookup(datasetBySource?.production?.playerProduction);

  const recruitingMap = recruitingLookup.byId;
  const ratingsMap = ratingsLookup.byId;
  const productionMap = productionLookup.byId;

  const players = rosterPlayers.map((rosterPlayer) => {
    const recruitingResolved = resolveSourceRecord(rosterPlayer, recruitingLookup);
    const ratingsResolved = resolveSourceRecord(rosterPlayer, ratingsLookup);
    const productionResolved = resolveSourceRecord(rosterPlayer, productionLookup);

    const recruiting = recruitingResolved.record ?? {};
    const ratings = ratingsResolved.record ?? {};
    const production = productionResolved.record ?? {};

    return {
      playerId: rosterPlayer.playerId,
      bio: {
        name: rosterPlayer.name,
        number: rosterPlayer.number,
        side: rosterPlayer.side,
        position: rosterPlayer.position,
        classYear: rosterPlayer.classYear,
        height: rosterPlayer.height,
        weight: rosterPlayer.weight,
        eligibilityRemaining: rosterPlayer.eligibilityRemaining,
        isTransfer: Boolean(rosterPlayer.isTransfer)
      },
      recruiting: {
        stars: recruiting.stars ?? null,
        transferPortalStars: recruiting.transferPortalStars ?? null,
        compositeRating: recruiting.compositeRating ?? null,
        compositePercent: toPercent(recruiting.compositeRating),
        nationalRank: recruiting.nationalRank ?? null,
        positionRank: recruiting.positionRank ?? null
      },
      ratings: {
        overall: ratings.overall ?? null,
        archetype: ratings.archetype ?? null,
        attributes: Object.fromEntries(
          Object.entries(ratings).filter(([key]) => !['playerId', 'overall', 'archetype'].includes(key))
        )
      },
      production: {
        season: datasetBySource?.production?.season ?? null,
        stats: Object.fromEntries(Object.entries(production).filter(([key]) => !['playerId', 'name'].includes(key)))
      },
      dataCompleteness: {
        hasRecruiting: Boolean(recruitingResolved.record),
        hasRatings: Boolean(ratingsResolved.record),
        hasProduction: Boolean(productionResolved.record),
        recruitingMatchedBy: recruitingResolved.matchedBy,
        ratingsMatchedBy: ratingsResolved.matchedBy,
        productionMatchedBy: productionResolved.matchedBy
      }
    };
  });

  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  const validSides = new Set(['OFFENSE', 'DEFENSE']);
  const starters = collectStarterIds(datasetBySource?.roster?.depthChart).map((entry) => {
    if (!validSides.has(entry.side)) {
      console.warn(`Unknown depth chart side: "${entry.side}" for slot ${entry.slot}`);
    }

    return { ...entry };
  });

  const coverage = {
    rosterCount: rosterPlayers.length,
    recruitingMatched: players.filter((p) => p.dataCompleteness.hasRecruiting).length,
    ratingsMatched: players.filter((p) => p.dataCompleteness.hasRatings).length,
    productionMatched: players.filter((p) => p.dataCompleteness.hasProduction).length,
    unmatchedRecruitingIds: [...recruitingMap.keys()].filter((id) => !playerMap.has(id)),
    unmatchedRatingsIds: [...ratingsMap.keys()].filter((id) => !playerMap.has(id)),
    unmatchedProductionIds: [...productionMap.keys()].filter((id) => !playerMap.has(id))
  };

  return {
    players,
    playerMap,
    starters,
    metrics: buildStarterMetrics(starters, playerMap),
    depthChart: buildDepthChartView(datasetBySource?.roster?.depthChart, playerMap),
    coverage
  };
};
