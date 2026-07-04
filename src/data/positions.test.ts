import { describe, expect, it } from 'vitest'
import {
  canonicalizePositionGroup,
  DEFENSE_GROUPS,
  OFFENSE_GROUPS,
  POSITION_ALLOWLIST,
  PositionSchema,
  safePosition,
  SLOT_ALIASES,
  SLOT_POS_OVERRIDE,
  ST_GROUPS,
} from './positions.ts'

describe('positions — allowlist + schema', () => {
  it('accepts every allowlisted position and rejects an off-list token', () => {
    for (const p of POSITION_ALLOWLIST) expect(PositionSchema.parse(p)).toBe(p)
    expect(PositionSchema.safeParse('QUARTERBACK').success).toBe(false)
  })
})

describe('positions — safePosition', () => {
  it('applies the ST alias, passes through valid, and falls back to ATH', () => {
    expect(safePosition('K')).toBe('PK')
    expect(safePosition('P')).toBe('PT')
    expect(safePosition('SN')).toBe('LS')
    expect(safePosition('QB')).toBe('QB')
    expect(safePosition('WR')).toBe('WR')
    expect(safePosition('NOTAPOS')).toBe('ATH')
    expect(safePosition(null)).toBe('ATH')
  })
})

describe('positions — canonicalizePositionGroup', () => {
  it('maps scheme-specific tokens to canonical group codes', () => {
    expect(canonicalizePositionGroup('LT')).toBe('T')
    expect(canonicalizePositionGroup('RG')).toBe('G')
    expect(canonicalizePositionGroup('MIKE')).toBe('MLB')
    expect(canonicalizePositionGroup('JACK')).toBe('WLB')
    expect(canonicalizePositionGroup('NICKEL')).toBe('NB')
    expect(canonicalizePositionGroup('HUSKY')).toBe('NB')
    expect(canonicalizePositionGroup('SLOT')).toBe('WR')
  })
  it('returns the normalized token unchanged when unknown', () => {
    expect(canonicalizePositionGroup('qb')).toBe('QB')
    expect(canonicalizePositionGroup('zzz')).toBe('ZZZ')
  })
})

describe('positions — slot maps + taxonomy', () => {
  it('carries the depth-chart slot aliases + display overrides', () => {
    expect(SLOT_ALIASES.WR1).toBe('WRX')
    expect(SLOT_POS_OVERRIDE.SS).toBe('S')
    expect(SLOT_POS_OVERRIDE.LCB).toBe('CB')
  })
  it('exposes offense/defense/ST group taxonomies', () => {
    expect(OFFENSE_GROUPS.map((g) => g.label)).toContain('OL')
    expect(DEFENSE_GROUPS.map((g) => g.label)).toContain('DL')
    // ST taxonomy is defined for U6/F6 (positions only, not yet wired into the grid).
    expect(ST_GROUPS.flatMap((g) => g.positions)).toEqual(['PK', 'PT', 'LS'])
  })
})
