import { z } from 'zod'
import { ProvenanceSchema } from './common.ts'

/**
 * On3 / Rivals recruiting fact-check — BEST-EFFORT, non-load-bearing.
 *
 * These endpoints are routinely 404/blocked (probed: 404/000). The client
 * ATTEMPTS a fetch and degrades to `{ players: [], degraded: true }` — its
 * failure must NEVER fail the run. When (rarely) data is obtained, it fills
 * recruiting gaps (stars/composite/rankings) the CFBD 247-composite missed.
 */
export const On3PlayerSchema = z.object({
  name: z.string(),
  stars: z.number().int().min(0).max(5).nullable(),
  /** 0–1 composite when provided. */
  compositeRating: z.number().min(0).max(1).nullable(),
  nationalRank: z.number().nullable(),
  positionRank: z.number().nullable(),
  position: z.string().nullable().optional(),
})
export type On3Player = z.infer<typeof On3PlayerSchema>

export const On3SourceSchema = z.object({
  sourceId: z.literal('on3-v1'),
  sourceType: z.literal('on3'),
  team: z.string(),
  /** True (almost always) when the source could not be reached/parsed. */
  degraded: z.boolean(),
  degradeReason: z.string().nullable().optional(),
  provenance: ProvenanceSchema,
  players: z.array(On3PlayerSchema),
})
export type On3Source = z.infer<typeof On3SourceSchema>
