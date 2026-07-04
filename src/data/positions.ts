/**
 * positions.ts — the SINGLE canonical source of truth for position knowledge.
 *
 * Before this module, position facts were scattered across (and duplicated
 * between) five+ sites: the roster allowlist (schema/roster.ts), a divergent
 * copy in masterToDataset.ts, the slot→position overrides in mapPipelineToUI.ts,
 * the position-cleaning map in normalize/positionMapping.ts, a byte-identical
 * duplicate in the collector (scripts/collect/normalize.ts), and the UI group
 * taxonomy (components/comparison/positionGrouping.ts). D6 (FINALIZATION_BLUEPRINT
 * Part 2.3) centralizes them here; every consumer — app AND collector — imports
 * from this file. Scripts may import from src/ (already the established pattern:
 * scripts/collect.ts imports the schemas + team registry from ../src/data).
 *
 * Everything here is PURE and behavior-preserving vs. the pre-D6 copies. Values
 * were carried over verbatim; unit-tested in positions.test.ts.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Allowlist — the broad positions the collector is permitted to emit.
//    Permissive-but-NAMED: covers every real football position the normalizer
//    produces (incl. special teams PK/PT/LS and ATH). A position outside this
//    set is a normalizer regression and should fail loud in zod validation
//    rather than be silently accepted. Add new positions here deliberately.
// ─────────────────────────────────────────────────────────────────────────────
export const POSITION_ALLOWLIST = [
  // offense
  'QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'T', 'G',
  // defense
  'DE', 'DT', 'NT', 'DL', 'LB', 'MLB', 'WLB', 'SLB', 'CB', 'NB', 'S', 'FS', 'SS', 'DB',
  // special teams / flex
  'PK', 'PT', 'LS', 'ATH',
] as const

export const PositionSchema = z.enum(POSITION_ALLOWLIST)
export type Position = z.infer<typeof PositionSchema>

const ALLOWED_POSITIONS: ReadonlySet<string> = new Set(POSITION_ALLOWLIST)

/** ESPN special-teams abbreviations → roster-allowlist positions. */
export const ST_POSITION_ALIAS: Record<string, string> = {
  K: 'PK', PK: 'PK', P: 'PT', PT: 'PT', LS: 'LS', SN: 'LS', H: 'PT', KO: 'PK',
}

/**
 * Coerce a free-form position string to the roster allowlist. Applies the ST
 * alias first, then falls back to 'ATH' for anything unrecognized. (Was the
 * divergent `safePosition` in masterToDataset.ts.)
 */
export const safePosition = (p: string | null): Position => {
  if (!p) return 'ATH'
  const aliased = ST_POSITION_ALIAS[p] ?? p
  return (ALLOWED_POSITIONS.has(aliased) ? aliased : 'ATH') as Position
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Position cleaning — source position tokens (LT, MIKE, NICKEL, …) → the
//    canonical group code (T, MLB, NB, …). Shared verbatim by the app pipeline
//    and the collector (was duplicated in normalize/positionMapping.ts and
//    scripts/collect/normalize.ts).
// ─────────────────────────────────────────────────────────────────────────────
export const POSITION_CLEANING_MAP = {
  offense: {
    QB: ['QB'],
    RB: ['RB', 'HB', 'TB', 'FB'],
    WR: ['WR-X', 'WR-Y', 'WR-Z', 'WR-SL', 'WR-H', 'SLOT'],
    TE: ['TE', 'H-BACK'],
    OL: { OL: ['OL'], T: ['LT', 'RT'], G: ['LG', 'RG'], C: ['C'] },
  },
  defense: {
    DE: ['DE', 'LDE', 'RDE'],
    DT: ['DT', 'NT'],
    LB: {
      LB: ['LB'],
      MLB: ['MLB', 'MIKE', 'MONEY'],
      WLB: ['WLB', 'WILL', 'JACK', 'BUCK', 'STING'],
      SLB: ['SLB', 'SAM', 'WOLF', 'MAC', 'DOG'],
    },
    DB: {
      CB: ['CB', 'LCB', 'RCB'],
      NB: ['NB', 'NICKEL', 'STAR', 'HUSKY'],
      S: { FS: ['FS'], SS: ['SS'] },
    },
  },
} as const

/** Uppercase, strip whitespace, normalize underscores → hyphens. */
export const normalizeToken = (value = ''): string =>
  String(value).toUpperCase().trim().replace(/\s+/g, '').replace(/_/g, '-')

const aliasEntries: Array<[string, string]> = [
  ...POSITION_CLEANING_MAP.offense.QB.map((a) => [a, 'QB'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.RB.map((a) => [a, 'RB'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.WR.map((a) => [a, 'WR'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.TE.map((a) => [a, 'TE'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.OL.map((a) => [a, 'OL'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.T.map((a) => [a, 'T'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.G.map((a) => [a, 'G'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.C.map((a) => [a, 'C'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DE.map((a) => [a, 'DE'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DT.map((a) => [a, 'DT'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.LB.map((a) => [a, 'LB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.MLB.map((a) => [a, 'MLB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.WLB.map((a) => [a, 'WLB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.SLB.map((a) => [a, 'SLB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.CB.map((a) => [a, 'CB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.NB.map((a) => [a, 'NB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.S.FS.map((a) => [a, 'FS'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.S.SS.map((a) => [a, 'SS'] as [string, string]),
]

const ALIAS_TO_CANONICAL_GROUP = new Map(
  aliasEntries.map(([alias, canonical]) => [normalizeToken(alias), canonical]),
)

/** A source position token → its canonical group code (unknown → the token). */
export const canonicalizePositionGroup = (value = ''): string => {
  const token = normalizeToken(value)
  return ALIAS_TO_CANONICAL_GROUP.get(token) ?? token
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Depth-chart slots — canonical slot ordering + aliases + the slot→display
//    override that resolves the CFBD broad-code problem (all DBs stored as 'DB')
//    using the depth-chart slot as ground truth. (Was in mapPipelineToUI.ts.)
// ─────────────────────────────────────────────────────────────────────────────
export const OFFENSE_SLOT_ORDER: string[] = [
  'LT', 'LG', 'C', 'RG', 'RT', 'WRX', 'SLOT', 'QB', 'RB', 'TE', 'WRZ',
]
export const DEFENSE_SLOT_ORDER: string[] = [
  'LDE', 'NT', 'DT', 'RDE', 'LCB', 'SS', 'WLB', 'MLB', 'NB', 'FS', 'RCB',
]

export const SLOT_ALIASES: Record<string, string> = {
  WR1: 'WRX', WR2: 'WRZ', WR3: 'SLOT',
  DE1: 'LDE', DE2: 'RDE', DT1: 'NT', DT2: 'DT',
  LB1: 'WLB', LB2: 'MLB', LB3: 'NB',
  CB1: 'LCB', CB2: 'RCB', S1: 'SS', S2: 'FS',
}

export const SLOT_POS_OVERRIDE: Record<string, string> = {
  SS: 'S', FS: 'S', LCB: 'CB', RCB: 'CB', NB: 'NB',
  LDE: 'DE', RDE: 'DE', NT: 'NT', DT: 'DT', WLB: 'LB', MLB: 'LB',
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. UI group taxonomy — the position→group buckets the depth grid renders. A
//    player belongs to a group iff its (already slot-overridden) display pos is
//    in the group's list. (Was OFFENSE_GROUPS/DEFENSE_GROUPS in positionGrouping.ts.)
//    ST_GROUPS is defined here for completeness (D6 "incl. ST"); wiring special
//    teams into the UI is a separate item (U6/F6) — not rendered yet.
// ─────────────────────────────────────────────────────────────────────────────
export interface DepthGroupDef {
  label: string
  positions: string[]
}

export const OFFENSE_GROUPS: readonly DepthGroupDef[] = [
  { label: 'QB', positions: ['QB'] },
  { label: 'RB', positions: ['RB'] },
  { label: 'WR', positions: ['WR'] },
  { label: 'TE', positions: ['TE'] },
  { label: 'OL', positions: ['LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG'] },
]

export const DEFENSE_GROUPS: readonly DepthGroupDef[] = [
  { label: 'DL', positions: ['DE', 'DT', 'NT', 'DL'] },
  { label: 'LB', positions: ['LB'] },
  { label: 'CB', positions: ['CB'] },
  { label: 'S', positions: ['S'] },
  { label: 'NB', positions: ['NB'] },
  { label: 'DB', positions: ['DB'] },
]

/** Special-teams taxonomy — ready for U6/F6; not yet wired into the depth grid. */
export const ST_GROUPS: readonly DepthGroupDef[] = [
  { label: 'K', positions: ['PK'] },
  { label: 'P', positions: ['PT'] },
  { label: 'LS', positions: ['LS'] },
]
