/**
 * Depth-chart slot canonicalization. Ported faithfully from the recovered
 * data/normalize/depthChart.js. Resolves WR / DL / LB / DB slot aliases to
 * canonical slot ids before the pipeline joins them to players.
 */

type SlotMap = Record<string, string>

interface DepthChartInput {
  offense?: SlotMap
  defense?: SlotMap
  [key: string]: unknown
}

const WR_SOURCE_PRIORITY = ['WRX', 'WRZ', 'SLOT'] as const

const offenseSlotAliases: Record<string, string> = {
  WR1: 'WR1',
  WR2: 'WR2',
  WR3: 'WR3',
  WRX: 'WR1',
  WRZ: 'WR2',
  SLOT: 'WR3',
  X: 'WR1',
  Z: 'WR2',
  SL: 'WR3',
}

const defenseSlotAliases: Record<string, string> = {
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
  S2: 'FS',
}

const withoutUndefinedValues = (slots: SlotMap = {}): SlotMap =>
  Object.fromEntries(Object.entries(slots).filter(([, value]) => value !== undefined))

const normalizeOffenseSlots = (offense: SlotMap = {}): SlotMap => {
  const normalized = withoutUndefinedValues(offense)

  for (const [sourceSlot, canonicalSlot] of Object.entries(offenseSlotAliases)) {
    const value = offense[sourceSlot]
    if (value && !normalized[canonicalSlot]) {
      normalized[canonicalSlot] = value
    }
  }

  const wrValues = WR_SOURCE_PRIORITY.map((slot) => offense[slot]).filter(Boolean) as string[]
  if (!normalized.WR1 && wrValues[0]) normalized.WR1 = wrValues[0]
  if (!normalized.WR2 && wrValues[1]) normalized.WR2 = wrValues[1]
  if (!normalized.WR3 && wrValues[2]) normalized.WR3 = wrValues[2]

  return normalized
}

const normalizeDefenseSlots = (defense: SlotMap = {}): SlotMap => {
  const normalized = withoutUndefinedValues(defense)

  for (const [slot, playerId] of Object.entries(defense)) {
    const match = slot.match(/^([A-Z]+)(\d+)?$/)
    if (!match) continue

    const canonicalBase = defenseSlotAliases[match[1] as string]
    if (!canonicalBase) continue

    const canonicalSlot = `${canonicalBase}${match[2] ?? ''}`
    if (!normalized[canonicalSlot]) {
      normalized[canonicalSlot] = playerId
    }
  }

  return normalized
}

export const normalizeDepthChart = (depthChart: DepthChartInput = {}) => ({
  ...depthChart,
  offense: normalizeOffenseSlots(depthChart.offense),
  defense: normalizeDefenseSlots(depthChart.defense),
  slotMetadata: {
    wrCanonical: ['WR1', 'WR2', 'WR3'],
    sourcePriority: WR_SOURCE_PRIORITY,
    defenseCanonical: ['LDE', 'RDE', 'NT', 'DT', 'WLB', 'MLB', 'NB', 'LCB', 'RCB', 'SS', 'FS'],
  },
})
