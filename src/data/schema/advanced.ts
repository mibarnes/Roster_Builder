import { z } from 'zod'
import { SourceMetaSchema } from './common.ts'

/**
 * Advanced per-player metrics from CFBD:
 *  - usage  (/player/usage):       snap-share splits by down/situation
 *  - ppa    (/ppa/players/season): predicted points added (avg + total)
 * Both are id-keyed (CFBD-<id>). A player may have one, both, or neither.
 */
export const UsageSchema = z.object({
  overall: z.number().nullable().optional(),
  pass: z.number().nullable().optional(),
  rush: z.number().nullable().optional(),
  firstDown: z.number().nullable().optional(),
  secondDown: z.number().nullable().optional(),
  thirdDown: z.number().nullable().optional(),
  standardDowns: z.number().nullable().optional(),
  passingDowns: z.number().nullable().optional(),
})
export type Usage = z.infer<typeof UsageSchema>

const PpaSplit = z.object({
  all: z.number().nullable().optional(),
  pass: z.number().nullable().optional(),
  rush: z.number().nullable().optional(),
  firstDown: z.number().nullable().optional(),
  secondDown: z.number().nullable().optional(),
  thirdDown: z.number().nullable().optional(),
  standardDowns: z.number().nullable().optional(),
  passingDowns: z.number().nullable().optional(),
})

export const PpaSchema = z.object({
  averagePPA: PpaSplit.optional(),
  totalPPA: PpaSplit.optional(),
})
export type Ppa = z.infer<typeof PpaSchema>

export const PlayerAdvancedSchema = z.object({
  playerId: z.string(),
  name: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  usage: UsageSchema.optional(),
  ppa: PpaSchema.optional(),
})
export type PlayerAdvanced = z.infer<typeof PlayerAdvancedSchema>

export const AdvancedSourceSchema = SourceMetaSchema.extend({
  sourceType: z.literal('advanced'),
  playerAdvanced: z.array(PlayerAdvancedSchema),
}).passthrough()
export type AdvancedSource = z.infer<typeof AdvancedSourceSchema>
