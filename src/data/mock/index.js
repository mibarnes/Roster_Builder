import { rosterSource } from './rosterSource.js';
import { recruitingSource } from './recruitingSource.js';
import { ratingsSource } from './ratingsSource.js';
import { productionSource } from './productionSource.js';

export const mockDatasetBySource = {
  roster: rosterSource,
  recruiting: recruitingSource,
  ratings: ratingsSource,
  production: productionSource
};

export const requiredDatasetComponents = [
  'roster.players',
  'roster.depthChart.offense',
  'roster.depthChart.defense',
  'recruiting.playerRecruitProfiles',
  'ratings.playerRatings',
  'production.playerProduction'
];

const getPath = (obj, path) => {
  const keys = path.split('.');
  let cursor = obj;

  for (const key of keys) {
    if (cursor == null || !(key in cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }

  return cursor;
};

export const verifyMockDatasetComponents = () => {
  const availability = requiredDatasetComponents.map((path) => {
    const value = getPath(mockDatasetBySource, path);
    return {
      component: path,
      available: value !== undefined,
      count: Array.isArray(value) ? value.length : undefined
    };
  });

  return {
    allAvailable: availability.every((item) => item.available),
    availability
  };
};
