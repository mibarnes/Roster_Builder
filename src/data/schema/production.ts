import { z } from 'zod'
import { SourceMetaSchema } from './common.ts'

/**
 * Season production. Built primarily from CFBD /games/players (real per-game
 * appearances → games-played count + broad-category aggregation across all
 * 8-10 categories) merged with /stats/player/season (RATING/QBR).
 *
 * `games` = distinct game ids the athlete appeared in (a true 0 vs missing is
 * distinguishable: a stat key is only emitted when the player actually recorded
 * it). `stats` is a flexible record so new CFBD stat keys flow through without a
 * schema change; `perGame` is the optional per-game stat log.
 */
export const PerGameLogSchema = z.object({
  gameId: z.union([z.string(), z.number()]),
  stats: z.record(z.string(), z.number()),
})

export const ProductionEntrySchema = z
  .object({
    playerId: z.string(),
    name: z.string().nullable().optional(),
    /** Distinct games this athlete appeared in (from /games/players). */
    games: z.number().int().min(0).optional(),
    /** Flexible stat record — only keys the player actually recorded are present. */
    stats: z.record(z.string(), z.number()).optional(),
    /** Optional per-game stat logs. */
    perGame: z.array(PerGameLogSchema).optional(),
    // ── Flattened convenience keys kept for backward-compat with consumers ──
    PAS: z.number().optional(),
    YDS: z.number().optional(),
    TD: z.number().optional(),
    REC: z.number().optional(),
    INT: z.number().optional(),
    SCK: z.number().optional(),
    TFL: z.number().optional(),
    TKL: z.number().optional(),
    RTG: z.number().optional(),
  })
  .passthrough()
export type ProductionEntry = z.infer<typeof ProductionEntrySchema>

export const ProductionSourceSchema = SourceMetaSchema.extend({
  sourceType: z.literal('production'),
  playerProduction: z.array(ProductionEntrySchema),
}).passthrough()
export type ProductionSource = z.infer<typeof ProductionSourceSchema>
