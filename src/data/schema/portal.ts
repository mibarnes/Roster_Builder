import { z } from 'zod'
import { ProvenanceSchema } from './common.ts'

/**
 * CFBD transfer-portal source (C1) — CFBD-native, NO scraping.
 *
 * Built from `/player/portal?year=Y` (no team) filtered to incoming entries
 * (destination === team.cfbdQuery). Supplies a transfer rating/stars + ORIGIN
 * school + ELIGIBILITY for the team's incoming transfers — the cross-school
 * signal the team's own `/recruiting/players?team=X` feed (own recruits only)
 * cannot see. A small file is persisted per team for provenance/auditing.
 */
export const PortalEntrySchema = z.object({
  name: z.string(),
  position: z.string().nullable(),
  /** Origin (previous) school. */
  origin: z.string().nullable(),
  /** Destination school === team.cfbdQuery (always the team, by construction). */
  destination: z.string().nullable(),
  /** 0–1 transfer rating (CFBD `rating`). */
  rating: z.number().min(0).max(1).nullable(),
  stars: z.number().int().min(0).max(5).nullable(),
  /** Remaining eligibility string as CFBD reports it (e.g. "Senior"). */
  eligibility: z.string().nullable(),
  transferDate: z.string().nullable(),
  /** Portal class year the entry belongs to (CFBD `season`). */
  season: z.number(),
})
export type PortalEntry = z.infer<typeof PortalEntrySchema>

export const PortalSourceSchema = z.object({
  sourceId: z.literal('cfbd-portal-v1'),
  sourceType: z.literal('cfbd-portal'),
  team: z.string(),
  /** Portal years fetched (e.g. [2024, 2025, 2026]). */
  years: z.array(z.number()),
  provenance: ProvenanceSchema,
  entries: z.array(PortalEntrySchema),
})
export type PortalSource = z.infer<typeof PortalSourceSchema>
