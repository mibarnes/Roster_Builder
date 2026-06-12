/**
 * Advanced (usage + ppa) and context (returning-production) source builders.
 * Both are id-keyed to the CFBD roster (CFBD-<id>); rows whose id is not on the
 * roster are dropped (we only enrich known roster players). Pure shaping — the
 * fetch happens in the orchestrator.
 */
import { cfbdId } from './playerId.ts'
import type { CfbdPpaRow, CfbdReturningRow, CfbdUsageRow } from './cfbd.ts'

const clean = (obj: Record<string, number | null> | undefined): Record<string, number | null> | undefined => {
  if (!obj) return undefined
  const out: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = v == null ? null : Number(v)
  return out
}

export interface PlayerAdvanced {
  playerId: string
  name: string | null
  position: string | null
  usage?: Record<string, number | null>
  ppa?: { averagePPA?: Record<string, number | null>; totalPPA?: Record<string, number | null> }
}

export interface AdvancedSource {
  sourceId: string
  sourceType: 'advanced'
  asOf: string
  season: number
  version: string
  team: string
  playerAdvanced: PlayerAdvanced[]
}

export const buildAdvancedSource = ({
  teamLabel,
  season,
  usageRows,
  ppaRows,
  rosterIdSet,
  rosterNameById,
}: {
  teamLabel: string
  season: number
  usageRows: CfbdUsageRow[]
  ppaRows: CfbdPpaRow[]
  rosterIdSet: Set<string>
  rosterNameById: Map<string, string>
}): AdvancedSource => {
  const byPlayer = new Map<string, PlayerAdvanced>()

  const ensure = (id: string | number | undefined, name?: string, position?: string): PlayerAdvanced | null => {
    if (id == null) return null
    const playerId = cfbdId(id)
    if (!rosterIdSet.has(playerId)) return null
    if (!byPlayer.has(playerId)) {
      byPlayer.set(playerId, {
        playerId,
        name: rosterNameById.get(playerId) ?? name ?? null,
        position: position ?? null,
      })
    }
    return byPlayer.get(playerId)!
  }

  for (const row of usageRows) {
    const target = ensure(row.id, row.name, row.position)
    if (!target) continue
    const usage = clean(row.usage)
    if (usage) target.usage = usage
  }

  for (const row of ppaRows) {
    const target = ensure(row.id, row.name, row.position)
    if (!target) continue
    const averagePPA = clean(row.averagePPA)
    const totalPPA = clean(row.totalPPA)
    if (averagePPA || totalPPA) target.ppa = { ...(averagePPA && { averagePPA }), ...(totalPPA && { totalPPA }) }
  }

  return {
    sourceId: 'cfbd-advanced-v1',
    sourceType: 'advanced',
    asOf: new Date().toISOString().slice(0, 10),
    season,
    version: 'cfbd-2026.1',
    team: teamLabel,
    playerAdvanced: [...byPlayer.values()],
  }
}

export interface ContextSource {
  sourceId: string
  sourceType: 'context'
  asOf: string
  season: number
  version: string
  team: string
  returningProduction: Record<string, number | null> | null
}

export const buildContextSource = ({
  teamLabel,
  season,
  returningRows,
}: {
  teamLabel: string
  season: number
  returningRows: CfbdReturningRow[]
}): ContextSource => {
  const row = returningRows[0]
  let returningProduction: Record<string, number | null> | null = null
  if (row) {
    returningProduction = {}
    for (const [k, v] of Object.entries(row)) {
      if (k === 'season' || k === 'team' || k === 'conference') continue
      if (typeof v === 'number') returningProduction[k] = v
    }
  }
  return {
    sourceId: 'cfbd-context-v1',
    sourceType: 'context',
    asOf: new Date().toISOString().slice(0, 10),
    season,
    version: 'cfbd-2026.1',
    team: teamLabel,
    returningProduction,
  }
}
