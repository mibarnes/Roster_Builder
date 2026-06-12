/**
 * Position canonicalization. Ported faithfully from the recovered
 * data/normalize/positionMapping.js. Maps source position tokens (LT, MIKE,
 * NICKEL, …) to canonical group codes (T, MLB, NB, …).
 */

export const POSITION_CLEANING_MAP = {
  offense: {
    QB: ['QB'],
    RB: ['RB', 'HB', 'TB', 'FB'],
    WR: ['WR-X', 'WR-Y', 'WR-Z', 'WR-SL', 'WR-H', 'SLOT'],
    TE: ['TE', 'H-BACK'],
    OL: {
      OL: ['OL'],
      T: ['LT', 'RT'],
      G: ['LG', 'RG'],
      C: ['C'],
    },
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
      S: {
        FS: ['FS'],
        SS: ['SS'],
      },
    },
  },
} as const

const normalizeToken = (value = ''): string =>
  String(value).toUpperCase().trim().replace(/\s+/g, '').replace(/_/g, '-')

const aliasEntries: Array<[string, string]> = [
  ...POSITION_CLEANING_MAP.offense.QB.map((alias) => [alias, 'QB'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.RB.map((alias) => [alias, 'RB'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.WR.map((alias) => [alias, 'WR'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.TE.map((alias) => [alias, 'TE'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.OL.map((alias) => [alias, 'OL'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.T.map((alias) => [alias, 'T'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.G.map((alias) => [alias, 'G'] as [string, string]),
  ...POSITION_CLEANING_MAP.offense.OL.C.map((alias) => [alias, 'C'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DE.map((alias) => [alias, 'DE'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DT.map((alias) => [alias, 'DT'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.LB.map((alias) => [alias, 'LB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.MLB.map((alias) => [alias, 'MLB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.WLB.map((alias) => [alias, 'WLB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.LB.SLB.map((alias) => [alias, 'SLB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.CB.map((alias) => [alias, 'CB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.NB.map((alias) => [alias, 'NB'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.S.FS.map((alias) => [alias, 'FS'] as [string, string]),
  ...POSITION_CLEANING_MAP.defense.DB.S.SS.map((alias) => [alias, 'SS'] as [string, string]),
]

const ALIAS_TO_CANONICAL_GROUP = new Map(
  aliasEntries.map(([alias, canonical]) => [normalizeToken(alias), canonical]),
)

export const canonicalizePositionGroup = (value = ''): string => {
  const token = normalizeToken(value)
  return ALIAS_TO_CANONICAL_GROUP.get(token) ?? token
}
