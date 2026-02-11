import { getMockDatasetByTeam } from '../../mock/index.js';
import { normalizeDepthChart } from '../../normalize/depthChart.js';
import { getCollectedTeamSources } from '../../collected/index.js';

const mapPlayer = (entry) => ({
  playerId: entry.pid,
  name: entry.full_name,
  number: entry.jersey,
  side: entry.side_of_ball,
  position: entry.position,
  classYear: entry.class_year,
  height: entry.height,
  weight: entry.weight,
  eligibilityRemaining: entry.eligibility_remaining,
  isTransfer: entry.is_transfer
});

export const rosterAdapter = {
  sourceId: 'connected-roster-adapter-v1',
  sourceType: 'roster',

  async fetchRaw({ season, team } = {}) {
    const collected = getCollectedTeamSources(team);
    if (collected?.roster) {
      const rosterSource = collected.roster;
      return {
        provider: rosterSource.sourceId ?? 'cfbd-collected-roster',
        version: rosterSource.version ?? 'cfbd-scaffold-v1',
        as_of: rosterSource.asOf,
        season: season ?? rosterSource.season,
        team: team ?? rosterSource.team,
        athletes: rosterSource.players.map((p) => ({
          pid: p.playerId,
          full_name: p.name,
          jersey: p.number,
          side_of_ball: p.side,
          position: p.position,
          class_year: p.classYear,
          height: p.height,
          weight: p.weight,
          eligibility_remaining: p.eligibilityRemaining,
          is_transfer: p.isTransfer
        })),
        depth_chart: rosterSource.depthChart
      };
    }

    const rosterSource = getMockDatasetByTeam(team).roster;

    return {
      provider: 'internal-roster-api',
      version: '2026.2',
      as_of: rosterSource.asOf,
      season: season ?? rosterSource.season,
      team: team ?? rosterSource.team,
      athletes: rosterSource.players.map((p) => ({
        pid: p.playerId,
        full_name: p.name,
        jersey: p.number,
        side_of_ball: p.side,
        position: p.position,
        class_year: p.classYear,
        height: p.height,
        weight: p.weight,
        eligibility_remaining: p.eligibilityRemaining,
        is_transfer: p.isTransfer
      })),
      depth_chart: rosterSource.depthChart
    };
  },

  mapToCanonical(raw) {
    return {
      sourceId: raw.provider,
      sourceType: 'roster',
      asOf: raw.as_of,
      team: raw.team,
      season: raw.season,
      version: raw.version,
      players: raw.athletes.map(mapPlayer),
      depthChart: normalizeDepthChart(raw.depth_chart)
    };
  },

  validate(mapped) {
    return {
      isValid: Array.isArray(mapped.players) && mapped.players.length > 0 && Boolean(mapped.depthChart?.offense),
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
