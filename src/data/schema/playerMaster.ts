import { z } from 'zod'
import { ProvenanceSchema } from './common.ts'
import { PpaSchema, UsageSchema } from './advanced.ts'
import { ReturningProductionSchema } from './context.ts'
import { PerGameLogSchema } from './production.ts'
import { DepthChartMetaSchema } from './roster.ts'

/**
 * GOLDEN player-master schema (pilot-deepening round).
 *
 * One reconciled record per spine player. Every field that can disagree across
 * sources is wrapped in a `MetaField<T>` envelope carrying the WINNING value, the
 * source that won, a confidence, and (on disagreement) a `conflict` flag + the
 * losing `alt`. Crosswalk ids + first-class flags + nested recruiting/production/
 * advanced summaries complete the record. Sources only — every value traces to
 * ESPN / official / CFBD / On3; absent data is null + flagged, never invented.
 */

/** Which source supplied a merged value. */
export const MasterSourceSchema = z.enum([
  'espn',
  'official',
  'cfbd',
  'cfbd-2025',
  'on3',
  'derived',
])
export type MasterSource = z.infer<typeof MasterSourceSchema>

/** A single merged field: value + provenance meta (conflict-aware). */
export const metaField = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    _meta: z.object({
      source: MasterSourceSchema.nullable(),
      confidence: z.enum(['high', 'medium', 'low']),
      /** True when ≥2 present sources disagreed beyond tolerance. */
      conflict: z.boolean().optional(),
      /** The losing value (kept, not discarded) when conflict=true. */
      alt: value.nullable().optional(),
      /** The source of the alt value. */
      altSource: MasterSourceSchema.nullable().optional(),
    }),
  })

// Concrete field envelopes (z.infer needs concrete types, not the generic).
const StrField = metaField(z.string())
const NumField = metaField(z.number())

/** Crosswalk ids for one player (canonical + every source key we resolved). */
export const CrosswalkSchema = z.object({
  /** Canonical id = `CFBD-<espnId>` (ESPN/CFBD share the namespace). */
  playerId: z.string(),
  espnId: z.string().nullable(),
  /** Always === espnId for spine players (same namespace); null for official-only. */
  cfbdId: z.string().nullable(),
  player247Id: z.string().nullable().optional(),
  on3Id: z.string().nullable().optional(),
  /** The official-site name we matched (for audit of the name-only join). */
  officialName: z.string().nullable().optional(),
  /** The OurLads depth name we matched (for audit). */
  ourladsName: z.string().nullable().optional(),
})
export type Crosswalk = z.infer<typeof CrosswalkSchema>

/** First-class per-player flags (set by the merge engine). */
export const MasterFlagsSchema = z.object({
  /** On the roster but no recruiting record (walk-on signal). */
  isWalkOn: z.boolean(),
  /** No 2025 CFBD data at all (transfer-in / true freshman new in 2026). */
  newIn2026: z.boolean(),
  /** No stars from any recruiting source. */
  unrated: z.boolean(),
  /** ESPN previousSchool/official previousSchool or CFBD transfer flag. */
  isTransfer: z.boolean(),
  /** Redshirt — from inferRedshirt where recruiting year known, else 'RS' class string. */
  isRedshirt: z.boolean(),
  /** Spine-only stub (ESPN had no match, depth-chart only). */
  isStub: z.boolean(),
})
export type MasterFlags = z.infer<typeof MasterFlagsSchema>

/** Recruiting summary (CFBD 247-composite primary, On3/Rivals fill). */
export const MasterRecruitingSchema = z.object({
  stars: z.number().int().min(0).max(5).nullable(),
  compositeRating: z.number().min(0).max(1).nullable(),
  nationalRank: z.number().nullable(),
  positionRank: z.number().nullable(),
  transferPortalStars: z.number().int().min(0).max(5).nullable().optional(),
  transferRating: z.number().nullable().optional(),
  fromSchool: z.string().nullable().optional(),
  /** Precedence-ranked join method for the winning recruiting record. */
  matchMethod: z.enum(['cfbd-id', '247-id', 'name-fuzzy', 'on3', 'none']),
  source: MasterSourceSchema.nullable(),
})
export type MasterRecruiting = z.infer<typeof MasterRecruitingSchema>

/** Production summary (CFBD 2025, returning players only). */
export const MasterProductionSchema = z.object({
  /** productionSeason the figures describe (2025 in the pilot round). */
  season: z.number().nullable(),
  games: z.number().int().min(0).nullable(),
  stats: z.record(z.string(), z.number()),
  /** Optional per-game stat log (one entry per appearance); null when absent. */
  perGame: z.array(PerGameLogSchema).nullable().optional(),
  /** Snap-share involvement (usage.overall). */
  usageOverall: z.number().nullable(),
  /** Per-play efficiency (averagePPA.all). */
  ppaAll: z.number().nullable(),
})
export type MasterProduction = z.infer<typeof MasterProductionSchema>

/** Advanced summary (full usage/PPA splits, CFBD 2025). */
export const MasterAdvancedSchema = z.object({
  usage: UsageSchema.nullable(),
  ppa: PpaSchema.nullable(),
})

export const PlayerMasterSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  crosswalk: CrosswalkSchema,
  // ── Merged, conflict-aware fields (official → ESPN → CFBD precedence) ──
  jersey: NumField,
  position: StrField,
  side: StrField,
  classYear: StrField,
  height: StrField,
  heightIn: NumField,
  weight: NumField,
  hometown: StrField,
  homeState: StrField,
  highSchool: StrField,
  previousSchool: StrField,
  headshotUrl: StrField,
  status: StrField,
  // ── Nested summaries ──
  recruiting: MasterRecruitingSchema,
  production: MasterProductionSchema,
  advanced: MasterAdvancedSchema,
  flags: MasterFlagsSchema,
})
export type PlayerMaster = z.infer<typeof PlayerMasterSchema>

/** Coverage + conflict report embedded in the master file. */
export const ReconciliationReportSchema = z.object({
  spineCount: z.number(),
  masterCount: z.number(),
  matchedByIdPct: z.number(),
  fuzzyCount: z.number(),
  walkOns: z.number(),
  newIn2026: z.number(),
  unrated: z.number(),
  isTransfer: z.number(),
  headshotPct: z.number(),
  highSchoolPct: z.number(),
  previousSchoolPct: z.number(),
  hometownPct: z.number(),
  productionReturningPct: z.number(),
  perFieldConflictCounts: z.record(z.string(), z.number()),
  officialDegraded: z.boolean(),
  on3Degraded: z.boolean(),
})
export type ReconciliationReport = z.infer<typeof ReconciliationReportSchema>

export const PlayerMasterSourceSchema = z.object({
  sourceId: z.literal('player-master-v1'),
  sourceType: z.literal('player-master'),
  team: z.string(),
  provenance: ProvenanceSchema.extend({
    rosterSeason: z.number(),
    productionSeason: z.number(),
  }),
  players: z.array(PlayerMasterSchema),
  depthChart: z.object({
    offense: z.record(z.string(), z.string()),
    defense: z.record(z.string(), z.string()),
  }),
  depthChartMeta: DepthChartMetaSchema.optional(),
  /** Team-level returning production (CFBD /player/returning, productionSeason). */
  returningProduction: ReturningProductionSchema.nullable(),
  reconciliation: ReconciliationReportSchema,
})
export type PlayerMasterSource = z.infer<typeof PlayerMasterSourceSchema>
