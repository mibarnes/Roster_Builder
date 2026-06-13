import { z } from 'zod'
import { ProvenanceSchema, SideSchema } from './common.ts'

/**
 * ESPN roster source — the 2026 roster SPINE.
 *
 * ESPN's site-API athlete `id` shares the SAME namespace as CFBD's athleteId,
 * so the canonical playerId is `CFBD-<espnId>` and the ESPN↔CFBD join is a
 * DIRECT id join (no fuzzy). Each athlete row is normalized to a flat,
 * zod-validated shape here; the raw API payload never leaves the client.
 *
 * Source: GET site.api.espn.com/.../teams/<espnId>/roster (no key). 100/team.
 */
export const EspnPlayerSchema = z.object({
  /** ESPN athlete id (string). Canonical playerId = `CFBD-<id>`. */
  espnId: z.string(),
  name: z.string(),
  /** Jersey number; null when ESPN omits it (e.g. some incoming freshmen). */
  jersey: z.number().nullable(),
  /** Side bucket from position.parent.abbreviation (OFF/DEF/ST). */
  side: SideSchema.or(z.literal('ST')),
  /** ESPN position abbreviation (WR/QB/CB/…). */
  position: z.string(),
  /** Class from experience.abbreviation; FR/SO/JR/SR (GR→SR). null when unknown. */
  classYear: z.enum(['FR', 'SO', 'JR', 'SR']).nullable(),
  /** Raw experience years (1–4+) — kept for redshirt inference cross-check. */
  experienceYears: z.number().nullable().optional(),
  /** Height in inches (num). */
  heightIn: z.number().nullable(),
  /** Weight in lbs (num). */
  weight: z.number().nullable(),
  /** Display height, e.g. "5' 10\"". */
  displayHeight: z.string().nullable(),
  homeCity: z.string().nullable(),
  homeState: z.string().nullable(),
  homeCountry: z.string().nullable().optional(),
  headshotUrl: z.string().nullable(),
  /** ESPN status.type ('active' | …). */
  status: z.string().nullable(),
  /** True when injuries[] is non-empty. */
  isInjured: z.boolean(),
})
export type EspnPlayer = z.infer<typeof EspnPlayerSchema>

export const EspnRosterSourceSchema = z.object({
  sourceId: z.literal('espn-roster-v1'),
  sourceType: z.literal('espn-roster'),
  team: z.string(),
  /** Roster season ESPN reports (2026 in the pilot round). */
  season: z.number(),
  espnTeamId: z.string(),
  provenance: ProvenanceSchema,
  players: z.array(EspnPlayerSchema),
})
export type EspnRosterSource = z.infer<typeof EspnRosterSourceSchema>
