import { z } from 'zod'

/** Roster side as stored by the CFBD collector. */
export const SideSchema = z.enum(['OFF', 'DEF'])
export type Side = z.infer<typeof SideSchema>

/** Class year; collector emits null for unknowns. */
export const ClassYearSchema = z.enum(['FR', 'SO', 'JR', 'SR']).nullable()
export type ClassYear = z.infer<typeof ClassYearSchema>

/**
 * How a recruiting/advanced profile was joined to a roster player.
 *  - cfbd-id:   CFBD athleteId === roster CFBD id (cleanest)
 *  - 247-id:    247Sports player247Id matched a known id
 *  - name-fuzzy: last-resort fuzzy name resolution (flagged for review)
 *  - none:      no external recruiting/advanced record matched
 */
export const MatchMethodSchema = z.enum(['cfbd-id', '247-id', 'name-fuzzy', 'none'])
export type MatchMethod = z.infer<typeof MatchMethodSchema>

/**
 * Provenance + data-vintage block written into every collected source file.
 * Distinguishes collectedAt (wall-clock of THIS run) from dataSeason (the
 * football season the data describes). collectorVersion is the git short SHA
 * at runtime (fallback 'dev'). Prior vintages are preserved via _history.json.
 */
export const ProvenanceSourceSchema = z.object({
  name: z.string(),
  endpoint: z.string().optional(),
  url: z.string().optional(),
})

export const ProvenanceSchema = z.object({
  sources: z.array(ProvenanceSourceSchema),
  collectedAt: z.string(),
  collectorVersion: z.string(),
  dataSeason: z.number(),
  dataCutoff: z.string().nullable().optional(),
})
export type Provenance = z.infer<typeof ProvenanceSchema>

/** A source-file envelope every collected source shares. */
export const SourceMetaSchema = z.object({
  sourceId: z.string(),
  sourceType: z.string(),
  asOf: z.string().optional(),
  version: z.string().optional(),
  team: z.string().optional(),
  season: z.number().optional(),
  provenance: ProvenanceSchema.optional(),
})
