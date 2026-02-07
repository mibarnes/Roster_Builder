const toMap = (items = []) =>
  new Map(items.filter((item) => item?.playerId).map((item) => [item.playerId, item]));

const toPercent = (compositeRating) =>
  typeof compositeRating === 'number' ? Number((compositeRating * 100).toFixed(1)) : null;

const average = (values) => {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
};

const collectStarterIds = (depthChart = {}) => {
  const starterSlots = [];

  for (const [side, slots] of Object.entries(depthChart)) {
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
  const bySide = {};

  for (const [side, slots] of Object.entries(depthChart ?? {})) {
    bySide[side] = Object.entries(slots ?? {}).map(([slot, playerId]) => ({
      slot,
      playerId,
      player: playerMap.get(playerId) ?? null
    }));
  }

  return bySide;
};

export const buildPlayerPipeline = (datasetBySource) => {
  const rosterPlayers = datasetBySource?.roster?.players ?? [];
  const recruitingMap = toMap(datasetBySource?.recruiting?.playerRecruitProfiles);
  const ratingsMap = toMap(datasetBySource?.ratings?.playerRatings);
  const productionMap = toMap(datasetBySource?.production?.playerProduction);

  const players = rosterPlayers.map((rosterPlayer) => {
    const recruiting = recruitingMap.get(rosterPlayer.playerId) ?? {};
    const ratings = ratingsMap.get(rosterPlayer.playerId) ?? {};
    const production = productionMap.get(rosterPlayer.playerId) ?? {};

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
        stats: Object.fromEntries(Object.entries(production).filter(([key]) => key !== 'playerId'))
      },
      dataCompleteness: {
        hasRecruiting: recruitingMap.has(rosterPlayer.playerId),
        hasRatings: ratingsMap.has(rosterPlayer.playerId),
        hasProduction: productionMap.has(rosterPlayer.playerId)
      }
    };
  });

  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  const starters = collectStarterIds(datasetBySource?.roster?.depthChart).map((entry) => ({
    ...entry,
    side: entry.side === 'OFFENSE' ? 'OFFENSE' : 'DEFENSE'
  }));

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
