import { getMockDatasetByTeam } from '../../mock/index.js';

export const ratingsAdapter = {
  sourceId: 'connected-ratings-adapter-v1',
  sourceType: 'ratings',

  async fetchRaw({ team } = {}) {
    const ratingsSource = getMockDatasetByTeam(team).ratings;

    return {
      provider: 'ratings-api',
      version: '2026.1',
      as_of: ratingsSource.asOf,
      team,
      ratings: ratingsSource.playerRatings.map((p) => ({
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
      team: raw.team,
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
      version: mapped.version,
      team: mapped.team
    };
  }
};
