import { ratingsSource as mockRatingsSource } from '../../mock/ratingsSource.js';

export const ratingsAdapter = {
  sourceId: 'connected-ratings-adapter-v1',
  sourceType: 'ratings',

  async fetchRaw() {
    return {
      provider: 'ratings-api',
      version: '2026.1',
      as_of: mockRatingsSource.asOf,
      ratings: mockRatingsSource.playerRatings.map((p) => ({
        pid: p.playerId,
        ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'playerId'))
      }))
    };
  },

  mapToCanonical(raw) {
    return {
      sourceId: raw.provider,
      sourceType: 'ratings',
      asOf: raw.as_of,
      version: raw.version,
      playerRatings: raw.ratings.map((p) => ({
        playerId: p.pid,
        ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'pid'))
      }))
    };
  },

  validate(mapped) {
    return {
      isValid: Array.isArray(mapped.playerRatings) && mapped.playerRatings.length > 0,
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
