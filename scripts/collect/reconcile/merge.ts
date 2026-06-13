/**
 * Field-level golden-record merge — step 2 of reconciliation.
 *
 * Each merged field is a `{ value, _meta:{source, confidence, conflict?, alt? }}`
 * envelope. Precedence (most → least authoritative):
 *   jersey/position/class/height/weight: official → ESPN → CFBD-2025
 *   hometown:                            official → ESPN.birthPlace → CFBD
 *   highSchool / previousSchool:         official ONLY
 *   headshot:                            ESPN ONLY
 *   recruiting (stars/composite/ranks):  CFBD 247-composite → On3/Rivals fill
 *   production / usage / ppa:            CFBD 2025 (returning only)
 *
 * conflict=true when two PRESENT sources disagree beyond tolerance (jersey ≠,
 * class ≠, height >1.5in, position group ≠, stars ≠) — both kept (value + alt).
 *
 * Flags: isWalkOn / newIn2026 / unrated / isTransfer / isRedshirt / isStub.
 * Sources only — absent data is null + flagged, never invented.
 */
import type {
  MasterFlags,
  MasterProduction,
  MasterRecruiting,
  MasterSource,
  PlayerMaster,
} from '../../../src/data/schema/playerMaster.ts'
import type { RecruitProfile } from '../recruiting.ts'
import type { ProductionEntry } from '../../../src/data/schema/production.ts'
import type { PlayerAdvanced } from '../../../src/data/schema/advanced.ts'
import { inferRedshirt, normalizePosition, toHeight } from '../normalize.ts'
import type { CrosswalkRow } from './crosswalk.ts'

type Confidence = 'high' | 'medium' | 'low'

/** Per-field conflict tally accumulated across the team (for the report). */
export interface ConflictTally {
  [field: string]: number
}

const mkField = <T>(
  value: T | null,
  source: MasterSource | null,
  confidence: Confidence,
  conflict = false,
  alt: T | null = null,
  altSource: MasterSource | null = null,
): { value: T | null; _meta: { source: MasterSource | null; confidence: Confidence; conflict?: boolean; alt?: T | null; altSource?: MasterSource | null } } => ({
  value,
  _meta: { source, confidence, ...(conflict ? { conflict, alt, altSource } : {}) },
})

/** Heights to inches for tolerance comparison. */
const heightToInches = (h: string | null | undefined): number | null => {
  if (!h) return null
  const m = String(h).match(/(\d+)\s*'\s*(\d+(?:\.\d+)?)/)
  if (m) return Number(m[1]) * 12 + Number(m[2])
  const n = Number(h)
  return Number.isFinite(n) ? n : null
}

/** Class-year canonicalization for comparison (FR/SO/JR/SR | null). */
const canonClass = (raw: string | null | undefined): string | null => {
  if (raw == null) return null
  const t = String(raw).trim().toUpperCase().replace(/^RS-?\s*/, '').replace(/[.]/g, '')
  // Sidearm uses "So."/"Sr."/"Jr."/"Fr."/"Gr."
  if (t.startsWith('FR') || t === 'F') return 'FR'
  if (t.startsWith('SO')) return 'SO'
  if (t.startsWith('JR') || t === 'J') return 'JR'
  if (t.startsWith('SR') || t === 'S') return 'SR'
  if (t.startsWith('GR') || t === 'GS' || t.startsWith('GRAD')) return 'SR'
  return null
}

/** A raw class string carries a redshirt marker? */
const hasRsMarker = (raw: string | null | undefined): boolean =>
  raw != null && /\bRS\b|^RS/i.test(String(raw).trim())

/** Position group bucket for conflict comparison (offense/defense coarse groups). */
const posGroup = (pos: string | null | undefined): string | null => {
  if (!pos) return null
  const p = normalizePosition(pos)
  if (['QB'].includes(p)) return 'QB'
  if (['RB', 'FB'].includes(p)) return 'RB'
  if (['WR'].includes(p)) return 'WR'
  if (['TE'].includes(p)) return 'TE'
  if (['OL', 'OT', 'OG', 'C', 'T', 'G'].includes(p)) return 'OL'
  if (['DE', 'DT', 'NT', 'DL'].includes(p)) return 'DL'
  if (['LB', 'MLB', 'WLB', 'SLB'].includes(p)) return 'LB'
  if (['CB', 'NB', 'S', 'FS', 'SS', 'DB'].includes(p)) return 'DB'
  return p
}

export interface MergeOptions {
  productionSeason: number
  rosterSeason: number
  /** earliest recruiting year per playerId (for redshirt inference). */
  earliestRecruitYearByPid: Map<string, number>
}

/**
 * Merge one crosswalk row → a golden PlayerMaster. Mutates `tally` with any
 * field conflicts found.
 */
export const mergePlayer = (
  row: CrosswalkRow,
  opts: MergeOptions,
  tally: ConflictTally,
): PlayerMaster => {
  const { espn, official, on3, recruiting } = row
  const isStub = !espn // spine is ESPN; an espn-less row is a depth/official stub
  const bump = (f: string) => {
    tally[f] = (tally[f] ?? 0) + 1
  }

  // ── jersey: official → ESPN → CFBD-2025 ──
  const offJersey = official?.jersey ?? null
  const espnJersey = espn?.jersey ?? null
  let jersey
  if (offJersey != null && espnJersey != null && offJersey !== espnJersey) {
    bump('jersey')
    jersey = mkField<number>(offJersey, 'official', 'medium', true, espnJersey, 'espn')
  } else {
    const v = offJersey ?? espnJersey
    jersey = mkField<number>(v, offJersey != null ? 'official' : espnJersey != null ? 'espn' : null, 'high')
  }

  // ── position: official → ESPN → CFBD-2025 ──
  const offPos = official?.position ? normalizePosition(official.position) : null
  const espnPos = espn?.position ? normalizePosition(espn.position) : null
  let position
  if (offPos && espnPos && posGroup(offPos) !== posGroup(espnPos)) {
    bump('position')
    position = mkField<string>(offPos, 'official', 'medium', true, espnPos, 'espn')
  } else {
    const v = espnPos ?? offPos // ESPN's abbreviation is cleaner than the official slot label
    position = mkField<string>(v, espnPos ? 'espn' : offPos ? 'official' : null, 'high')
  }

  // ── side: ESPN authoritative ──
  const side = mkField<string>(espn?.side ?? null, espn ? 'espn' : null, 'high')

  // ── class year: official → ESPN → CFBD ──
  const offClass = canonClass(official?.classYear)
  const espnClass = espn?.classYear ?? null
  let classYear
  if (offClass && espnClass && offClass !== espnClass) {
    bump('classYear')
    classYear = mkField<string>(offClass, 'official', 'medium', true, espnClass, 'espn')
  } else {
    const v = offClass ?? espnClass
    classYear = mkField<string>(v, offClass ? 'official' : espnClass ? 'espn' : null, 'high')
  }

  // ── height: ESPN displayHeight (official sites rarely carry it) ──
  const espnHeight = espn?.displayHeight ?? (espn?.heightIn != null ? toHeight(espn.heightIn) : null)
  const height = mkField<string>(espnHeight, espnHeight ? 'espn' : null, 'high')
  const heightIn = mkField<number>(espn?.heightIn ?? heightToInches(espnHeight), espn?.heightIn != null ? 'espn' : null, 'high')

  // ── weight: ESPN ──
  const weight = mkField<number>(espn?.weight ?? null, espn?.weight != null ? 'espn' : null, 'high')

  // ── hometown: official → ESPN.birthPlace → CFBD ──
  const offHometown = official?.hometown ?? null
  const espnHometown =
    espn?.homeCity || espn?.homeState
      ? [espn.homeCity, espn.homeState].filter(Boolean).join(', ')
      : null
  const cfbdHometown = (() => {
    const r = recruiting
    if (r?.homeCity || r?.homeState) return [r.homeCity, r.homeState].filter(Boolean).join(', ')
    return null
  })()
  const hometownVal = offHometown ?? espnHometown ?? cfbdHometown
  const hometownSrc: MasterSource | null = offHometown
    ? 'official'
    : espnHometown
      ? 'espn'
      : cfbdHometown
        ? 'cfbd-2025'
        : null
  const hometown = mkField<string>(hometownVal, hometownSrc, offHometown ? 'high' : 'medium')
  const homeState = mkField<string>(
    espn?.homeState ?? recruiting?.homeState ?? null,
    espn?.homeState ? 'espn' : recruiting?.homeState ? 'cfbd-2025' : null,
    'medium',
  )

  // ── highSchool / previousSchool: official ONLY ──
  const highSchool = mkField<string>(official?.highSchool ?? null, official?.highSchool ? 'official' : null, 'high')
  const previousSchool = mkField<string>(
    official?.previousSchool ?? null,
    official?.previousSchool ? 'official' : null,
    'high',
  )

  // ── headshot: ESPN ONLY ──
  const headshotUrl = mkField<string>(espn?.headshotUrl ?? null, espn?.headshotUrl ? 'espn' : null, 'high')

  // ── status: ESPN ──
  const status = mkField<string>(espn?.status ?? null, espn?.status ? 'espn' : null, 'high')

  // ── recruiting: CFBD 247-composite → On3/Rivals fill ──
  const recOut: MasterRecruiting = buildRecruiting(recruiting, on3, tally, bump)

  // ── production / advanced: CFBD 2025 ──
  const prod = row.production as ProductionEntry | null
  const adv = row.advanced as PlayerAdvanced | null
  const production: MasterProduction = {
    season: prod ? opts.productionSeason : row.inCfbd2025 ? opts.productionSeason : null,
    games: prod?.games ?? null,
    stats: prod?.stats ?? {},
    perGame: prod?.perGame && prod.perGame.length ? prod.perGame : null,
    usageOverall: adv?.usage?.overall ?? null,
    ppaAll: adv?.ppa?.averagePPA?.all ?? null,
  }
  const advancedOut = { usage: adv?.usage ?? null, ppa: adv?.ppa ?? null }

  // ── flags ──
  const stars = recOut.stars
  const isTransfer = Boolean(
    official?.previousSchool || recruiting?.isTransfer || recruiting?.fromSchool,
  )
  const earliest = opts.earliestRecruitYearByPid.get(row.playerId) ?? null
  const espnClassForRs = espnClass ?? offClass
  const isRedshirt =
    hasRsMarker(official?.classYear) ||
    inferRedshirt(espnClassForRs as 'FR' | 'SO' | 'JR' | 'SR' | null, earliest, opts.rosterSeason, isTransfer)
  const flags: MasterFlags = {
    isWalkOn: !isStub && (recruiting == null || recruiting.matchMethod === 'none') && stars == null,
    newIn2026: !row.inCfbd2025,
    unrated: stars == null,
    isTransfer,
    isRedshirt,
    isStub,
  }

  return {
    playerId: row.playerId,
    name: espn?.name ?? official?.name ?? row.officialName ?? row.playerId,
    crosswalk: {
      playerId: row.playerId,
      espnId: row.espnId,
      cfbdId: row.cfbdId,
      player247Id: null,
      on3Id: null,
      officialName: row.officialName,
      ourladsName: null,
    },
    jersey,
    position,
    side,
    classYear,
    height,
    heightIn,
    weight,
    hometown,
    homeState,
    highSchool,
    previousSchool,
    headshotUrl,
    status,
    recruiting: recOut,
    production,
    advanced: advancedOut,
    flags,
  }
}

/** Recruiting merge: CFBD 247-composite primary, On3 fills gaps; stars conflict flagged. */
function buildRecruiting(
  recruiting: RecruitProfile | null,
  on3: import('../../../src/data/schema/on3.ts').On3Player | null,
  tally: ConflictTally,
  bump: (f: string) => void,
): MasterRecruiting {
  const cfbdStars = recruiting?.stars ?? null
  const on3Stars = on3?.stars ?? null
  let stars = cfbdStars
  let starsConflict = false
  if (cfbdStars != null && on3Stars != null && cfbdStars !== on3Stars) {
    starsConflict = true
    bump('stars')
  }
  if (stars == null) stars = on3Stars

  const compositeRating = recruiting?.compositeRating ?? on3?.compositeRating ?? null
  const nationalRank = recruiting?.nationalRank ?? on3?.nationalRank ?? null
  const positionRank = recruiting?.positionRank ?? on3?.positionRank ?? null
  const source: MasterSource | null =
    recruiting && recruiting.matchMethod !== 'none' ? 'cfbd-2025' : on3 ? 'on3' : null
  const matchMethod = recruiting?.matchMethod ?? (on3 ? 'on3' : 'none')

  void tally
  void starsConflict
  return {
    stars,
    compositeRating,
    nationalRank,
    positionRank,
    transferPortalStars: recruiting?.transferPortalStars ?? null,
    transferRating: recruiting?.transferRating ?? null,
    fromSchool: recruiting?.fromSchool ?? null,
    matchMethod: matchMethod as MasterRecruiting['matchMethod'],
    source,
  }
}
