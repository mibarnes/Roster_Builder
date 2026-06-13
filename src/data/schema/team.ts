export type Conference = 'ACC' | 'SEC' | 'IND'

export type TeamId = string

export interface Team {
  id: TeamId
  label: string
  conference: Conference
  /** CFBD API ?team= value. */
  cfbdQuery: string
  /** ESPN site-API team id (the 2026 roster spine; numeric string). Optional — only the pilots are wired. */
  espnId?: string
  /** Team official roster page URL (best-effort overlay source). Optional. */
  officialRosterUrl?: string
  /** 247Sports URL slug. */
  slug247: string
  ourlads: { slug: string; id: string }
  /** Per-team accent (hex), applied at runtime via the --team-accent CSS var. */
  accentColor: string
  /** Pilot teams are the only ones targeted by live re-collection. */
  isPilot: boolean
}
