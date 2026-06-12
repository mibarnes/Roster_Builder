import { z } from 'zod'

/** Roster side as stored by the CFBD collector. */
export const SideSchema = z.enum(['OFF', 'DEF'])
export type Side = z.infer<typeof SideSchema>

/** Class year; collector emits null for unknowns. */
export const ClassYearSchema = z.enum(['FR', 'SO', 'JR', 'SR']).nullable()
export type ClassYear = z.infer<typeof ClassYearSchema>

/** A source-file envelope every collected source shares. */
export const SourceMetaSchema = z.object({
  sourceId: z.string(),
  sourceType: z.string(),
  asOf: z.string().optional(),
  version: z.string().optional(),
  team: z.string().optional(),
  season: z.number().optional(),
})
