import { cfbdScaffoldData } from './cfbdScaffoldData.js';
import { resolveTeam } from '../teamConfig.js';

export const getCollectedTeamSources = (team) => {
  const resolved = resolveTeam(team);
  return cfbdScaffoldData.byTeam?.[resolved.id] ?? null;
};
