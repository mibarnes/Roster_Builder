/**
 * Master-record orchestration glue — assembles the golden player-master from the
 * ESPN spine + CFBD-2025 enrichment + best-effort official/On3 overlays + OurLads
 * depth chart. Pure (no network): the orchestrator (collect.ts) fetches, this
 * stitches. Returns the validated-ready master source object.
 */
import type { EspnPlayer } from '../../../src/data/schema/espnRoster.ts'
import type { OfficialPlayer } from '../../../src/data/schema/officialRoster.ts'
import type { On3Player } from '../../../src/data/schema/on3.ts'
import type { PlayerMaster, PlayerMasterSource } from '../../../src/data/schema/playerMaster.ts'
import type { IncomingRecruit, RecruitProfile, TransferOverlayRecord } from '../recruiting.ts'
import type { NationalRecruitingIndex } from '../sources/cfbdRecruitingIndex.ts'
import type { PortalIncoming } from '../sources/cfbdPortal.ts'
import type { ProductionEntry } from '../../../src/data/schema/production.ts'
import type { PlayerAdvanced } from '../../../src/data/schema/advanced.ts'
import type { Provenance } from '../../../src/data/schema/common.ts'
import { buildCrosswalk, type CfbdEnrichment } from './crosswalk.ts'
import { mergePlayer, type ConflictTally, type MergeOptions } from './merge.ts'
import { buildReport } from './report.ts'
import { cfbdId } from '../playerId.ts'
import { buildDepthChartFromOurlads, type ExtraResolver } from '../parsers/ourlads.ts'
import { buildRosterNameIndex, resolveByStdName, stdName } from '../normalize.ts'

export interface BuildMasterInput {
  teamLabel: string
  rosterSeason: number
  productionSeason: number
  espnPlayers: EspnPlayer[]
  officialPlayers: OfficialPlayer[]
  officialDegraded: boolean
  on3Players: On3Player[]
  on3Degraded: boolean
  recruitingProfiles: RecruitProfile[]
  /** CFBD incoming-class recruits (athleteId null) — name-matched to the spine. */
  incomingRecruits?: IncomingRecruit[]
  /** 247 transfer-portal records (by name) — name-matched to the spine (GAP C). */
  transferOverlay?: TransferOverlayRecord[]
  /** C2: national recruiting index (cross-school) — name/id-matched to the spine. */
  nationalIndex?: NationalRecruitingIndex | null
  /** C2: CFBD incoming transfer-portal entries (origin/eligibility/rating). */
  portalIncoming?: PortalIncoming[]
  productionEntries: ProductionEntry[]
  advancedEntries: PlayerAdvanced[]
  /** CFBD 2025 roster ids (returning players) — drives newIn2026. */
  cfbdRosterIds: Set<string>
  ourladsHtml: string
  /** Team returning-production (CFBD /player/returning, productionSeason); null when absent. */
  returningProduction: Record<string, number | null> | null
  provenance: Provenance & { rosterSeason: number; productionSeason: number }
}

export interface BuildMasterResult {
  master: PlayerMasterSource
  /** Players in the master = spine size (hard invariant for the orchestrator). */
  spineCount: number
  /** Per-source recruiting-resolution counts (C2 — for the status report). */
  recruitSourceCounts: Record<string, number>
  /** OurLads stub count before/after national-index/full-spine reduction (C2). */
  stubReduction: { before: number; after: number }
}

export const buildMaster = (input: BuildMasterInput): BuildMasterResult => {
  // ── 1) CFBD enrichment maps (DIRECT id join: CFBD-<espnId>) ──
  const recruitingByPlayerId = new Map<string, RecruitProfile>(
    input.recruitingProfiles.map((r) => [r.playerId, r]),
  )
  const productionByPlayerId = new Map<string, unknown>(
    input.productionEntries.map((p) => [p.playerId, p]),
  )
  const advancedByPlayerId = new Map<string, unknown>(
    input.advancedEntries.map((a) => [a.playerId, a]),
  )
  const enrichment: CfbdEnrichment = {
    recruitingByPlayerId,
    productionByPlayerId,
    advancedByPlayerId,
    cfbdRosterIds: input.cfbdRosterIds,
  }

  // ── 2) Crosswalk (spine + overlays + incoming-class + national/portal match) ──
  const crosswalk = buildCrosswalk({
    espnPlayers: input.espnPlayers,
    officialPlayers: input.officialPlayers,
    on3Players: input.on3Players,
    enrichment,
    incomingRecruits: input.incomingRecruits ?? [],
    transferOverlay: input.transferOverlay ?? [],
    nationalIndex: input.nationalIndex ?? null,
    portalIncoming: input.portalIncoming ?? [],
  })

  // ── 3) earliest recruit year per player (for redshirt inference) ──
  const earliestRecruitYearByPid = new Map<string, number>()
  for (const r of input.recruitingProfiles) {
    if (r.years && r.years.length > 0) earliestRecruitYearByPid.set(r.playerId, Math.min(...r.years))
  }

  const opts: MergeOptions = {
    productionSeason: input.productionSeason,
    rosterSeason: input.rosterSeason,
    earliestRecruitYearByPid,
  }

  // ── 4) merge → golden records ──
  const tally: ConflictTally = {}
  const masters: PlayerMaster[] = crosswalk.rows.map((row) => mergePlayer(row, opts, tally))

  // ── 5) depth chart from OurLads resolved against the ESPN spine ──
  const spineLike = input.espnPlayers.map((p) => ({
    playerId: cfbdId(p.espnId),
    name: p.name,
    position: p.position,
    eligibilityRemaining: null,
  }))
  // extra resolver: a depth name matching a CFBD recruit/2025 record resolves to
  // that id IF it is a spine player (avoid dangling depth references).
  const spineIdSet = new Set(spineLike.map((p) => p.playerId))
  const recruitNamePool = input.recruitingProfiles
    .filter((r) => r.name)
    .map((r) => ({ playerId: r.playerId, name: r.name, position: '', eligibilityRemaining: null }))
  const recruitIndex = buildRosterNameIndex(recruitNamePool)
  const extraResolve: ExtraResolver = (name) => {
    if (!stdName(name)) return null
    const pid =
      resolveByStdName({
        ourladsName: name,
        ourladsPosition: null,
        rosterByStdName: recruitIndex.rosterByStdName,
        rosterNamePairs: recruitIndex.rosterNamePairs,
      })?.playerId ?? null
    return pid && spineIdSet.has(pid) ? pid : null
  }
  // STUB BEFORE: depth chart without any national/spine stub-reduction.
  const stubBaseline = buildDepthChartFromOurlads(input.ourladsHtml, spineLike, extraResolve)
  const stubBefore = stubBaseline.stubs.length

  // ── 5a) STUB REDUCTION (C2): before minting an ourlads-stub-*, try matching the
  // OurLads depth name against (a) the FULL spine name index and (b) the national
  // recruiting index by name → resolve to a REAL CFBD-<athleteId>. A resolved
  // depth-only player becomes a real-id master record (with national recruiting)
  // instead of a synthetic stub. Only ids the national index actually knows are
  // accepted (otherwise the stub stands), so we never invent a player. ──
  const natl = input.nationalIndex ?? null
  const reducedExtra: ExtraResolver = (name, position) => {
    const spineHit = extraResolve(name, position) // existing spine/recruit resolution first
    if (spineHit) return spineHit
    if (!natl) return null
    const sn = stdName(name)
    if (!sn) return null
    const bucket = natl.byStdName.get(sn)
    const withId = bucket?.find((c) => c.athleteId)
    return withId?.athleteId ? cfbdId(withId.athleteId) : null
  }
  const depth = buildDepthChartFromOurlads(input.ourladsHtml, spineLike, reducedExtra)
  const stubAfter = depth.stubs.length

  // ── 5b) absorb OurLads stubs that the spine missed (depth-only players) ──
  // These become first-class master records so the depth chart resolves AND the
  // coverage guarantee (no dropped depth name) holds. Flagged isStub.
  const masterIds = new Set(masters.map((m) => m.playerId))
  const stubRows = depth.stubs.filter((s) => !masterIds.has(s.playerId))
  for (const stub of stubRows) {
    const stubMaster = mergePlayer(
      {
        playerId: stub.playerId,
        espnId: null,
        cfbdId: null,
        espn: null,
        official: null,
        on3: null,
        recruiting: null,
        production: null,
        advanced: null,
        inCfbd2025: false,
        officialName: null,
      },
      opts,
      tally,
    )
    // overwrite the empty position/side/name with the stub's own
    stubMaster.name = stub.name
    stubMaster.position = { value: stub.position, _meta: { source: 'derived', confidence: 'low' } }
    stubMaster.side = { value: stub.side, _meta: { source: 'derived', confidence: 'low' } }
    masters.push(stubMaster)
  }

  // ── 5c) reduced depth-only players that resolved to a REAL CFBD id (not a stub
  // and not already on the spine) — give them a national-index recruiting record
  // so they are rated, and a master record so the depth reference resolves. ──
  const presentIds = new Set(masters.map((m) => m.playerId))
  if (natl) {
    const depthPlayerIds = new Set<string>([
      ...Object.values(depth.depthChart.offense),
      ...Object.values(depth.depthChart.defense),
    ])
    for (const pid of depthPlayerIds) {
      if (!pid || presentIds.has(pid) || !pid.startsWith('CFBD-')) continue
      const natlRec = natl.byAthleteId.get(pid)
      if (!natlRec) continue // only real, index-known players (never invented)
      presentIds.add(pid)
      const resolvedMaster = mergePlayer(
        {
          playerId: pid,
          espnId: null,
          cfbdId: pid,
          espn: null,
          official: null,
          on3: null,
          recruiting: {
            playerId: pid,
            name: natlRec.name,
            stars: natlRec.stars,
            compositeRating: natlRec.compositeRating,
            nationalRank: natlRec.nationalRank,
            positionRank: null,
            transferPortalStars: null,
            transferRating: null,
            fromSchool: null,
            isTransfer: false,
            years: [natlRec.recruitYear],
            matchMethod: 'cfbd-id',
            matches: [{ year: natlRec.recruitYear, method: 'cfbd-natl-id', player247Id: null, cfbdRecruitId: natlRec.athleteId }],
            homeCity: natlRec.homeCity,
            homeState: natlRec.homeState,
            homeLat: null,
            homeLon: null,
            source: 'cfbd-natl-id',
            recruitedSchool: natlRec.committedTo,
            recruitYear: natlRec.recruitYear,
            origin: null,
            eligibility: null,
          },
          production: null,
          advanced: null,
          inCfbd2025: false,
          officialName: null,
        },
        opts,
        tally,
      )
      resolvedMaster.name = natlRec.name
      if (natlRec.position) {
        resolvedMaster.position = { value: natlRec.position, _meta: { source: 'cfbd', confidence: 'low' } }
      }
      // No longer a synthetic depth STUB — it resolved to a REAL CFBD id with a
      // national recruiting record (the C2 stub reduction). Flag honestly.
      resolvedMaster.flags.isStub = false
      masters.push(resolvedMaster)
    }
  }

  // ── 6) report ──
  const fuzzyCount =
    crosswalk.rows.filter((r) => r.official != null).length +
    crosswalk.rows.filter((r) => r.on3 != null).length
  const report = buildReport({
    spineCount: input.espnPlayers.length,
    masters,
    conflictTally: tally,
    fuzzyCount,
    officialDegraded: input.officialDegraded,
    on3Degraded: input.on3Degraded,
  })

  const master: PlayerMasterSource = {
    sourceId: 'player-master-v1',
    sourceType: 'player-master',
    team: input.teamLabel,
    provenance: input.provenance,
    players: masters,
    depthChart: depth.depthChart,
    depthChartMeta: {
      sourceId: 'ourlads-depthchart-v1',
      parsedRows: depth.parsedRows,
      unmatchedOurladsPlayers: depth.unmatched,
      stubPlayers: depth.stubs,
    },
    returningProduction: input.returningProduction,
    reconciliation: report,
  }

  return {
    master,
    spineCount: input.espnPlayers.length,
    recruitSourceCounts: crosswalk.recruitSourceCounts,
    stubReduction: { before: stubBefore, after: stubAfter },
  }
}
