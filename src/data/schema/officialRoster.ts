import { z } from 'zod'
import { ProvenanceSchema } from './common.ts'

/**
 * Official-team-site roster overlay — BEST-EFFORT, non-load-bearing.
 *
 * Florida is a Sidearm/Nuxt app (roster in a __NUXT_DATA__ serialized array);
 * other schools differ (Miami is fully client-rendered → no SSR roster). The
 * client parses what it can and ALWAYS degrades gracefully: on any failure it
 * emits `degraded:true` + an empty players list rather than throwing the run.
 *
 * The overlay's unique contribution is highSchool / previousSchool / hometown
 * keyed by player name (joined to the ESPN spine by stdName + jersey downstream).
 */
export const OfficialPlayerSchema = z.object({
  name: z.string(),
  jersey: z.number().nullable(),
  position: z.string().nullable(),
  classYear: z.string().nullable(),
  hometown: z.string().nullable(),
  highSchool: z.string().nullable(),
  previousSchool: z.string().nullable(),
})
export type OfficialPlayer = z.infer<typeof OfficialPlayerSchema>

export const OfficialRosterSourceSchema = z.object({
  sourceId: z.literal('official-roster-v1'),
  sourceType: z.literal('official-roster'),
  team: z.string(),
  sourceUrl: z.string(),
  /** Roster engine detected ('nuxt-sidearm' | 'wmt' | 'unknown'). */
  engine: z.string(),
  /** True when the parse failed or yielded nothing usable (overlay is optional). */
  degraded: z.boolean(),
  /** Human-readable reason when degraded. */
  degradeReason: z.string().nullable().optional(),
  /** How many players carried at least one overlay datum (HS/prev/hometown). */
  coverage: z.number(),
  provenance: ProvenanceSchema,
  players: z.array(OfficialPlayerSchema),
})
export type OfficialRosterSource = z.infer<typeof OfficialRosterSourceSchema>
