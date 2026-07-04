/**
 * League view (F6, #/league) — the cross-team payoff of the 54-team golden set.
 * Renders from the small committed `_league.json` + `_identity.json` artifacts
 * (never the 54 masters). Conference-filterable, sortable board of every team on
 * league-calibrated metrics, plus a transfer-portal flow panel. Dependency-free
 * SVG/CSS, consistent with the rest of the app.
 */
import { useMemo, useState } from 'react'
import { LEAGUE, inLeagueEdges, type LeagueTeam } from '../../data/leagueArtifacts.ts'

type SortKey = 'avgStarterOverall' | 'offenseStarterOverall' | 'defenseStarterOverall' | 'returningPercentPPA' | 'portalNet'
const COLUMNS: Array<{ key: SortKey; label: string; fmt: (t: LeagueTeam) => string }> = [
  { key: 'avgStarterOverall', label: 'OVR', fmt: (t) => t.avgStarterOverall?.toFixed(1) ?? '—' },
  { key: 'offenseStarterOverall', label: 'OFF', fmt: (t) => t.offenseStarterOverall?.toFixed(1) ?? '—' },
  { key: 'defenseStarterOverall', label: 'DEF', fmt: (t) => t.defenseStarterOverall?.toFixed(1) ?? '—' },
  { key: 'returningPercentPPA', label: 'RET%', fmt: (t) => (t.returningPercentPPA != null ? `${Math.round(t.returningPercentPPA * 100)}%` : '—') },
  { key: 'portalNet', label: 'PORTAL', fmt: (t) => (t.portalNet > 0 ? `+${t.portalNet}` : String(t.portalNet)) },
]

const CONFERENCES = ['All', 'SEC', 'Big Ten', 'ACC', 'Big 12', 'IND'] as const

export interface LeagueViewProps {
  onBack: () => void
  onTeamClick: (teamId: string) => void
}

export default function LeagueView({ onBack, onTeamClick }: LeagueViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('avgStarterOverall')
  const [conf, setConf] = useState<(typeof CONFERENCES)[number]>('All')

  const teams = useMemo(() => {
    const filtered = conf === 'All' ? LEAGUE.teams : LEAGUE.teams.filter((t) => t.conference === conf)
    const val = (t: LeagueTeam) => (t[sortKey] ?? -Infinity) as number
    return [...filtered].sort((a, b) => val(b) - val(a))
  }, [sortKey, conf])

  // League-relative OVR bar scale (avg starters cluster ~70–77).
  const ovrs = LEAGUE.teams.map((t) => t.avgStarterOverall ?? 0)
  const minOvr = Math.min(...ovrs)
  const maxOvr = Math.max(...ovrs)
  const barPct = (v: number | null) => (v == null ? 0 : ((v - minOvr) / (maxOvr - minOvr || 1)) * 100)

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-4 py-3">
        <button onClick={onBack} className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">← Back</button>
        <h1 className="text-lg font-bold tracking-wide">LEAGUE</h1>
        <span className="text-xs text-neutral-500">{LEAGUE.teamsIncluded} teams · league-calibrated</span>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4">
        {/* Conference filter */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CONFERENCES.map((c) => (
            <button
              key={c}
              onClick={() => setConf(c)}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${conf === c ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Board */}
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Team</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right font-medium">
                    <button
                      onClick={() => setSortKey(c.key)}
                      className={`hover:text-white ${sortKey === c.key ? 'text-white' : ''}`}
                    >
                      {c.label}{sortKey === c.key ? ' ▾' : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr
                  key={t.teamId}
                  onClick={() => onTeamClick(t.teamId)}
                  className="cursor-pointer border-b border-neutral-900 hover:bg-neutral-900"
                >
                  <td className="px-3 py-2 text-neutral-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: t.accentColor }} />
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-[10px] text-neutral-600">{t.conference}</span>
                    </div>
                    <div className="mt-1 h-1 w-full max-w-[180px] rounded bg-neutral-800">
                      <div className="h-1 rounded" style={{ width: `${barPct(t.avgStarterOverall)}%`, background: t.accentColor }} />
                    </div>
                  </td>
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 text-right tabular-nums ${c.key === 'portalNet' ? (t.portalNet > 0 ? 'text-emerald-400' : t.portalNet < 0 ? 'text-rose-400' : 'text-neutral-400') : ''} ${sortKey === c.key ? 'font-bold text-white' : 'text-neutral-300'}`}
                    >
                      {c.fmt(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PortalFlowPanel onTeamClick={onTeamClick} />
      </div>
    </div>
  )
}

/** Transfer-portal flow — net movement ranking + notable in-league moves. */
function PortalFlowPanel({ onTeamClick }: { onTeamClick: (teamId: string) => void }) {
  const edges = inLeagueEdges()
  const topNet = [...LEAGUE.teams].sort((a, b) => b.portalNet - a.portalNet)
  const gainers = topNet.slice(0, 6)
  const losers = topNet.slice(-6).reverse()
  const notable = [...edges]
    .filter((e) => e.transferRating != null)
    .sort((a, b) => (b.transferRating ?? 0) - (a.transferRating ?? 0))
    .slice(0, 12)

  const NetList = ({ title, rows }: { title: string; rows: LeagueTeam[] }) => (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      <ul className="space-y-1">
        {rows.map((t) => (
          <li key={t.teamId}>
            <button onClick={() => onTeamClick(t.teamId)} className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-neutral-900">
              <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: t.accentColor }} />{t.label}</span>
              <span className={`tabular-nums font-semibold ${t.portalNet > 0 ? 'text-emerald-400' : t.portalNet < 0 ? 'text-rose-400' : 'text-neutral-400'}`}>
                {t.portalNet > 0 ? `+${t.portalNet}` : t.portalNet} <span className="text-[10px] text-neutral-600">({t.portalIn}in/{t.portalOut}out)</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-bold tracking-wide text-neutral-300">TRANSFER PORTAL FLOW <span className="text-xs font-normal text-neutral-600">· {edges.length} in-league moves</span></h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <NetList title="Net gainers" rows={gainers} />
        <NetList title="Net losers" rows={losers} />
      </div>
      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Top in-league transfers</h3>
        <div className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-800">
          {notable.map((e, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="truncate"><span className="font-semibold">{e.name}</span> <span className="text-xs text-neutral-500">{e.position}</span></span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-400">
                <button className="hover:text-white" onClick={() => e.fromTeamId && onTeamClick(e.fromTeamId)}>{e.fromName}</button>
                <span className="text-neutral-600">→</span>
                <button className="font-medium hover:text-white" onClick={() => onTeamClick(e.toTeamId)}>{e.toName}</button>
                {e.transferRating != null && <span className="tabular-nums text-amber-400">{e.transferRating.toFixed(2)}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
