/**
 * Canonical player-id module — the single source of truth for how a CFB player
 * is identified across CFBD roster, CFBD recruiting (athleteId), 247Sports, and
 * OurLads depth-chart stubs.
 *
 * ── Precedence (most → least authoritative) ──────────────────────────────────
 *   1. CFBD-<id>           CFBD athlete id (roster row id, /games/players id,
 *                          /recruiting/players athleteId, usage/ppa id). PRIMARY.
 *   2. 247-<player247Id>   247Sports player id (only when no CFBD id resolves).
 *   3. ourlads-stub-<slug> last resort — an OurLads depth name we could not
 *                          resolve to any CFBD/247 player.
 *
 * Every external record (recruiting, advanced, production) is keyed back to a
 * roster player by trying these in order. The name resolver in normalize.ts is
 * the fuzzy fallback when no id matches.
 */
import { stdName } from './normalize.ts'

export type IdKind = 'cfbd' | '247' | 'ourlads-stub'

/** CFBD athlete id → canonical id. */
export const cfbdId = (id: unknown): string => `CFBD-${String(id).trim()}`

/** 247Sports player id → canonical id. */
export const id247 = (player247Id: unknown): string => `247-${String(player247Id).trim()}`

/** Deterministic slug from a name (for unresolved OurLads stubs). */
export const stubSlug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** OurLads depth name → canonical stub id. */
export const ourladsStubId = (name: string): string => `ourlads-stub-${stubSlug(name)}`

/** Classify a canonical id by its prefix. */
export const idKind = (playerId: string): IdKind | 'unknown' => {
  if (playerId.startsWith('CFBD-')) return 'cfbd'
  if (playerId.startsWith('247-')) return '247'
  if (playerId.startsWith('ourlads-stub-')) return 'ourlads-stub'
  return 'unknown'
}

export interface ReconcileInput {
  /** CFBD athlete id (roster id / recruiting athleteId / usage id), if known. */
  cfbdAthleteId?: string | number | null
  /** 247Sports player id, if known. */
  player247Id?: string | null
  /** Display name, used to (a) drive the fuzzy resolver and (b) build a stub. */
  name?: string | null
  /**
   * Optional resolver: given a name, return an existing roster playerId via the
   * fuzzy name index (or null). Lets reconcile() prefer an EXISTING roster id
   * over minting a fresh 247-/stub- id when only a name is available.
   */
  resolveByName?: (name: string) => string | null
}

export interface ReconcileResult {
  playerId: string
  /** Which rule produced the id — mirrors MatchMethod where applicable. */
  source: 'cfbd-id' | '247-id' | 'name-fuzzy' | 'stub'
}

/**
 * Reconcile a record to a canonical playerId following the documented
 * precedence. Returns the id AND how it was derived so callers can record
 * matchMethod honestly.
 */
export const reconcile = (input: ReconcileInput): ReconcileResult => {
  const { cfbdAthleteId, player247Id, name, resolveByName } = input

  if (cfbdAthleteId != null && String(cfbdAthleteId).trim() !== '') {
    return { playerId: cfbdId(cfbdAthleteId), source: 'cfbd-id' }
  }

  if (name && resolveByName) {
    const resolved = resolveByName(name)
    if (resolved) return { playerId: resolved, source: 'name-fuzzy' }
  }

  if (player247Id != null && String(player247Id).trim() !== '') {
    return { playerId: id247(player247Id), source: '247-id' }
  }

  return { playerId: ourladsStubId(name ?? 'unknown'), source: 'stub' }
}

/** Convenience: is this name resolvable to an existing CFBD roster id? */
export const matchesRosterName = (
  name: string,
  resolveByName: (name: string) => string | null,
): boolean => {
  if (!stdName(name)) return false
  return resolveByName(name) != null
}
