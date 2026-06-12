/**
 * OurLads depth-chart HTML parser — PURE functions (html string → parsed rows
 * → depth chart). Isolated for unit testing against a saved fixture.
 * Ported from collect-cfbd-roster-stats.mjs.
 */
import {
  buildRosterNameIndex,
  canonicalizePositionGroup,
  normalizeOurladsPosition,
  resolveByStdName,
  stdName,
  stripTags,
  type RosterPlayerLike,
} from '../normalize.ts'

export const OURLADS_TBODY_IDS = {
  offense: 'ctl00_phContent_dcTBody',
  defense: 'ctl00_phContent_dcTBody2',
  specialTeams: 'ctl00_phContent_dcTBody3',
} as const

const OURLADS_DIRECT_SLOT_MAP: Record<string, string> = {
  'WR-X': 'WRX', 'WR-Z': 'WRZ', 'WR-SL': 'SLOT', 'WR-H': 'SLOT', SLOT: 'SLOT',
  LT: 'LT', LG: 'LG', C: 'C', RG: 'RG', RT: 'RT',
  TE: 'TE', 'H-BACK': 'TE', QB: 'QB', RB: 'RB', HB: 'RB', TB: 'RB', FB: 'RB',
  LDE: 'LDE', NT: 'NT', DT: 'DT', RDE: 'RDE',
  WLB: 'WLB', MLB: 'MLB', NB: 'NB',
  LCB: 'LCB', SS: 'SS', FS: 'FS', RCB: 'RCB',
  'WR-Y': 'SLOT', JACK: 'LDE',
}

const OURLADS_SLOT_CHAINS: Record<'OFF' | 'DEF', Record<string, string[]>> = {
  OFF: {
    WR: ['WRX', 'SLOT', 'WRZ'],
    'WR-Y': ['SLOT', 'WRX', 'WRZ'],
    QB: ['QB'], RB: ['RB'], TE: ['TE'],
    OL: ['LT', 'LG', 'C', 'RG', 'RT'],
    T: ['LT', 'RT'], G: ['LG', 'RG'], C: ['C'],
  },
  DEF: {
    DE: ['LDE', 'RDE'], DT: ['NT', 'DT'],
    LB: ['WLB', 'MLB', 'NB'], MLB: ['MLB'], WLB: ['WLB'], SLB: ['NB'],
    CB: ['LCB', 'RCB'], NB: ['NB'], S: ['SS', 'FS'], SS: ['SS'], FS: ['FS'],
    DB: ['LCB', 'RCB', 'NB'],
    JACK: ['LDE', 'RDE'], WOLF: ['WLB', 'MLB'], STING: ['NB', 'RCB'], HUSKY: ['NB', 'SS'],
  },
}

export interface OurladsRow {
  position: string
  /** Up to 5 depth slots of resolved display names (null where empty). */
  players: (string | null)[]
}

const parseOurladsName = (text: string): string | null => {
  const plain = stripTags(text).trim()
  if (!plain) return null
  const withoutYear = plain
    .replace(/\s+(?:RS\s+)?(?:FR|SO|JR|SR|GR)(?:\s*\/\s*TR)?$/i, '')
    .replace(/\s+TR$/i, '')
    .trim()
  if (!withoutYear) return null
  if (withoutYear.includes(',')) {
    const [last, first] = withoutYear.split(',').map((p) => p.trim())
    return `${first} ${last}`.replace(/\s+/g, ' ').trim()
  }
  return withoutYear.replace(/\s+/g, ' ').trim()
}

/** Parse the rows of a single OurLads <tbody> HTML chunk into position rows. */
export const parseOurladsDepthTable = (tbodyHtml: string): OurladsRow[] => {
  const rows: OurladsRow[] = []
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowPattern.exec(tbodyHtml))) {
    const rowHtml = rowMatch[1]!
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]!)
    if (cells.length < 3) continue
    const position = stripTags(cells[0]!).toUpperCase().replace(/\s+/g, '')
    const players: (string | null)[] = []
    for (let depth = 1; depth <= 5; depth += 1) {
      players.push(parseOurladsName(cells[depth * 2] ?? ''))
    }
    rows.push({ position, players })
  }
  return rows
}

/** Extract + parse one named tbody section from the full page HTML. */
export const extractOurladsSectionRows = (html: string, tbodyId: string): OurladsRow[] => {
  const pattern = new RegExp(`<tbody id="${tbodyId}">([\\s\\S]*?)<\\/tbody>`, 'i')
  const match = html.match(pattern)
  if (!match) return []
  return parseOurladsDepthTable(match[1]!)
}

const normalizeDepthPositionToken = (value = ''): string =>
  String(value).toUpperCase().trim().replace(/\s+/g, '').replace(/_/g, '-')

const resolveOurladsSlot = (rawPosition: string, side: 'OFF' | 'DEF', usedSlots: Set<string>): string | null => {
  const posTag = normalizeDepthPositionToken(rawPosition)
  const direct = OURLADS_DIRECT_SLOT_MAP[posTag]
  if (direct) return direct
  const positionGroup = canonicalizePositionGroup(posTag)
  const chain = OURLADS_SLOT_CHAINS[side][positionGroup]
  if (!chain?.length) return null
  return chain.find((slot) => !usedSlots.has(slot)) ?? chain[0]!
}

export interface OurladsStub {
  playerId: string
  name: string
  number: null
  side: 'OFF' | 'DEF'
  position: string
  classYear: null
  isTransfer: boolean
  eligibilityRemaining: null
  height: null
  weight: null
}

export interface UnmatchedOurlads {
  slot: string
  depth: number
  name: string
  cleanedName: string
}

interface MappedSide {
  slots: Record<string, string>
  unmatched: UnmatchedOurlads[]
  stubs: OurladsStub[]
}

const mapOurladsDepthToRoster = (
  rows: OurladsRow[],
  side: 'OFF' | 'DEF',
  index: ReturnType<typeof buildRosterNameIndex>,
): MappedSide => {
  const slots: Record<string, string> = {}
  const unmatched: UnmatchedOurlads[] = []
  const stubs: OurladsStub[] = []
  const usedSlots = new Set<string>()

  for (const row of rows) {
    const canonicalSlot = resolveOurladsSlot(row.position, side, usedSlots)
    if (!canonicalSlot) continue
    usedSlots.add(canonicalSlot)

    row.players.forEach((name, idx) => {
      if (!name) return
      const resolved = resolveByStdName({
        ourladsName: name,
        ourladsPosition: row.position,
        ourladsEligibility: null,
        rosterByStdName: index.rosterByStdName,
        rosterNamePairs: index.rosterNamePairs,
      })
      const key = idx === 0 ? canonicalSlot : `${canonicalSlot}${idx + 1}`
      if (!resolved) {
        unmatched.push({ slot: canonicalSlot, depth: idx + 1, name, cleanedName: stdName(name) })
        const stub: OurladsStub = {
          playerId: `ourlads-stub-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name,
          number: null,
          side,
          position: normalizeOurladsPosition(row.position) ?? row.position,
          classYear: null,
          isTransfer: false,
          eligibilityRemaining: null,
          height: null,
          weight: null,
        }
        stubs.push(stub)
        slots[key] = stub.playerId
        return
      }
      slots[key] = resolved.playerId
    })
  }

  return { slots, unmatched, stubs }
}

export interface DepthChartResult {
  depthChart: { offense: Record<string, string>; defense: Record<string, string> }
  unmatched: UnmatchedOurlads[]
  stubs: OurladsStub[]
  parsedRows: { offense: number; defense: number }
}

/** Full pipeline: page HTML + roster players → resolved depth chart + stubs. */
export const buildDepthChartFromOurlads = (html: string, rosterPlayers: RosterPlayerLike[]): DepthChartResult => {
  const index = buildRosterNameIndex(rosterPlayers)
  const offenseRows = extractOurladsSectionRows(html, OURLADS_TBODY_IDS.offense)
  const defenseRows = extractOurladsSectionRows(html, OURLADS_TBODY_IDS.defense)

  const offenseMapped = mapOurladsDepthToRoster(offenseRows, 'OFF', index)
  const defenseMapped = mapOurladsDepthToRoster(defenseRows, 'DEF', index)

  return {
    depthChart: { offense: offenseMapped.slots, defense: defenseMapped.slots },
    unmatched: [...offenseMapped.unmatched, ...defenseMapped.unmatched],
    stubs: [...offenseMapped.stubs, ...defenseMapped.stubs],
    parsedRows: { offense: offenseRows.length, defense: defenseRows.length },
  }
}
