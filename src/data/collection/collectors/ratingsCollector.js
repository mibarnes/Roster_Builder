import { getMockDatasetByTeam } from '../../mock/index.js';

export const collectRatingsSource = async ({ team }) => {
  const ratings = getMockDatasetByTeam(team).ratings;
  return {
    sourceType: 'ratings',
    sourceId: ratings.sourceId,
    collectedAt: new Date().toISOString(),
    dataset: ratings
  };
};
