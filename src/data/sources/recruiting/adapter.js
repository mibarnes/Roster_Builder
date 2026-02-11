import { getMockDatasetByTeam } from '../../mock/index.js';
import { getCollectedTeamSources } from '../../collected/index.js';

export const recruitingAdapter = {
  sourceId: 'connected-recruiting-adapter-v1',
  sourceType: 'recruiting',

  async fetchRaw({ team } = {}) {
    const collected = getCollectedTeamSources(team);
    if (collected?.recruiting) {
      const recruitingSource = collected.recruiting;
      return {
        provider: recruitingSource.sourceId ?? 'cfbd-collected-recruiting',
        version: recruitingSource.version ?? 'cfbd-scaffold-v1',
        as_of: recruitingSource.asOf,
        team,
        recruits: recruitingSource.playerRecruitProfiles.map((p) => ({
          pid: p.playerId,
          name: p.name,
          stars: p.stars,
          composite_rating: p.compositeRating,
          national_rank: p.nationalRank,
          position_rank: p.positionRank,
          transfer_portal_stars: p.transferPortalStars,
          years: p.years
        }))
      };
    }

    const recruitingSource = getMockDatasetByTeam(team).recruiting;

    return {
      provider: 'recruiting-api',
      version: '2026.1',
      as_of: recruitingSource.asOf,
      team,
      recruits: recruitingSource.playerRecruitProfiles.map((p) => ({
        pid: p.playerId,
        name: p.name,
        stars: p.stars,
        composite_rating: p.compositeRating,
        national_rank: p.nationalRank,
        position_rank: p.positionRank,
        transfer_portal_stars: p.transferPortalStars,
        years: p.years
      }))
    };
  },

  mapToCanonical(raw) {
    return {
      sourceId: raw.provider,
      sourceType: 'recruiting',
      asOf: raw.as_of,
      version: raw.version,
      team: raw.team,
      playerRecruitProfiles: raw.recruits.map((p) => ({
        playerId: p.pid,
        name: p.name,
        stars: p.stars,
        compositeRating: p.composite_rating,
        nationalRank: p.national_rank,
        positionRank: p.position_rank,
        transferPortalStars: p.transfer_portal_stars,
        years: p.years
      }))
    };
  },

  validate(mapped) {
    return {
      isValid: Array.isArray(mapped.playerRecruitProfiles) && mapped.playerRecruitProfiles.length > 0,
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
