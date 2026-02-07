const WR_SOURCE_PRIORITY = ['WRX', 'WRZ', 'SLOT'];

const slotAliases = {
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

const normalizeOffenseSlots = (offense = {}) => {
  const normalized = { ...offense };

  for (const [sourceSlot, canonicalSlot] of Object.entries(slotAliases)) {
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

export const normalizeDepthChart = (depthChart = {}) => ({
  ...depthChart,
  offense: normalizeOffenseSlots(depthChart.offense),
  defense: { ...(depthChart.defense ?? {}) },
  slotMetadata: {
    wrCanonical: ['WR1', 'WR2', 'WR3'],
    sourcePriority: WR_SOURCE_PRIORITY
  }
});
