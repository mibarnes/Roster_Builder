/**
 * formations.ts — U9 formation-alignment registry.
 *
 * The depth chart CFBD provides is a fixed nickel (4-2-5) personnel set: 11
 * offensive slots (LT LG C RG RT / WRX SLOT WRZ / QB RB TE) and 11 defensive
 * (LDE NT DT RDE / WLB MLB NB / LCB SS FS RCB) — see positions.ts. We therefore
 * do NOT invent personnel schemes (4-3 vs 3-4, 11 vs 12) that the data can't
 * honestly back; instead each scheme is an ALIGNMENT of the SAME real players,
 * differing only in where a slot lines up (and, for a dual-role athlete, its
 * label). This lifts the previously hard-coded JSX layouts in
 * Offense/DefenseFormation into data so a scheme toggle can swap them.
 *
 * A scheme is rows of cells; a cell is either a slot reference (rendered as that
 * slot's PositionGroup) or null (a spacer that holds a column open). Every cell's
 * `slot` must be a real slot from positions.ts — no phantom slots.
 */

/** A placed slot (with an optional alignment-specific display label override). */
export interface FormationCell {
  slot: string
  label: string
}

/** One horizontal row of the field; null = an empty holding column. */
export type FormationRow = Array<FormationCell | null>

export interface FormationScheme {
  id: string
  /** Toggle label. */
  label: string
  /** One-line honest description of the alignment. */
  hint: string
  rows: FormationRow[]
}

const c = (slot: string, label: string): FormationCell => ({ slot, label })

// ── Offense — same 11 slots, two alignments ────────────────────────────────
export const OFFENSE_SCHEMES: readonly FormationScheme[] = [
  {
    id: 'spread',
    label: 'Spread',
    hint: '3-WR spread — slot inside, back offset',
    rows: [
      [c('LT', 'LT'), c('LG', 'LG'), c('C', 'C'), c('RG', 'RG'), c('RT', 'RT'), c('TE', 'TE')],
      [c('WRX', 'WR'), null, null, c('QB', 'QB'), null, c('SLOT', 'WR'), c('WRZ', 'WR')],
      [null, null, null, c('RB', 'RB'), null, null, null],
    ],
  },
  {
    id: 'pro',
    label: 'Pro',
    hint: 'Tight 2-WR — split ends wide, slot as an H-back wing, I-back',
    rows: [
      [c('WRX', 'WR'), c('LT', 'LT'), c('LG', 'LG'), c('C', 'C'), c('RG', 'RG'), c('RT', 'RT'), c('TE', 'TE'), c('WRZ', 'WR')],
      [null, null, null, c('QB', 'QB'), null, null, null, null],
      [null, null, c('SLOT', 'H'), c('RB', 'RB'), null, null, null, null],
    ],
  },
]

// ── Defense — same 11 slots; the nickel athlete (NB) drops down as a 5th DB or
//    lines up as a stand-up SAM in the box (real nickel-vs-base distinction). ──
export const DEFENSE_SCHEMES: readonly FormationScheme[] = [
  {
    id: 'nickel',
    label: 'Nickel',
    hint: '4-2-5 — nickel back as a 5th DB, two off-ball LBs',
    rows: [
      [c('LDE', 'DE'), c('NT', 'NT'), c('DT', 'DT'), c('RDE', 'DE')],
      [null, c('WLB', 'WLB'), c('MLB', 'MLB'), null],
      [c('LCB', 'CB'), c('NB', 'NB'), c('SS', 'SS'), c('FS', 'FS'), c('RCB', 'CB')],
    ],
  },
  {
    id: 'base',
    label: 'Base',
    hint: '4-3 look — same nickel athlete walked up as a SAM in the box',
    rows: [
      [c('LDE', 'DE'), c('NT', 'NT'), c('DT', 'DT'), c('RDE', 'DE')],
      [c('WLB', 'WLB'), c('MLB', 'MLB'), c('NB', 'SAM')],
      [c('LCB', 'CB'), c('SS', 'SS'), c('FS', 'FS'), c('RCB', 'CB')],
    ],
  },
]

export const DEFAULT_OFFENSE_SCHEME = OFFENSE_SCHEMES[0]!.id
export const DEFAULT_DEFENSE_SCHEME = DEFENSE_SCHEMES[0]!.id

export const getOffenseScheme = (id: string): FormationScheme =>
  OFFENSE_SCHEMES.find((s) => s.id === id) ?? OFFENSE_SCHEMES[0]!
export const getDefenseScheme = (id: string): FormationScheme =>
  DEFENSE_SCHEMES.find((s) => s.id === id) ?? DEFENSE_SCHEMES[0]!
