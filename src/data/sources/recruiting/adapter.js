import { recruitingSource as mockRecruitingSource } from '../../mock/recruitingSource.js';

export const recruitingAdapter = {
  sourceId: 'connected-recruiting-adapter-v1',
  sourceType: 'recruiting',

  async fetchRaw() {
    return {
      provider: 'recruiting-api',
      version: '2026.1',
      as_of: mockRecruitingSource.asOf,
      recruits: mockRecruitingSource.playerRecruitProfiles.map((p) => ({
        pid: p.playerId,
        stars: p.stars,
        composite_rating: p.compositeRating,
        national_rank: p.nationalRank,
        position_rank: p.positionRank,
        transfer_portal_stars: p.transferPortalStars
      }))
    };
  },

  mapToCanonical(raw) {
    return {
      sourceId: raw.provider,
      sourceType: 'recruiting',
      asOf: raw.as_of,
      version: raw.version,
      playerRecruitProfiles: raw.recruits.map((p) => ({
        playerId: p.pid,
        stars: p.stars,
        compositeRating: p.composite_rating,
        nationalRank: p.national_rank,
        positionRank: p.position_rank,
        transferPortalStars: p.transfer_portal_stars
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
      version: mapped.version
    };
  }
};
