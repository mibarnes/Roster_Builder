/**
 * Crosswalk builder — step 1 of reconciliation.
 *
 * Spine = ESPN athletes (∪ any official-only players the spine missed). Canonical
 * `playerId = CFBD-<espnId>` because ESPN and CFBD share the athlete-id namespace
 * — so attaching CFBD-2025 recruiting / production / advanced is a DIRECT id join
 * (no fuzzy). Official-site and On3 rows are name-only, so they join by stdName
 * (reusing resolveByStdName) to the spine.
 *
 * Output: one CrosswalkRow per spine player carrying every resolved source
 * record, plus the unmatched leftovers (for the report).
 */
import type { EspnPlayer } from '../../../src/data/schema/espnRoster.ts'
import type { OfficialPlayer } from '../../../src/data/schema/officialRoster.ts'
import type { On3Player } from '../../../src/data/schema/on3.ts'
import type { IncomingRecruit, RecruitProfile, TransferOverlayRecord } from '../recruiting.ts'
import type { NationalRecruitingIndex, NatlRecruit } from '../sources/cfbdRecruitingIndex.ts'
import type { PortalIncoming } from '../sources/cfbdPortal.ts'
import { cfbdId } from '../playerId.ts'
import {
  buildRosterNameIndex,
  resolveByStdName,
  stdName,
  type RosterNameIndex,
  type RosterPlayerLike,
} from '../normalize.ts'

/** A CFBD-2025 enrichment bundle keyed by canonical id (CFBD-<id>). */
export interface CfbdEnrichment {
  recruitingByPlayerId: Map<string, RecruitProfile>
  productionByPlayerId: Map<string, unknown>
  advancedByPlayerId: Map<string, unknown>
  /** True when a 2025 CFBD roster record exists for this id (returning player). */
  cfbdRosterIds: Set<string>
}

export interface CrosswalkRow {
  playerId: string
  espnId: string | null
  cfbdId: string | null
  espn: EspnPlayer | null
  official: OfficialPlayer | null
  on3: On3Player | null
  recruiting: RecruitProfile | null
  production: unknown | null
  advanced: unknown | null
  /** True when CFBD 2025 knows this player (returning) — drives newIn2026. */
  inCfbd2025: boolean
  /** Audit: the official name we matched (if any). */
  officialName: string | null
}

export interface CrosswalkResult {
  rows: CrosswalkRow[]
  /** Official players we could not match to the spine (name join miss). */
  unmatchedOfficial: OfficialPlayer[]
  /** On3 players we could not match to the spine. */
  unmatchedOn3: On3Player[]
  /** Full-spine name index (for downstream OurLads stub reduction). */
  spineIndex: RosterNameIndex
  /** Per-source recruiting-resolution tallies (for the status report). */
  recruitSourceCounts: Record<string, number>
}

const jerseyMatch = (a: number | null, b: number | null | undefined): boolean =>
  a != null && b != null && a === b

/**
 * Does a recruiting record carry an actual rating? A record can EXIST (e.g. an
 * empty cfbd-team profile for a preferred walk-on) yet be unrated. The C2
 * fallback steps must fire for such records — so they check ratedness, not mere
 * presence. Rated === any of: stars, composite, or a transfer rating.
 */
const isRated = (rec: RecruitProfile | null | undefined): boolean =>
  rec != null && (rec.stars != null || rec.compositeRating != null || rec.transferRating != null)

/**
 * Build the crosswalk. Spine players come from ESPN; each gets the direct CFBD
 * 2025 enrichment by id, plus a best-effort official/On3 overlay matched by
 * stdName (and jersey as a tie-break / confirmation).
 */
export const buildCrosswalk = ({
  espnPlayers,
  officialPlayers,
  on3Players,
  enrichment,
  incomingRecruits = [],
  transferOverlay = [],
  nationalIndex = null,
  portalIncoming = [],
}: {
  espnPlayers: EspnPlayer[]
  officialPlayers: OfficialPlayer[]
  on3Players: On3Player[]
  enrichment: CfbdEnrichment
  /**
   * CFBD incoming-class recruits (athleteId null) — the 2026/2027 HS signees.
   * Name-matched to the ESPN spine for new-2026 players that have no id-keyed
   * recruiting record (so they get rated instead of showing UNRATED).
   */
  incomingRecruits?: IncomingRecruit[]
  /**
   * 247 transfer-portal records (by name) for the team's incoming transfers.
   * Name-matched to the spine; supplies transfer stars/rating where CFBD's own
   * recruiting feed missed them (transfers recruited by OTHER schools — GAP C).
   */
  transferOverlay?: TransferOverlayRecord[]
  /**
   * C2: the national recruiting index (CFBD `/recruiting/players?year=X`, no
   * team). Resolves recruiting for EVERY spine player cross-school — by
   * athleteId (returning) or by stdName (transfers' HS rating, walk-ons
   * recruited elsewhere, 2026 freshmen). null when unavailable.
   */
  nationalIndex?: NationalRecruitingIndex | null
  /**
   * C2: the team's incoming CFBD transfer-portal entries (`/player/portal`,
   * destination === team). Name-matched to the spine — supplies a transfer
   * rating/stars + ORIGIN school + ELIGIBILITY. CFBD-native (no scraping).
   */
  portalIncoming?: PortalIncoming[]
}): CrosswalkResult => {
  // ── Spine name index — FULL spine = ESPN ∪ official-only (C2 fix) ──
  // BUG (pre-C2): the index was built ONLY from espnPlayers, so name-matched
  // recruiting/portal overlays missed any official-only spine member. We index
  // the full spine (ESPN players + official players that do not name-resolve to
  // an ESPN row) so every spine member can receive name-matched recruiting.
  const spineLike: RosterPlayerLike[] = espnPlayers.map((p) => ({
    playerId: cfbdId(p.espnId),
    name: p.name,
    position: p.position,
    eligibilityRemaining: null,
  }))
  const spineIndex = buildRosterNameIndex(spineLike)
  const spineByJersey = new Map<number, EspnPlayer[]>()
  for (const p of espnPlayers) {
    if (p.jersey == null) continue
    const arr = spineByJersey.get(p.jersey) ?? []
    arr.push(p)
    spineByJersey.set(p.jersey, arr)
  }

  const rowByPlayerId = new Map<string, CrosswalkRow>()
  const rows: CrosswalkRow[] = espnPlayers.map((espn) => {
    const playerId = cfbdId(espn.espnId)
    // Precedence step 1: the team's OWN CFBD recruiting (id-keyed) → 'cfbd-team'.
    // Only tag it 'cfbd-team' when it actually carries a RATING — the team feed
    // can list a starless preferred-walk-on with matchMethod 'none'; such an
    // empty record must NOT block the national/portal fallback (it stays
    // source=null so isRated() below treats it as still-needing a rating).
    const teamRec = enrichment.recruitingByPlayerId.get(playerId) ?? null
    if (teamRec && teamRec.source == null && isRated(teamRec)) teamRec.source = 'cfbd-team'
    const row: CrosswalkRow = {
      playerId,
      espnId: espn.espnId,
      cfbdId: playerId, // same namespace
      espn,
      official: null,
      on3: null,
      recruiting: teamRec,
      production: enrichment.productionByPlayerId.get(playerId) ?? null,
      advanced: enrichment.advancedByPlayerId.get(playerId) ?? null,
      inCfbd2025:
        enrichment.cfbdRosterIds.has(playerId) ||
        enrichment.productionByPlayerId.has(playerId) ||
        enrichment.recruitingByPlayerId.has(playerId),
      officialName: null,
    }
    rowByPlayerId.set(playerId, row)
    return row
  })

  // ── Attach official overlay by stdName (+ jersey confirmation) ──
  const unmatchedOfficial: OfficialPlayer[] = []
  for (const off of officialPlayers) {
    if (!stdName(off.name)) {
      unmatchedOfficial.push(off)
      continue
    }
    const resolved = resolveByStdName({
      ourladsName: off.name,
      ourladsPosition: off.position ?? null,
      rosterByStdName: spineIndex.rosterByStdName,
      rosterNamePairs: spineIndex.rosterNamePairs,
    })
    let targetId = resolved?.playerId ?? null
    // jersey fallback: a unique spine player with this jersey + last-name token
    if (!targetId && off.jersey != null) {
      const candidates = spineByJersey.get(off.jersey) ?? []
      const last = stdName(off.name).split(' ').at(-1)
      const byLast = candidates.filter((c) => stdName(c.name).split(' ').at(-1) === last)
      if (byLast.length === 1) targetId = cfbdId(byLast[0]!.espnId)
    }
    const row = targetId ? rowByPlayerId.get(targetId) : undefined
    if (row && !row.official) {
      row.official = off
      row.officialName = off.name
    } else {
      unmatchedOfficial.push(off)
    }
  }

  // ── Attach On3 overlay by stdName ──
  const unmatchedOn3: On3Player[] = []
  for (const p of on3Players) {
    if (!stdName(p.name)) {
      unmatchedOn3.push(p)
      continue
    }
    const resolved = resolveByStdName({
      ourladsName: p.name,
      ourladsPosition: p.position ?? null,
      rosterByStdName: spineIndex.rosterByStdName,
      rosterNamePairs: spineIndex.rosterNamePairs,
    })
    const row = resolved ? rowByPlayerId.get(resolved.playerId) : undefined
    if (row && !row.on3) row.on3 = p
    else unmatchedOn3.push(p)
  }

  // ── Attach incoming-class recruiting (2026/2027 HS signees) by stdName ──
  // These CFBD recruits have athleteId:null, so they cannot id-join. We match
  // them to spine rows that still LACK recruiting (returning players already got
  // their id-keyed record above). Position used as a tie-break via the resolver.
  for (const inc of incomingRecruits) {
    const resolved = resolveByStdName({
      ourladsName: inc.name,
      ourladsPosition: inc.position,
      rosterByStdName: spineIndex.rosterByStdName,
      rosterNamePairs: spineIndex.rosterNamePairs,
    })
    if (!resolved) continue
    const row = rowByPlayerId.get(resolved.playerId)
    if (!row || isRated(row.recruiting)) continue // don't override a RATED record
    row.recruiting = {
      playerId: row.playerId,
      name: row.espn?.name ?? inc.name,
      stars: inc.stars,
      compositeRating: inc.compositeRating,
      nationalRank: inc.nationalRank,
      positionRank: null,
      transferPortalStars: null,
      transferRating: null,
      fromSchool: null,
      isTransfer: false,
      years: [inc.year],
      matchMethod: 'name-fuzzy',
      matches: [{ year: inc.year, method: 'cfbd-incoming-name', player247Id: null, cfbdRecruitId: null }],
      homeCity: inc.homeCity ?? row.recruiting?.homeCity ?? null,
      homeState: inc.homeState ?? row.recruiting?.homeState ?? null,
      homeLat: null,
      homeLon: null,
      source: 'cfbd-natl-name',
      recruitedSchool: null,
      recruitYear: inc.year,
      origin: null,
      eligibility: null,
    }
  }

  // ── C2 step 2+3: NATIONAL recruiting index — by athleteId, then by stdName ──
  // The national index (`/recruiting/players?year=X`, no team) is cross-school,
  // so it rates spine players the team's OWN feed never recruited: returning
  // players the team feed missed (by athleteId), and transfers' HS ratings /
  // walk-ons recruited elsewhere / 2026 freshmen (by stdName + committedTo).
  if (nationalIndex) {
    // step 2 — by athleteId (CFBD-<athleteId> === playerId for returning players)
    for (const row of rows) {
      if (isRated(row.recruiting)) continue // a RATED team/incoming record already won
      const natl = nationalIndex.byAthleteId.get(row.playerId)
      if (!natl || (natl.stars == null && natl.compositeRating == null)) continue
      row.recruiting = natlToProfile(row, natl, 'cfbd-natl-id')
    }
    // step 3 — by stdName(+position), cross-school
    for (const row of rows) {
      if (isRated(row.recruiting)) continue
      if (!row.espn) continue
      const sn = stdName(row.espn.name)
      const bucket = nationalIndex.byStdName.get(sn)
      if (!bucket || bucket.length === 0) continue
      // Only RATED national candidates are useful (skip starless/compless rows).
      const rated = bucket.filter((c) => c.stars != null || c.compositeRating != null)
      if (rated.length === 0) continue
      // Prefer a candidate whose position group matches the spine player (guards
      // against a same-name different-person collision); else take the best-rated.
      const espnBroad = row.espn.position
      const byPos = rated.find((c) => c.position && positionsRoughlyMatch(c.position, espnBroad))
      const natl = byPos ?? rated[0]!
      // Carry over any hometown the prior (empty) record had.
      const prior = row.recruiting
      const profile = natlToProfile(row, natl, 'cfbd-natl-name')
      profile.homeCity = profile.homeCity ?? prior?.homeCity ?? null
      profile.homeState = profile.homeState ?? prior?.homeState ?? null
      row.recruiting = profile
    }
  }

  // ── C2 step 4: CFBD transfer PORTAL by name (origin + eligibility + rating) ──
  // Name-matched to the spine. Fills transfer rating/stars + ORIGIN + eligibility
  // the team's own recruiting feed lacks (transfers recruited by OTHER schools).
  for (const t of portalIncoming) {
    const resolved = resolveByStdName({
      ourladsName: t.name,
      ourladsPosition: t.position,
      rosterByStdName: spineIndex.rosterByStdName,
      rosterNamePairs: spineIndex.rosterNamePairs,
    })
    if (!resolved) continue
    const row = rowByPlayerId.get(resolved.playerId)
    if (!row) continue
    if (row.recruiting) {
      // Existing HS/national record — ADD transfer-specific fields, never clobber
      // an existing HS rating. If the prior record was UNRATED, the portal both
      // rates it AND becomes its source tag.
      const rec = row.recruiting
      const wasRated = isRated(rec)
      rec.isTransfer = true
      rec.transferPortalStars = rec.transferPortalStars ?? t.stars
      rec.transferRating = rec.transferRating ?? t.rating
      rec.fromSchool = rec.fromSchool ?? t.origin
      rec.origin = rec.origin ?? t.origin
      rec.eligibility = rec.eligibility ?? t.eligibility
      if (rec.stars == null && t.stars != null) rec.stars = t.stars
      if (!wasRated && (t.stars != null || t.rating != null)) {
        rec.source = 'cfbd-portal'
        rec.recruitYear = rec.recruitYear ?? (t.season || null)
      }
    } else {
      row.recruiting = {
        playerId: row.playerId,
        name: row.espn?.name ?? t.name,
        stars: t.stars,
        compositeRating: null,
        nationalRank: null,
        positionRank: null,
        transferPortalStars: t.stars,
        transferRating: t.rating,
        fromSchool: t.origin,
        isTransfer: true,
        years: [],
        matchMethod: 'name-fuzzy',
        matches: [{ method: 'cfbd-portal-name', player247Id: null, cfbdRecruitId: null }],
        homeCity: null,
        homeState: null,
        homeLat: null,
        homeLon: null,
        source: 'cfbd-portal',
        recruitedSchool: null,
        recruitYear: t.season || null,
        origin: t.origin,
        eligibility: t.eligibility,
      }
    }
  }

  // ── C2 step 5: 247 transfer-portal records to the spine by stdName (GAP C) ──
  // The team commits page lists the transfers the team brought IN. We name-match
  // them to the spine and supply transfer stars/rating + the isTransfer flag.
  // CFBD /recruiting/players?team=X only returns X's OWN recruits, so transfers
  // recruited elsewhere are missed by the id-join — this rescues them.
  for (const t of transferOverlay) {
    const resolved = resolveByStdName({
      ourladsName: t.name,
      ourladsPosition: t.position,
      rosterByStdName: spineIndex.rosterByStdName,
      rosterNamePairs: spineIndex.rosterNamePairs,
    })
    if (!resolved) continue
    const row = rowByPlayerId.get(resolved.playerId)
    if (!row) continue
    if (row.recruiting) {
      // Existing record (team/national/portal/incoming) — only fill transfer-
      // specific fields the prior source lacked; never clobber stars/composite.
      const rec = row.recruiting
      rec.isTransfer = true
      rec.transferPortalStars = rec.transferPortalStars ?? t.transferStars
      rec.transferRating = rec.transferRating ?? t.transferRating
      rec.fromSchool = rec.fromSchool ?? t.fromSchool
      rec.origin = rec.origin ?? t.fromSchool
      // If the player had no HS stars, surface the transfer-portal stars so the
      // record is no longer UNRATED (still honestly a transfer rating).
      if (rec.stars == null && t.transferStars != null) rec.stars = t.transferStars
    } else {
      row.recruiting = {
        playerId: row.playerId,
        name: row.espn?.name ?? t.name,
        stars: t.transferStars,
        compositeRating: null,
        nationalRank: null,
        positionRank: null,
        transferPortalStars: t.transferStars,
        transferRating: t.transferRating,
        fromSchool: t.fromSchool,
        isTransfer: true,
        years: [],
        matchMethod: 'name-fuzzy',
        matches: [{ method: '247-transfer-name', player247Id: null, cfbdRecruitId: null }],
        homeCity: null,
        homeState: null,
        homeLat: null,
        homeLon: null,
        source: '247-portal',
        recruitedSchool: null,
        recruitYear: null,
        origin: t.fromSchool,
        eligibility: null,
      }
    }
  }

  // ── C2 step 6: tally the resolved recruiting source per row (for reporting) ──
  const recruitSourceCounts: Record<string, number> = {}
  for (const row of rows) {
    const src = row.recruiting?.source ?? 'none'
    recruitSourceCounts[src] = (recruitSourceCounts[src] ?? 0) + 1
  }

  void jerseyMatch // (kept for potential conflict cross-checks in merge)
  return { rows, unmatchedOfficial, unmatchedOn3, spineIndex, recruitSourceCounts }
}

/** Position-group rough match for the national-name join (broad codes). */
const positionsRoughlyMatch = (
  natlPos: string | null | undefined,
  espnPos: string | null | undefined,
): boolean => {
  if (!natlPos || !espnPos) return true
  const norm = (p: string): string => p.toUpperCase().replace(/[^A-Z]/g, '')
  const a = norm(natlPos)
  const b = norm(espnPos)
  if (a === b) return true
  // coarse offense/defense buckets so e.g. ATH/WR or DL/DE don't false-miss
  const bucket = (p: string): string => {
    if (['QB'].includes(p)) return 'QB'
    if (['RB', 'FB', 'HB', 'TB', 'APB'].includes(p)) return 'RB'
    if (['WR', 'SLOT'].includes(p)) return 'WR'
    if (['TE'].includes(p)) return 'TE'
    if (['OL', 'OT', 'OG', 'C', 'IOL', 'OC', 'T', 'G'].includes(p)) return 'OL'
    if (['DL', 'DE', 'DT', 'NT', 'EDGE', 'IDL'].includes(p)) return 'DL'
    if (['LB', 'ILB', 'OLB', 'MLB', 'WLB', 'SLB'].includes(p)) return 'LB'
    if (['CB', 'DB', 'S', 'FS', 'SS', 'NB'].includes(p)) return 'DB'
    return p
  }
  return bucket(a) === bucket(b)
}

/** Build a RecruitProfile from a national-index record for a spine row. */
const natlToProfile = (
  row: CrosswalkRow,
  natl: NatlRecruit,
  source: 'cfbd-natl-id' | 'cfbd-natl-name',
): RecruitProfile => ({
  playerId: row.playerId,
  name: row.espn?.name ?? natl.name,
  stars: natl.stars,
  compositeRating: natl.compositeRating,
  nationalRank: natl.nationalRank,
  positionRank: null,
  transferPortalStars: null,
  transferRating: null,
  fromSchool: null,
  isTransfer: false,
  years: [natl.recruitYear],
  matchMethod: source === 'cfbd-natl-id' ? 'cfbd-id' : 'name-fuzzy',
  matches: [
    {
      year: natl.recruitYear,
      method: source,
      player247Id: null,
      cfbdRecruitId: natl.athleteId,
    },
  ],
  homeCity: natl.homeCity,
  homeState: natl.homeState,
  homeLat: null,
  homeLon: null,
  source,
  recruitedSchool: natl.committedTo,
  recruitYear: natl.recruitYear,
  origin: null,
  eligibility: null,
})
