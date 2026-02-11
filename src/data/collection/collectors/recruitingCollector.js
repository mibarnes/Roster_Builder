import { getMockDatasetByTeam } from '../../mock/index.js';

export const collectRecruitingSource = async ({ team }) => {
  const recruiting = getMockDatasetByTeam(team).recruiting;
  return {
    sourceType: 'recruiting',
    sourceId: recruiting.sourceId,
    collectedAt: new Date().toISOString(),
    dataset: recruiting
  };
};
