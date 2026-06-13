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
import { cfbdId } from '../playerId.ts'
import {
  buildRosterNameIndex,
  resolveByStdName,
  stdName,
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
}

const jerseyMatch = (a: number | null, b: number | null | undefined): boolean =>
  a != null && b != null && a === b

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
}): CrosswalkResult => {
  // ── Spine name index (for the name-only official/On3 joins) ──
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
    const row: CrosswalkRow = {
      playerId,
      espnId: espn.espnId,
      cfbdId: playerId, // same namespace
      espn,
      official: null,
      on3: null,
      recruiting: enrichment.recruitingByPlayerId.get(playerId) ?? null,
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
    if (!row || row.recruiting) continue // don't override an id-keyed record
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
      homeCity: inc.homeCity,
      homeState: inc.homeState,
      homeLat: null,
      homeLon: null,
    }
  }

  // ── Attach 247 transfer-portal records to the spine by stdName (GAP C) ──
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
      // Existing record (id-keyed or incoming) — only fill transfer-specific
      // fields the CFBD recruiting feed lacks; never clobber stars/composite.
      const rec = row.recruiting
      rec.isTransfer = true
      rec.transferPortalStars = rec.transferPortalStars ?? t.transferStars
      rec.transferRating = rec.transferRating ?? t.transferRating
      rec.fromSchool = rec.fromSchool ?? t.fromSchool
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
      }
    }
  }

  void jerseyMatch // (kept for potential conflict cross-checks in merge)
  return { rows, unmatchedOfficial, unmatchedOn3 }
}
