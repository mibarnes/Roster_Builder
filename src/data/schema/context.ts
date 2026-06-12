import { z } from 'zod'
import { SourceMetaSchema } from './common.ts'

/**
 * Team-level returning-production context from CFBD /player/returning
 * (one row per team): what share of last season's production returns.
 */
export const ReturningProductionSchema = z.object({
  totalPPA: z.number().nullable().optional(),
  totalPassingPPA: z.number().nullable().optional(),
  totalReceivingPPA: z.number().nullable().optional(),
  totalRushingPPA: z.number().nullable().optional(),
  percentPPA: z.number().nullable().optional(),
  percentPassingPPA: z.number().nullable().optional(),
  percentReceivingPPA: z.number().nullable().optional(),
  percentRushingPPA: z.number().nullable().optional(),
  usage: z.number().nullable().optional(),
  passingUsage: z.number().nullable().optional(),
  receivingUsage: z.number().nullable().optional(),
  rushingUsage: z.number().nullable().optional(),
})
export type ReturningProduction = z.infer<typeof ReturningProductionSchema>

export const ContextSourceSchema = SourceMetaSchema.extend({
  sourceType: z.literal('context'),
  /** null when CFBD returns no returning-production row for the team/season. */
  returningProduction: ReturningProductionSchema.nullable(),
}).passthrough()
export type ContextSource = z.infer<typeof ContextSourceSchema>
