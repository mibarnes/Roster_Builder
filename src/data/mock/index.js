import { rosterSource } from './rosterSource.js';
import { recruitingSource } from './recruitingSource.js';
import { ratingsSource } from './ratingsSource.js';
import { productionSource } from './productionSource.js';
import { verifyDatasetComponents } from '../validation/verifyDatasetComponents.js';
import { resolveTeam } from '../teamConfig.js';

const baseDatasetBySource = {
  roster: rosterSource,
  recruiting: recruitingSource,
  ratings: ratingsSource,
  production: productionSource
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const getMockDatasetByTeam = (team) => {
  const resolved = resolveTeam(team);
  const dataset = clone(baseDatasetBySource);
  dataset.roster.team = resolved.label;
  return dataset;
};

export const mockDatasetBySource = getMockDatasetByTeam();

export const verifyMockDatasetComponents = (team) => verifyDatasetComponents(getMockDatasetByTeam(team));
