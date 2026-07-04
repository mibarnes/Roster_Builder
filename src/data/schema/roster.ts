import { z } from 'zod'
import { SideSchema, SourceMetaSchema } from './common.ts'
import { PositionSchema } from '../positions.ts'

/**
 * The position allowlist + schema + type are the canonical source of truth in
 * ../positions.ts (D6). Re-exported here for backward compatibility with the
 * existing importers of schema/roster.ts.
 */
export { POSITION_ALLOWLIST, PositionSchema, type Position } from '../positions.ts'

export const RosterPlayerSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  number: z.number().nullable().optional(),
  side: SideSchema,
  /** Broad position — constrained to POSITION_ALLOWLIST (permissive-but-named). */
  position: PositionSchema,
  /** Raw class year: FR/SO/JR/SR or 'RS *' variants; null for unknowns.
   *  The pipeline canonicalizes to ClassYear (FR/SO/JR/SR | null). */
  classYear: z.string().nullable().optional(),
  /** Redshirt status captured separately so the 'RS *' parse survives canonicalization. */
  isRedshirt: z.boolean().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.number().nullable().optional(),
  eligibilityRemaining: z.number().nullable().optional(),
  isTransfer: z.boolean().optional(),
  // ── Hometown (from CFBD /roster; nullable — not every row has it) ──────────
  homeCity: z.string().nullable().optional(),
  homeState: z.string().nullable().optional(),
  homeLat: z.number().nullable().optional(),
  homeLon: z.number().nullable().optional(),
  // ── Golden-master overlay fields (pilot-deepening round; optional so the 31
  //    legacy teams still parse). Populated by the master→dataset adapter. ─────
  /** ESPN headshot URL (master headshot field). */
  headshotUrl: z.string().nullable().optional(),
  /** High school (official-site overlay only). */
  highSchool: z.string().nullable().optional(),
  /** Previous school (official-site overlay / transfer). */
  previousSchool: z.string().nullable().optional(),
  hometownText: z.string().nullable().optional(),
  /** On the roster but no recruiting record (walk-on signal). */
  isWalkOn: z.boolean().optional(),
  /** No 2025 CFBD data (transfer-in / true freshman new in 2026). */
  newIn2026: z.boolean().optional(),
  /** No stars from any recruiting source. */
  unrated: z.boolean().optional(),
  /** Fields where two present sources disagreed (value + alt kept in master). */
  conflictFields: z.array(z.string()).optional(),
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
