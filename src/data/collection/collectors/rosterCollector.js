import { getMockDatasetByTeam } from '../../mock/index.js';

export const collectRosterSource = async ({ team, season }) => {
  const roster = getMockDatasetByTeam(team).roster;
  return {
    sourceType: 'roster',
    sourceId: roster.sourceId,
    collectedAt: new Date().toISOString(),
    dataset: {
      ...roster,
      team: team ?? roster.team,
      season: season ?? roster.season
    }
  };
};

