import { productionSource as mockProductionSource } from '../../mock/productionSource.js';

export const productionAdapter = {
  sourceId: 'connected-production-adapter-v1',
  sourceType: 'production',

  async fetchRaw({ season } = {}) {
    return {
      provider: 'production-api',
      version: '2026.1',
      as_of: mockProductionSource.asOf,
      season: season ?? mockProductionSource.season,
      production: mockProductionSource.playerProduction.map((p) => ({
        pid: p.playerId,
        ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'playerId'))
      }))
    };
  },

  mapToCanonical(raw) {
    return {
      sourceId: raw.provider,
      sourceType: 'production',
      asOf: raw.as_of,
      season: raw.season,
      version: raw.version,
      playerProduction: raw.production.map((p) => ({
        playerId: p.pid,
        ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'pid'))
      }))
    };
  },

  validate(mapped) {
    return {
      isValid: Array.isArray(mapped.playerProduction) && mapped.playerProduction.length > 0,
      errors: []
    };
  },

  metadata(mapped) {
    return {
      sourceId: mapped.sourceId,
      sourceType: mapped.sourceType,
      asOf: mapped.asOf,
      version: mapped.version
    };
  }
};
