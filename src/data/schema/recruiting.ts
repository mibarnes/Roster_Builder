import { z } from 'zod'
import { MatchMethodSchema, SourceMetaSchema } from './common.ts'

/** A 0–1 composite rating (247/CFBD). Tightened from a bare number. */
const Rating01 = z.number().min(0).max(1)

/**
 * Precedence-tagged origin of a recruiting record (C2). Mirrors the
 * `RecruitSource` union in scripts/collect/recruiting.ts.
 */
export const RecruitSourceSchema = z.enum([
  'cfbd-team',
  'cfbd-natl-id',
  'cfbd-natl-name',
  'cfbd-portal',
  '247-portal',
  'none',
])
export type RecruitSourceTag = z.infer<typeof RecruitSourceSchema>

/** One recruiting match record (per source year). */
export const RecruitMatchSchema = z.object({
  year: z.number().optional(),
  method: z.string(),
  similarity: z.number().optional(),
  player247Id: z.string().nullable().optional(),
  cfbdRecruitId: z.string().nullable().optional(),
})

export const RecruitProfileSchema = z.object({
  playerId: z.string(),
  name: z.string().optional(),
  stars: z.number().int().min(0).max(5).nullable().optional(),
  /** 247/CFBD composite, 0–1 scale (tightened). */
  compositeRating: Rating01.nullable().optional(),
  nationalRank: z.number().nullable().optional(),
  positionRank: z.number().nullable().optional(),
  transferPortalStars: z.number().int().min(0).max(5).nullable().optional(),
  transferRating: z.number().nullable().optional(),
  fromSchool: z.string().nullable().optional(),
  isTransfer: z.boolean().optional(),
  years: z.array(z.number()).optional(),
  /** How this profile was joined to the roster player (precedence-ranked). */
  matchMethod: MatchMethodSchema.optional(),
  matches: z.array(RecruitMatchSchema).optional(),
  // ── Hometown (CFBD /recruiting/players hometownInfo) ──────────────────────
  homeCity: z.string().nullable().optional(),
  homeState: z.string().nullable().optional(),
  homeLat: z.number().nullable().optional(),
  homeLon: z.number().nullable().optional(),
  // ── C2: full-spine precedence provenance ──────────────────────────────────
  source: RecruitSourceSchema.nullable().optional(),
  recruitedSchool: z.string().nullable().optional(),
  recruitYear: z.number().nullable().optional(),
  origin: z.string().nullable().optional(),
  eligibility: z.string().nullable().optional(),
})
export type RecruitProfile = z.infer<typeof RecruitProfileSchema>

export const TeamClassRankingSchema = z
  .object({
    year: z.number().optional(),
    team: z.string().optional(),
    source: z.string().optional(),
    overallRank: z.number().nullable().optional(),
    compositeRank: z.number().nullable().optional(),
    transferRank: z.number().nullable().optional(),
  })
  .passthrough()

export const RecruitingSourceSchema = SourceMetaSchema.extend({
  sourceType: z.literal('recruiting'),
  playerRecruitProfiles: z.array(RecruitProfileSchema),
  teamClassRankings: z.array(TeamClassRankingSchema).optional(),
}).passthrough()
export type RecruitingSource = z.infer<typeof RecruitingSourceSchema>
