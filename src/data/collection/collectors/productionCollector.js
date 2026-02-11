import { getMockDatasetByTeam } from '../../mock/index.js';

export const collectProductionSource = async ({ team, season }) => {
  const production = getMockDatasetByTeam(team).production;
  return {
    sourceType: 'production',
    sourceId: production.sourceId,
    collectedAt: new Date().toISOString(),
    dataset: {
      ...production,
      season: season ?? production.season
    }
  };
};
