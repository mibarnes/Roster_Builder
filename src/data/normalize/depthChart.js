const WR_SOURCE_PRIORITY = ['WRX', 'WRZ', 'SLOT'];

const offenseSlotAliases = {
  WR1: 'WR1',
  WR2: 'WR2',
  WR3: 'WR3',
  WRX: 'WR1',
  WRZ: 'WR2',
  SLOT: 'WR3',
  X: 'WR1',
  Z: 'WR2',
  SL: 'WR3'
};

const defenseSlotAliases = {
  DE1: 'LDE',
  DE2: 'RDE',
  DT1: 'NT',
  DT2: 'DT',
  DT: 'DT',
  LB1: 'WLB',
  LB2: 'MLB',
  LB3: 'NB',
  CB1: 'LCB',
  CB2: 'RCB',
  S1: 'SS',
  S2: 'FS'
};

const withoutUndefinedValues = (slots = {}) => (
  Object.fromEntries(Object.entries(slots).filter(([, value]) => value !== undefined))
);

const normalizeOffenseSlots = (offense = {}) => {
  const normalized = withoutUndefinedValues(offense);

  for (const [sourceSlot, canonicalSlot] of Object.entries(offenseSlotAliases)) {
    if (offense[sourceSlot] && !normalized[canonicalSlot]) {
      normalized[canonicalSlot] = offense[sourceSlot];
    }
  }

  const wrValues = WR_SOURCE_PRIORITY.map((slot) => offense[slot]).filter(Boolean);
  if (!normalized.WR1 && wrValues[0]) normalized.WR1 = wrValues[0];
  if (!normalized.WR2 && wrValues[1]) normalized.WR2 = wrValues[1];
  if (!normalized.WR3 && wrValues[2]) normalized.WR3 = wrValues[2];

  return normalized;
};

const normalizeDefenseSlots = (defense = {}) => {
  const normalized = withoutUndefinedValues(defense);

  for (const [slot, playerId] of Object.entries(defense ?? {})) {
    const match = slot.match(/^([A-Z]+)(\d+)?$/);
    if (!match) continue;

    const canonicalBase = defenseSlotAliases[match[1]];
    if (!canonicalBase) continue;

    const canonicalSlot = `${canonicalBase}${match[2] ?? ''}`;
    if (!normalized[canonicalSlot]) {
      normalized[canonicalSlot] = playerId;
    }
  }

  return normalized;
};

export const normalizeDepthChart = (depthChart = {}) => ({
  ...depthChart,
  offense: normalizeOffenseSlots(depthChart.offense),
  defense: normalizeDefenseSlots(depthChart.defense),
  slotMetadata: {
    wrCanonical: ['WR1', 'WR2', 'WR3'],
    sourcePriority: WR_SOURCE_PRIORITY,
    defenseCanonical: ['LDE', 'RDE', 'NT', 'DT', 'WLB', 'MLB', 'NB', 'LCB', 'RCB', 'SS', 'FS']
  }
});
