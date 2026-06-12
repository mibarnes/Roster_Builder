import { z } from 'zod'
import { SourceMetaSchema } from './common.ts'

export const RecruitProfileSchema = z
  .object({
    playerId: z.string(),
    name: z.string().optional(),
    stars: z.number().nullable().optional(),
    /** 247Sports composite, 0–1 scale. */
    compositeRating: z.number().nullable().optional(),
    nationalRank: z.number().nullable().optional(),
    positionRank: z.number().nullable().optional(),
    transferPortalStars: z.number().nullable().optional(),
    transferRating: z.number().nullable().optional(),
    fromSchool: z.string().nullable().optional(),
    isTransfer: z.boolean().optional(),
    years: z.array(z.number()).optional(),
  })
  .passthrough()
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
