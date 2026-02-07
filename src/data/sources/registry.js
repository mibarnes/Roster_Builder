import { rosterAdapter } from './roster/adapter.js';
import { recruitingAdapter } from './recruiting/adapter.js';
import { ratingsAdapter } from './ratings/adapter.js';
import { productionAdapter } from './production/adapter.js';

export const sourceRegistry = {
  roster: rosterAdapter,
  recruiting: recruitingAdapter,
  ratings: ratingsAdapter,
  production: productionAdapter
};
