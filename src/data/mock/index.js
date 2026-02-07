import { rosterSource } from './rosterSource.js';
import { recruitingSource } from './recruitingSource.js';
import { ratingsSource } from './ratingsSource.js';
import { productionSource } from './productionSource.js';
import { verifyDatasetComponents } from '../validation/verifyDatasetComponents.js';

export const mockDatasetBySource = {
  roster: rosterSource,
  recruiting: recruitingSource,
  ratings: ratingsSource,
  production: productionSource
};

export const verifyMockDatasetComponents = () => verifyDatasetComponents(mockDatasetBySource);
