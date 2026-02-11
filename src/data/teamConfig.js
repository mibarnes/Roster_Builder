import { getOurladsBannerColorBySlug } from './ourladsTeamBannerColors.js';

export const TEAM_OPTIONS = Object.freeze([
  { id: 'miami-hurricanes', label: 'Miami Hurricanes', ourladsSlug: 'miami', ourladsId: '91073' },
  { id: 'alabama-crimson-tide', label: 'Alabama Crimson Tide', ourladsSlug: 'alabama', ourladsId: '89923' }
]);

export const DEFAULT_TEAM_ID = TEAM_OPTIONS[0].id;
export const DEFAULT_TEAM_LABEL = TEAM_OPTIONS[0].label;

const normalize = (value = '') => String(value).trim().toLowerCase();

export const getTeamById = (teamId) =>
  TEAM_OPTIONS.find((team) => team.id === teamId) ?? TEAM_OPTIONS[0];

export const resolveTeam = (team) => {
  const normalized = normalize(team);
  return (
    TEAM_OPTIONS.find((item) => item.id === normalized || normalize(item.label) === normalized) ??
    TEAM_OPTIONS[0]
  );
};

export const getTeamAccentColor = (team = TEAM_OPTIONS[0]) =>
  getOurladsBannerColorBySlug(team.ourladsSlug);
