import { z } from 'zod'
import { SideSchema, SourceMetaSchema } from './common.ts'

export const RosterPlayerSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  number: z.number().nullable().optional(),
  side: SideSchema,
  position: z.string(),
  /** Raw class year: usually FR/SO/JR/SR, but the CFBD captures also emit '0'/null.
   *  The pipeline canonicalizes to ClassYear (FR/SO/JR/SR | null). */
  classYear: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.number().nullable().optional(),
  eligibilityRemaining: z.number().nullable().optional(),
  isTransfer: z.boolean().optional(),
})
export type RosterPlayer = z.infer<typeof RosterPlayerSchema>

/** slot id (e.g. "WRX", "LT2", "LCB") → playerId */
const DepthChartSideSchema = z.record(z.string(), z.string())

export const DepthChartMetaSchema = z
  .object({
    sourceId: z.string().optional(),
    sourceUrl: z.string().optional(),
    parsedRows: z.object({ offense: z.number(), defense: z.number() }).partial().optional(),
    unmatchedOurladsPlayers: z
      .array(
        z.object({
          slot: z.string().optional(),
          depth: z.number().optional(),
          name: z.string().optional(),
          cleanedName: z.string().optional(),
        }),
      )
      .optional(),
  })
  .passthrough()

export const RosterSourceSchema = SourceMetaSchema.extend({
  sourceType: z.literal('roster'),
  players: z.array(RosterPlayerSchema),
  depthChart: z.object({
    offense: DepthChartSideSchema,
    defense: DepthChartSideSchema,
  }),
  depthChartMeta: DepthChartMetaSchema.optional(),
}).passthrough()
export type RosterSource = z.infer<typeof RosterSourceSchema>
