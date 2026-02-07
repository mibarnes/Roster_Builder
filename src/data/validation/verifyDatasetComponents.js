import { requiredDatasetComponents } from './requiredComponents.js';

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

export const verifyDatasetComponents = (datasetBySource, requiredPaths = requiredDatasetComponents) => {
  const availability = requiredPaths.map((path) => {
    const value = getPath(datasetBySource, path);
    const isArray = Array.isArray(value);

    return {
      component: path,
      available: value !== undefined,
      nonEmpty: !isArray || value.length > 0,
      count: isArray ? value.length : undefined
    };
  });

  const missingComponents = availability.filter((item) => !item.available).map((item) => item.component);
  const emptyComponents = availability
    .filter((item) => item.available && item.nonEmpty === false)
    .map((item) => item.component);

  return {
    allAvailable: missingComponents.length === 0,
    allNonEmpty: emptyComponents.length === 0,
    isComplete: missingComponents.length === 0 && emptyComponents.length === 0,
    missingComponents,
    emptyComponents,
    availability
  };
};
