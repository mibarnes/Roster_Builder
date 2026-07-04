export type Conference = 'ACC' | 'SEC' | 'IND'

export type TeamId = string

/**
 * Official-site roster CMS/engine. The collector DETECTS this from page content
 * (see scripts/collect/sources/officialSite.ts); the registry value is the
 * EXPECTED engine, used by the preflight validator + run-report telemetry to
 * flag a detected-vs-expected drift (e.g. a school migrates CMS). 'unknown' =
 * consciously-degraded (bio overlay unavailable; ESPN spine + CFBD still cover
 * the team). */
export type OfficialEngine = 'nuxt-sidearm' | 'sidearm-json' | 'wmt-presto' | 'unknown'

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
  /** Expected official-site engine (see OfficialEngine). Optional; drives preflight + telemetry. */
  officialEngine?: OfficialEngine
  /** 247Sports URL slug. */
  slug247: string
  ourlads: { slug: string; id: string }
  /** Per-team accent (hex), applied at runtime via the --team-accent CSS var. */
  accentColor: string
  /** Pilot teams are the only ones targeted by live re-collection. */
  isPilot: boolean
}
