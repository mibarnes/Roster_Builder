/**
 * Team HQ (F6, #/team/:id/hq) — the team-intelligence page. Aggregates what used
 * to be scattered banners into four panels, all from data already in App state
 * plus the committed league artifacts:
 *   • Strength vs league — per position-group avg OVR vs the league mean (73;
 *     OVR is league-calibrated in F4, so >73 = above league, <73 = below).
 *   • Roster construction — class-year × position-group counts.
 *   • Portal ledger — incoming / outgoing transfers (from _identity.json).
 *   • Returning production — per-phase gauges (context.json).
 * Dependency-free SVG/CSS.
 */
import { useMemo } from 'react'
import type { UIDataset, UIPlayer } from '../../data/schema/ui.ts'
import type { PipelineMetrics } from '../../data/schema/pipeline.ts'
import { IDENTITY } from '../../data/leagueArtifacts.ts'
import { SUBSCORE_MEAN } from '../../data/rating/ratingConfig.ts'
import { COARSE_GROUPS, coarseGroup, type CoarseGroup } from '../../utils/positionGroup.ts'

const GROUPS = COARSE_GROUPS
type Group = CoarseGroup
const CLASSES = ['FR', 'SO', 'JR', 'SR'] as const
type ClassYr = (typeof CLASSES)[number]

const groupOf = (pos: string, side: UIPlayer['side']): Group => coarseGroup(pos, side)
const classOf = (year: string | null): ClassYr | null => {
  if (!year) return null
  const y = year.toUpperCase().slice(0, 2)
  return (CLASSES as readonly string[]).includes(y) ? (y as ClassYr) : null
}

export interface TeamHQProps {
  teamId: string
  uiData: UIDataset
  metrics: PipelineMetrics
  onPlayerClick: (p: UIPlayer) => void
}

export default function TeamHQ({ teamId, uiData }: TeamHQProps) {
  const players = uiData.allPlayers

  // ── Strength vs league: avg OVR of rated players per group ──
  const strength = useMemo(() => {
    const rows = GROUPS.map((g) => {
      const rated = players.filter((p) => p.isRated && groupOf(p.pos, p.side) === g)
      const avg = rated.length ? rated.reduce((a, p) => a + p.ovr, 0) / rated.length : null
      return { group: g, avg, n: rated.length }
    })
    return rows.filter((r) => r.n > 0)
  }, [players])

  // ── Roster construction: class × group counts ──
  const construction = useMemo(() => {
    const grid = new Map<Group, Record<ClassYr, number>>()
    for (const g of GROUPS) grid.set(g, { FR: 0, SO: 0, JR: 0, SR: 0 })
    for (const p of players) {
      const c = classOf(p.year)
      if (!c) continue
      grid.get(groupOf(p.pos, p.side))![c] += 1
    }
    return GROUPS.map((g) => ({ group: g, counts: grid.get(g)! })).filter((r) => CLASSES.some((c) => r.counts[c] > 0))
  }, [players])

  // ── Portal ledger from _identity.json ──
  const { incoming, outgoing } = useMemo(() => {
    const inc = IDENTITY.edges.filter((e) => e.toTeamId === teamId)
    const out = IDENTITY.edges.filter((e) => e.fromTeamId === teamId)
    return { incoming: inc, outgoing: out }
  }, [teamId])

  const rp = uiData.returningProduction

  return (
    <div className="mx-auto max-w-5xl px-1 py-4">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Strength vs league */}
        <Panel title="Strength vs league" subtitle="avg OVR per group · league mean = 73">
          <div className="space-y-1.5">
            {strength.map((r) => {
              const diff = (r.avg ?? SUBSCORE_MEAN) - SUBSCORE_MEAN
              const pct = Math.min(Math.abs(diff) / 12, 1) * 50 // ±12 OVR fills a half-bar
              const pos = diff >= 0
              return (
                <div key={r.group} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 font-semibold text-neutral-300">{r.group}</span>
                  <div className="relative h-3 flex-1 rounded bg-neutral-800">
                    <div className="absolute left-1/2 top-0 h-3 w-px bg-neutral-600" />
                    <div
                      className="absolute top-0 h-3 rounded"
                      style={{ left: pos ? '50%' : `${50 - pct}%`, width: `${pct}%`, background: pos ? '#22c55e' : '#ef4444' }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right tabular-nums text-neutral-400">
                    {r.avg?.toFixed(1)} <span className="text-neutral-600">({r.n})</span>
                  </span>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Returning production */}
        <Panel title="Returning production" subtitle="share of last season's output back in 2026">
          {rp ? (
            <div className="grid grid-cols-2 gap-3">
              <Gauge label="Overall PPA" value={rp.percentPPA} />
              <Gauge label="Snaps (usage)" value={rp.usage} />
              <Gauge label="Passing" value={rp.percentPassingPPA} />
              <Gauge label="Rushing" value={rp.percentRushingPPA} />
              <Gauge label="Receiving" value={rp.percentReceivingPPA} />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No returning-production data for this team.</p>
          )}
        </Panel>

        {/* Roster construction */}
        <Panel title="Roster construction" subtitle="scholarship class × position group">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500">
                  <th className="py-1 text-left font-medium">Grp</th>
                  {CLASSES.map((c) => <th key={c} className="py-1 text-center font-medium">{c}</th>)}
                  <th className="py-1 text-right font-medium">Σ</th>
                </tr>
              </thead>
              <tbody>
                {construction.map((r) => {
                  const total = CLASSES.reduce((a, c) => a + r.counts[c], 0)
                  return (
                    <tr key={r.group} className="border-t border-neutral-900">
                      <td className="py-1 font-semibold text-neutral-300">{r.group}</td>
                      {CLASSES.map((c) => {
                        const v = r.counts[c]
                        const shade = v === 0 ? 'text-neutral-700' : v >= 6 ? 'text-white font-bold' : 'text-neutral-300'
                        return <td key={c} className={`py-1 text-center tabular-nums ${shade}`}>{v || '·'}</td>
                      })}
                      <td className="py-1 text-right tabular-nums text-neutral-500">{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Portal ledger */}
        <Panel title="Transfer portal ledger" subtitle={`${incoming.length} in · ${outgoing.length} out · net ${incoming.length - outgoing.length >= 0 ? '+' : ''}${incoming.length - outgoing.length}`}>
          <div className="grid grid-cols-2 gap-4">
            <PortalList title="Incoming" rows={incoming.map((e) => ({ name: e.name, pos: e.position, school: e.fromName, rating: e.transferRating }))} accent="#22c55e" />
            <PortalList title="Outgoing" rows={outgoing.map((e) => ({ name: e.name, pos: e.position, school: e.toName, rating: e.transferRating }))} accent="#ef4444" />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <h2 className="text-sm font-bold tracking-wide text-neutral-200">{title}</h2>
      {subtitle && <p className="mb-3 text-[11px] text-neutral-500">{subtitle}</p>}
      {children}
    </section>
  )
}

function Gauge({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-neutral-400">{label}</span>
        <span className="text-xs font-bold tabular-nums text-white">{value == null ? '—' : `${pct}%`}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded bg-neutral-800">
        <div className="h-1.5 rounded team-accent-bg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PortalList({ title, rows, accent }: { title: string; rows: Array<{ name: string; pos: string | null; school: string; rating: number | null }>; accent: string }) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent }} />{title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-600">None</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.slice(0, 12).map((r, i) => (
            <li key={i} className="flex items-center justify-between text-xs">
              <span className="truncate"><span className="text-neutral-200">{r.name}</span> <span className="text-neutral-600">{r.pos}</span></span>
              <span className="ml-2 shrink-0 text-neutral-500">{r.school}{r.rating != null && <span className="ml-1 text-amber-400">{r.rating.toFixed(2)}</span>}</span>
            </li>
          ))}
          {rows.length > 12 && <li className="text-[10px] text-neutral-600">+{rows.length - 12} more</li>}
        </ul>
      )}
    </div>
  )
}
