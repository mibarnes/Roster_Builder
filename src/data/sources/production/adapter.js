import { getMockDatasetByTeam } from '../../mock/index.js';
import { getCollectedTeamSources } from '../../collected/index.js';

export const productionAdapter = {
  sourceId: 'connected-production-adapter-v1',
  sourceType: 'production',

  async fetchRaw({ season, team } = {}) {
    const collected = getCollectedTeamSources(team);
    if (collected?.production) {
      const productionSource = collected.production;
      return {
        provider: productionSource.sourceId ?? 'cfbd-collected-production',
        version: productionSource.version ?? 'cfbd-scaffold-v1',
        as_of: productionSource.asOf,
        season: season ?? productionSource.season,
        team,
        production: productionSource.playerProduction.map((p) => ({
          pid: p.playerId,
          ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'playerId'))
        }))
      };
    }

    const productionSource = getMockDatasetByTeam(team).production;

    return {
      provider: 'production-api',
      version: '2026.1',
      as_of: productionSource.asOf,
      season: season ?? productionSource.season,
      team,
      production: productionSource.playerProduction.map((p) => ({
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
      team: raw.team,
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
      version: mapped.version,
      team: mapped.team
    };
  }
};
