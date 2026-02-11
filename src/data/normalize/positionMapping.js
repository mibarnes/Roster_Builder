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
      C: ['C']
    }
  },
  defense: {
    DE: ['DE', 'LDE', 'RDE'],
    DT: ['DT', 'NT'],
    LB: {
      LB: ['LB'],
      MLB: ['MLB', 'MIKE', 'MONEY'],
      WLB: ['WLB', 'WILL', 'JACK', 'BUCK', 'STING'],
      SLB: ['SLB', 'SAM', 'WOLF', 'MAC', 'DOG']
    },
    DB: {
      CB: ['CB', 'LCB', 'RCB'],
      NB: ['NB', 'NICKEL', 'STAR', 'HUSKY'],
      S: {
        FS: ['FS'],
        SS: ['SS']
      }
    }
  }
};

const normalizeToken = (value = '') =>
  String(value).toUpperCase().trim().replace(/\s+/g, '').replace(/_/g, '-');

const aliasEntries = [
  ...POSITION_CLEANING_MAP.offense.QB.map((alias) => [alias, 'QB']),
  ...POSITION_CLEANING_MAP.offense.RB.map((alias) => [alias, 'RB']),
  ...POSITION_CLEANING_MAP.offense.WR.map((alias) => [alias, 'WR']),
  ...POSITION_CLEANING_MAP.offense.TE.map((alias) => [alias, 'TE']),
  ...POSITION_CLEANING_MAP.offense.OL.OL.map((alias) => [alias, 'OL']),
  ...POSITION_CLEANING_MAP.offense.OL.T.map((alias) => [alias, 'T']),
  ...POSITION_CLEANING_MAP.offense.OL.G.map((alias) => [alias, 'G']),
  ...POSITION_CLEANING_MAP.offense.OL.C.map((alias) => [alias, 'C']),
  ...POSITION_CLEANING_MAP.defense.DE.map((alias) => [alias, 'DE']),
  ...POSITION_CLEANING_MAP.defense.DT.map((alias) => [alias, 'DT']),
  ...POSITION_CLEANING_MAP.defense.LB.LB.map((alias) => [alias, 'LB']),
  ...POSITION_CLEANING_MAP.defense.LB.MLB.map((alias) => [alias, 'MLB']),
  ...POSITION_CLEANING_MAP.defense.LB.WLB.map((alias) => [alias, 'WLB']),
  ...POSITION_CLEANING_MAP.defense.LB.SLB.map((alias) => [alias, 'SLB']),
  ...POSITION_CLEANING_MAP.defense.DB.CB.map((alias) => [alias, 'CB']),
  ...POSITION_CLEANING_MAP.defense.DB.NB.map((alias) => [alias, 'NB']),
  ...POSITION_CLEANING_MAP.defense.DB.S.FS.map((alias) => [alias, 'FS']),
  ...POSITION_CLEANING_MAP.defense.DB.S.SS.map((alias) => [alias, 'SS'])
];

const ALIAS_TO_CANONICAL_GROUP = new Map(aliasEntries.map(([alias, canonical]) => [normalizeToken(alias), canonical]));

export const canonicalizePositionGroup = (value = '') => {
  const token = normalizeToken(value);
  return ALIAS_TO_CANONICAL_GROUP.get(token) ?? token;
};

