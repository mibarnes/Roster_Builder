import { TEAM_OPTIONS } from '../teamConfig.js';
import { collectRosterSource } from './collectors/rosterCollector.js';
import { collectRecruitingSource } from './collectors/recruitingCollector.js';
import { collectRatingsSource } from './collectors/ratingsCollector.js';
import { collectProductionSource } from './collectors/productionCollector.js';

const sourceCollectors = {
  roster: collectRosterSource,
  recruiting: collectRecruitingSource,
  ratings: collectRatingsSource,
  production: collectProductionSource
};

export const collectTeamSources = async ({ team, season }) => {
  const startedAt = new Date().toISOString();

  const collectedEntries = await Promise.all(
    Object.entries(sourceCollectors).map(async ([sourceType, collect]) => {
      const result = await collect({ team, season });
      return [sourceType, result];
    })
  );

  return {
    team,
    season,
    startedAt,
    completedAt: new Date().toISOString(),
    sourceCount: collectedEntries.length,
    datasetBySource: Object.fromEntries(
      collectedEntries.map(([sourceType, payload]) => [sourceType, payload.dataset])
    ),
    sourceStatus: Object.fromEntries(
      collectedEntries.map(([sourceType, payload]) => [
        sourceType,
        {
          sourceId: payload.sourceId,
          sourceType: payload.sourceType,
          collectedAt: payload.collectedAt
        }
      ])
    )
  };
};

export const collectAllTeams = async ({ teams = TEAM_OPTIONS.map((item) => item.label), season } = {}) => {
  const workerJobs = teams.map((team) => collectTeamSources({ team, season }));
  return Promise.all(workerJobs);
};

