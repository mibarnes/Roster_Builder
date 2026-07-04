/**
 * Shared, pure normalization helpers for the CFB data collector.
 * Ported from the recovered collector (collect-cfbd-roster-stats.mjs) +
 * src/data/positions.ts. No I/O, no network — safe to unit-test.
 */
import { canonicalizePositionGroup } from '../../src/data/positions.ts'

// Position-group canonicalization is the canonical SoT in src/data/positions.ts
// (D6). Re-exported here so the OurLads parser + other collector modules keep
// importing it from ../normalize.ts.
export { canonicalizePositionGroup }

export const OFFENSE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG'])
export const DEFENSE_POSITIONS = new Set(['DE', 'DT', 'NT', 'DL', 'LB', 'CB', 'S', 'DB', 'JACK', 'WOLF', 'STING', 'HUSKY'])
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

/** CFBD/247 position string → the broad roster position we store. */
/**
 * Full-word position vocabulary → code. Some official athletics sites (e.g.
 * Miami's Presto SPA) emit "QUARTERBACK"/"OFFENSIVELINE" instead of QB/OL;
 * mapping them to codes keeps positions comparable across sources (so they
 * don't false-flag as conflicts) and keeps the displayed value clean.
 */
const WORD_POSITION_TO_CODE: Record<string, string> = {
  QUARTERBACK: 'QB', RUNNINGBACK: 'RB', FULLBACK: 'RB', WIDERECEIVER: 'WR', TIGHTEND: 'TE',
  OFFENSIVELINE: 'OL', OFFENSIVELINEMAN: 'OL', OFFENSIVETACKLE: 'OT', OFFENSIVEGUARD: 'OG',
  CENTER: 'C', DEFENSIVELINE: 'DL', DEFENSIVEEND: 'DE', DEFENSIVETACKLE: 'DT', NOSETACKLE: 'DT',
  LINEBACKER: 'LB', DEFENSIVEBACK: 'DB', CORNERBACK: 'CB', SAFETY: 'S', PLACEKICKER: 'PK',
  KICKER: 'PK', PUNTER: 'P', LONGSNAPPER: 'LS', ATHLETE: 'ATH', SPECIALIST: 'ATH',
}

export const normalizePosition = (value = ''): string => {
  const pos0 = String(value).trim().toUpperCase()
  const pos = WORD_POSITION_TO_CODE[pos0.replace(/[^A-Z]/g, '')] ?? pos0
  if (pos === 'SAF') return 'S'
  if (pos === 'OLB' || pos === 'ILB') return 'LB'
  if (pos === 'EDGE') return 'DE'
  if (pos === 'IDL') return 'DT'
  const canonical = canonicalizePositionGroup(pos)
  if (canonical === 'T') return 'OT'
  if (canonical === 'G') return 'OG'
  if (canonical === 'SLB' || canonical === 'MLB' || canonical === 'WLB') return 'LB'
  if (canonical === 'CB' || canonical === 'NB') return 'CB'
  if (canonical === 'FS' || canonical === 'SS') return 'S'
  return canonical
}

export type Side = 'OFF' | 'DEF' | 'ST'
export const classifySide = (position: string): Side => {
  if (OFFENSE_POSITIONS.has(position)) return 'OFF'
  if (DEFENSE_POSITIONS.has(position)) return 'DEF'
  return 'ST'
}

// ── Class year / height ───────────────────────────────────────────────────────
export const normalizeClassYear = (value: unknown): string => {
  if (value == null) return 'SO'
  const text = String(value).trim().toUpperCase()
  if (['FR', 'SO', 'JR', 'SR'].includes(text)) return text
  if (text === '1') return 'FR'
  if (text === '2') return 'SO'
  if (text === '3') return 'JR'
  if (text === '4') return 'SR'
  if (text === '5' || text === '6') return 'RS SR'
  if (text === 'RS FR') return 'RS FR'
  if (text === 'RS SO') return 'RS SO'
  if (text === 'RS JR') return 'RS JR'
  if (text === 'RS SR') return 'RS SR'
  return text
}

/**
 * Redshirt-aware class-year parse. Splits a raw value into the canonical year
 * (FR/SO/JR/SR or null) and a separate isRedshirt flag, so the 'RS *' signal
 * survives canonicalization instead of being flattened away.
 */
export const parseClassYear = (value: unknown): { classYear: string | null; isRedshirt: boolean } => {
  if (value == null || value === '') return { classYear: null, isRedshirt: false }
  const raw = normalizeClassYear(value)
  const isRedshirt = raw.startsWith('RS ')
  const base = isRedshirt ? raw.slice(3).trim() : raw
  const classYear = ['FR', 'SO', 'JR', 'SR'].includes(base) ? base : null
  return { classYear, isRedshirt }
}

const CLASS_NUM: Record<string, number> = { FR: 1, SO: 2, JR: 3, SR: 4 }

/**
 * Infer redshirt status from roster TENURE, since CFBD's roster `year` (1–4)
 * carries no redshirt flag. A non-transfer whose years-on-team (season − first
 * recruiting year) meet or exceed their eligibility class has burned a year:
 * e.g. a 2025 SR (class 4) first recruited in 2021 → 2025−2021 = 4 ≥ 4 → RS.
 * Transfers are excluded (their prior-school years make tenure unreliable);
 * players with no recruiting year can't be derived → false.
 */
export const inferRedshirt = (
  classYear: string | null,
  earliestRecruitYear: number | null,
  season: number,
  isTransfer: boolean,
): boolean => {
  if (isTransfer || !classYear || earliestRecruitYear == null) return false
  const classNum = CLASS_NUM[classYear]
  if (!classNum) return false
  const yearsOnTeam = season - earliestRecruitYear
  return yearsOnTeam >= classNum
}

/**
 * Derive eligibility-remaining (years left including the current season) from a
 * CFBD numeric class `year` (1=FR..4=SR, 5/6=super-senior). Returns null when
 * undeterminable. FR=4, SO=3, JR=2, SR=1, super-senior=1.
 */
export const eligibilityFromYear = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const n = Number(value)
  if (Number.isFinite(n)) {
    if (n === 1) return 4
    if (n === 2) return 3
    if (n === 3) return 2
    if (n === 4) return 1
    if (n >= 5) return 1
    return null
  }
  const text = String(value).trim().toUpperCase().replace(/^RS\s+/, '')
  if (text === 'FR') return 4
  if (text === 'SO') return 3
  if (text === 'JR') return 2
  if (text === 'SR') return 1
  return null
}

export const toHeight = (value: unknown): string => {
  if (!value) return '6\'0"'
  const text = String(value)
  if (/^\d+(\.\d+)?$/.test(text)) {
    const inches = Number(text)
    const feet = Math.floor(inches / 12)
    const rem = Math.round((inches % 12) * 10) / 10
    const cleanRem = Number.isInteger(rem) ? String(rem) : String(rem).replace(/\.0$/, '')
    return `${feet}'${cleanRem}"`
  }
  const dash = text.match(/^(\d+)-(\d+(?:\.\d+)?)$/)
  if (dash) return `${dash[1]}'${dash[2]}"`
  const feetInches = text.match(/^(\d)'(\d{1,2})"?$/)
  if (feetInches) return `${feetInches[1]}'${feetInches[2]}"`
  return text
}

// ── HTML text helpers ─────────────────────────────────────────────────────────
export const decodeHtml = (text = ''): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

export const stripTags = (text = ''): string =>
  decodeHtml(String(text).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

// ── Name standardization + fuzzy resolver ─────────────────────────────────────
export const stdName = (value = ''): string =>
  String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,'’`\-]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((posTag) => !NAME_SUFFIXES.has(posTag))
    .join(' ')
    .trim()

const OURLADS_POS_TO_BROAD: Record<string, string> = {
  'WR-X': 'WR', 'WR-Z': 'WR', 'WR-Y': 'WR', 'WR-SL': 'WR', 'WR-H': 'WR', SLOT: 'WR',
  QB: 'QB', RB: 'RB', HB: 'RB', TB: 'RB', FB: 'RB',
  TE: 'TE', 'H-BACK': 'TE',
  LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL', OL: 'OL', T: 'OL', G: 'OL',
  LDE: 'DE', RDE: 'DE', JACK: 'DE',
  NT: 'DT', DT: 'DT',
  WLB: 'LB', MLB: 'LB', NB: 'LB', LB: 'LB', WOLF: 'LB',
  STING: 'DB',
  LCB: 'CB', RCB: 'CB', CB: 'CB',
  SS: 'S', FS: 'S', S: 'S', HUSKY: 'DB', DB: 'DB',
}
export const normalizeOurladsPosition = (posTag: string): string => OURLADS_POS_TO_BROAD[posTag] ?? posTag

const POS_GROUP_MAP: Record<string, string[]> = {
  QB: ['QB'],
  RB: ['RB', 'FB'],
  WR: ['WR'],
  TE: ['TE'],
  OL: ['OL', 'LT', 'LG', 'C', 'RG', 'RT', 'OT', 'OG'],
  DE: ['DE', 'DL', 'LB'],
  DT: ['DT', 'DL', 'NT'],
  LB: ['LB', 'DL'],
  CB: ['CB', 'DB'],
  S: ['S', 'DB'],
  NB: ['NB', 'CB', 'DB'],
  DB: ['DB', 'CB', 'S'],
}

const positionGroupMatches = (cfbdPos: string | null | undefined, broadPos: string | null | undefined): boolean => {
  if (!cfbdPos || !broadPos) return true
  const group = POS_GROUP_MAP[broadPos]
  if (!group) return true
  return group.includes(cfbdPos)
}

const parseOurladsEligibility = (displayStr = ''): number | null => {
  const s = String(displayStr).toUpperCase().trim()
  if (!s || s.includes('TR')) return null
  const isRS = s.includes('RS')
  const year = s.replace('RS', '').trim()
  const base = year === 'FR' ? 4 : year === 'SO' ? 3 : year === 'JR' ? 2 : year === 'SR' ? 1 : null
  if (base == null) return null
  return isRS ? base + 1 : base
}

const levenshtein = (a: string, b: string): number => {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i += 1) dp[i]![0] = i
  for (let j = 0; j <= n; j += 1) dp[0]![j] = j
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }
  return dp[m]![n]!
}

const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

export interface RosterNameEntry {
  playerId: string
  stdName: string
  lastToken: string
  position: string
  eligibilityRemaining: number | null
}

export interface RosterPlayerLike {
  playerId: string
  name?: string
  position: string
  eligibilityRemaining?: number | null
}

export interface RosterNameIndex {
  rosterByStdName: Map<string, RosterNameEntry[]>
  rosterNamePairs: RosterNameEntry[]
}

export const buildRosterNameIndex = (players: RosterPlayerLike[]): RosterNameIndex => {
  const rosterByStdName = new Map<string, RosterNameEntry[]>()
  const rosterNamePairs: RosterNameEntry[] = []
  for (const player of players) {
    const sn = stdName(player.name ?? '')
    if (!sn) continue
    const entry: RosterNameEntry = {
      playerId: player.playerId,
      stdName: sn,
      lastToken: sn.split(' ').at(-1) ?? sn,
      position: player.position,
      eligibilityRemaining: player.eligibilityRemaining ?? null,
    }
    rosterNamePairs.push(entry)
    const existing = rosterByStdName.get(sn) ?? []
    existing.push(entry)
    rosterByStdName.set(sn, existing)
  }
  return { rosterByStdName, rosterNamePairs }
}

const seniorityOk = (player: RosterNameEntry, ourladsEligibility: string | null): boolean => {
  if (!ourladsEligibility) return true
  const ourladsElig = parseOurladsEligibility(ourladsEligibility)
  if (ourladsElig == null || player.eligibilityRemaining == null) return true
  return Math.abs(ourladsElig - player.eligibilityRemaining) <= 1
}

export interface ResolveResult {
  playerId: string
  method: string
  similarity?: number
}

export const resolveByStdName = ({
  ourladsName,
  ourladsPosition = null,
  ourladsEligibility = null,
  rosterByStdName,
  rosterNamePairs,
  threshold = 0.82,
}: {
  ourladsName: string
  ourladsPosition?: string | null
  ourladsEligibility?: string | null
  rosterByStdName: Map<string, RosterNameEntry[]>
  rosterNamePairs: RosterNameEntry[]
  threshold?: number
}): ResolveResult | null => {
  if (!ourladsName) return null
  const sn = stdName(ourladsName)
  if (!sn) return null

  const broadPos = ourladsPosition ? normalizeOurladsPosition(ourladsPosition) : null
  const lastToken = sn.split(' ').at(-1) ?? sn

  const exactCandidates = rosterByStdName.get(sn) ?? []
  if (broadPos) {
    const byPos = exactCandidates.filter((c) => positionGroupMatches(c.position, broadPos))
    if (byPos.length > 0) return { playerId: byPos[0]!.playerId, method: 'stdname-exact-pos' }
  }
  if (exactCandidates.length > 0) return { playerId: exactCandidates[0]!.playerId, method: 'stdname-exact' }

  if (broadPos) {
    const byLastAndPos = rosterNamePairs.filter(
      (c) => c.lastToken === lastToken && positionGroupMatches(c.position, broadPos),
    )
    if (byLastAndPos.length === 1 && seniorityOk(byLastAndPos[0]!, ourladsEligibility)) {
      return { playerId: byLastAndPos[0]!.playerId, method: 'last-pos-match' }
    }
  }

  let best: (RosterNameEntry & { sim: number }) | null = null
  for (const c of rosterNamePairs) {
    if (c.lastToken !== lastToken) continue
    const sim = similarity(sn, c.stdName)
    if (sim < threshold) continue
    if (!best || sim > best.sim) best = { ...c, sim }
  }
  if (best && seniorityOk(best, ourladsEligibility)) {
    return { playerId: best.playerId, method: 'fuzzy-stdname', similarity: Number(best.sim.toFixed(3)) }
  }

  const tokens = sn.split(' ')
  if (tokens.length >= 3) {
    const smashed = tokens[0] + ' ' + tokens.slice(1).join('')
    const smashedCandidates = rosterByStdName.get(smashed) ?? []
    if (smashedCandidates.length > 0 && seniorityOk(smashedCandidates[0]!, ourladsEligibility)) {
      return { playerId: smashedCandidates[0]!.playerId, method: 'first-smashed-exact' }
    }
    const firstLast = `${tokens[0]} ${lastToken}`
    const flCandidates = rosterByStdName.get(firstLast) ?? []
    if (flCandidates.length > 0 && seniorityOk(flCandidates[0]!, ourladsEligibility)) {
      return { playerId: flCandidates[0]!.playerId, method: 'first-last-exact' }
    }
    let bestFL: (RosterNameEntry & { sim: number }) | null = null
    for (const c of rosterNamePairs) {
      if (c.lastToken !== lastToken) continue
      const sim = similarity(firstLast, c.stdName)
      if (sim < threshold) continue
      if (!bestFL || sim > bestFL.sim) bestFL = { ...c, sim }
    }
    if (bestFL && seniorityOk(bestFL, ourladsEligibility)) {
      return { playerId: bestFL.playerId, method: 'first-last-fuzzy', similarity: Number(bestFL.sim.toFixed(3)) }
    }
  }

  return null
}
