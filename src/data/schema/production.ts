import { z } from 'zod'
import { SourceMetaSchema } from './common.ts'

/**
 * Season production. CFBD emits a sparse set of stat keys per player
 * (PAS, YDS, TD, REC, INT, SCK, TFL, …) — model the known ones as optional
 * numbers and allow extras via passthrough.
 */
export const ProductionEntrySchema = z
  .object({
    playerId: z.string(),
    name: z.string().optional(),
    games: z.number().optional(),
    PAS: z.number().optional(),
    YDS: z.number().optional(),
    TD: z.number().optional(),
    REC: z.number().optional(),
    INT: z.number().optional(),
    SCK: z.number().optional(),
    TFL: z.number().optional(),
    TKL: z.number().optional(),
  })
  .passthrough()
export type ProductionEntry = z.infer<typeof ProductionEntrySchema>

export const ProductionSourceSchema = SourceMetaSchema.extend({
  sourceType: z.literal('production'),
  playerProduction: z.array(ProductionEntrySchema),
}).passthrough()
export type ProductionSource = z.infer<typeof ProductionSourceSchema>
