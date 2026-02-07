import { mockDatasetBySource } from './mock/index.js';
import { sourceRegistry } from './sources/registry.js';
import { verifyDatasetComponents } from './validation/verifyDatasetComponents.js';
import { createAliasRegistry } from './identity/aliasRegistry.js';

const cache = new Map();
const DEFAULT_TTL_MS = 30_000;

const getDataMode = (mode) =>
  mode ??
  import.meta.env?.VITE_DATA_MODE ??
  'mock';

const readCache = (key) => {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
};

const writeCache = (key, value, ttlMs = DEFAULT_TTL_MS) => {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value
  });
};

const buildConnectedDataset = async ({ season, team }) => {
  const aliasRegistry = createAliasRegistry();
  const entries = await Promise.all(
    Object.entries(sourceRegistry).map(async ([key, adapter]) => {
      const raw = await adapter.fetchRaw({ season, team, aliasRegistry });
      const mapped = adapter.mapToCanonical(raw, { aliasRegistry });
      const validation = adapter.validate(mapped, { aliasRegistry });
      return [key, { mapped, validation, metadata: adapter.metadata(mapped) }];
    })
  );

  const datasetBySource = Object.fromEntries(entries.map(([key, value]) => [key, value.mapped]));
  const sourceStatus = Object.fromEntries(
    entries.map(([key, value]) => [key, { ...value.validation, ...value.metadata }])
  );

  return { datasetBySource, sourceStatus, aliasRegistry: aliasRegistry.toJSON() };
};

export const loadDataset = async ({ mode, season, team, ttlMs = DEFAULT_TTL_MS } = {}) => {
  const resolvedMode = getDataMode(mode);
  const cacheKey = `${resolvedMode}:${season ?? 'default'}:${team ?? 'default'}`;

  const fromCache = readCache(cacheKey);
  if (fromCache) {
    return fromCache;
  }

  if (resolvedMode === 'mock') {
    const completenessReport = verifyDatasetComponents(mockDatasetBySource);
    const payload = {
      mode: 'mock',
      datasetBySource: mockDatasetBySource,
      completenessReport,
      warnings: []
    };
    writeCache(cacheKey, payload, ttlMs);
    return payload;
  }

  try {
    const connected = await buildConnectedDataset({ season, team });
    const completenessReport = verifyDatasetComponents(connected.datasetBySource);
    const payload = {
      mode: 'connected',
      datasetBySource: connected.datasetBySource,
      completenessReport,
      sourceStatus: connected.sourceStatus,
      aliasRegistry: connected.aliasRegistry,
      warnings: completenessReport.isComplete ? [] : ['Connected mode returned incomplete dataset']
    };

    writeCache(cacheKey, payload, ttlMs);
    return payload;
  } catch (error) {
    const fallback = {
      mode: 'mock-fallback',
      datasetBySource: mockDatasetBySource,
      completenessReport: verifyDatasetComponents(mockDatasetBySource),
      warnings: [`Connected mode failed, fell back to mock: ${error.message}`]
    };

    writeCache(cacheKey, fallback, ttlMs);
    return fallback;
  }
};
