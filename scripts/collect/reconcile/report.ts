/**
 * Reconciliation report — step 3 of reconciliation.
 *
 * Coverage + conflict telemetry for the merged golden records. The hard
 * invariant (asserted by the orchestrator) is `masterCount === spineCount`:
 * every spine player → exactly one master record (walk-ons / new-2026 / unrated
 * are FLAGGED, never dropped).
 */
import type { PlayerMaster, ReconciliationReport } from '../../../src/data/schema/playerMaster.ts'
import type { ConflictTally } from './merge.ts'

const pct = (n: number, d: number): number => (d > 0 ? Number(((100 * n) / d).toFixed(1)) : 0)

export const buildReport = ({
  spineCount,
  masters,
  conflictTally,
  fuzzyCount,
  officialDegraded,
  on3Degraded,
}: {
  spineCount: number
  masters: PlayerMaster[]
  conflictTally: ConflictTally
  /** count of name-only (non-id) joins used for any source. */
  fuzzyCount: number
  officialDegraded: boolean
  on3Degraded: boolean
}): ReconciliationReport => {
  const n = masters.length
  // Spine players (non-stub) that joined a CFBD-2025 record by DIRECT id
  // (CFBD-<espnId> === CFBD athleteId) — i.e. returning players. Measured over
  // the spine, not the (stub-inflated) master count.
  const spinePlayers = masters.filter((m) => !m.flags.isStub)
  const matchedById = spinePlayers.filter((m) => !m.flags.newIn2026).length
  return {
    spineCount,
    masterCount: n,
    matchedByIdPct: pct(matchedById, spinePlayers.length),
    fuzzyCount,
    walkOns: masters.filter((m) => m.flags.isWalkOn).length,
    newIn2026: masters.filter((m) => m.flags.newIn2026).length,
    unrated: masters.filter((m) => m.flags.unrated).length,
    isTransfer: masters.filter((m) => m.flags.isTransfer).length,
    headshotPct: pct(masters.filter((m) => m.headshotUrl.value).length, n),
    highSchoolPct: pct(masters.filter((m) => m.highSchool.value).length, n),
    previousSchoolPct: pct(masters.filter((m) => m.previousSchool.value).length, n),
    hometownPct: pct(masters.filter((m) => m.hometown.value).length, n),
    productionReturningPct: pct(masters.filter((m) => (m.production.games ?? 0) > 0).length, n),
    perFieldConflictCounts: { ...conflictTally },
    officialDegraded,
    on3Degraded,
  }
}
