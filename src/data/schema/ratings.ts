import { z } from 'zod'
import { SourceMetaSchema } from './common.ts'

/**
 * Ratings have NO independent provider. OVR is derived downstream
 * (recruiting composite × 100, unranked → 70). This schema only validates
 * the optional legacy `ratings.json` when present (mock/scaffold teams);
 * real CFBD captures ship without it.
 */
export const PlayerRatingSchema = z
  .object({
    playerId: z.string(),
    overall: z.number().nullable().optional(),
  })
  .passthrough()
export type PlayerRating = z.infer<typeof PlayerRatingSchema>

export const RatingsSourceSchema = SourceMetaSchema.extend({
  sourceType: z.literal('ratings'),
  playerRatings: z.array(PlayerRatingSchema),
}).passthrough()
export type RatingsSource = z.infer<typeof RatingsSourceSchema>
