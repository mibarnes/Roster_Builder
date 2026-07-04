/**
 * Typed accessors for the committed league artifacts built offline by
 * scripts/buildLeagueArtifacts.ts. These are small, single files (never the 54
 * per-team masters), so F6's cross-team views load them directly.
 */
import leagueJson from './collected/_league.json'
import identityJson from './collected/_identity.json'
import baselinesJson from './collected/_baselines.json'
import type { LeagueBaselines } from './rating/ratingConfig.ts'

export interface LeagueTeam {
  teamId: string
  label: string
  conference: string
  accentColor: string
  avgStarterOverall: number | null
  offenseStarterOverall: number | null
  defenseStarterOverall: number | null
  returningPercentPPA: number | null
  rosterCount: number
  ratedCount: number
  portalIn: number
  portalOut: number
  portalNet: number
}

export interface PortalEdge {
  name: string
  position: string | null
  fromName: string
  fromTeamId: string | null
  toTeamId: string
  toName: string
  transferRating: number | null
}

interface LeagueArtifact {
  generatedAt: string | null
  teamsIncluded: number
  teams: LeagueTeam[]
}
interface IdentityArtifact {
  generatedAt: string | null
  teamsIncluded: number
  edges: PortalEdge[]
}

export const LEAGUE = leagueJson as unknown as LeagueArtifact
export const IDENTITY = identityJson as unknown as IdentityArtifact
export const BASELINES = baselinesJson as unknown as LeagueBaselines

/** Portal edges where BOTH ends are in-registry teams (drives the flow view). */
export const inLeagueEdges = (): PortalEdge[] => IDENTITY.edges.filter((e) => e.fromTeamId != null)
