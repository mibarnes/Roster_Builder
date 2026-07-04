/**
 * Watchlist header control (F7/7.4) — a "★ N" button opening a dropdown of saved
 * players; each row deep-links to that player, with a remove control. Reads the
 * shared localStorage-backed store.
 */
import { useState } from 'react'
import { useWatchlist, watchlist, type WatchEntry } from '../../hooks/useWatchlist.ts'
import { getOvrColor, NR_COLOR } from '../../utils/playerHelpers.ts'

export interface WatchlistButtonProps {
  onSelect: (teamId: string, playerId: string) => void
}

export default function WatchlistButton({ onSelect }: WatchlistButtonProps) {
  const [open, setOpen] = useState(false)
  const map = useWatchlist()
  const rows: WatchEntry[] = Object.values(map).sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0))

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Your watchlist"
        className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${rows.length ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
      >
        ★ {rows.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 shadow-2xl">
            <div className="border-b border-neutral-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Watchlist · {rows.length}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-neutral-600">Star a player (in their card) to save them here.</p>
              ) : (
                rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-900">
                    <button
                      onClick={() => {
                        setOpen(false)
                        onSelect(r.teamId, r.id)
                      }}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <span className="w-7 shrink-0 text-center text-xs font-bold tabular-nums" style={{ color: r.ovr != null ? getOvrColor(r.ovr) : NR_COLOR }}>
                        {r.ovr ?? 'NR'}
                      </span>
                      <span className="flex-1 truncate text-sm text-neutral-100">{r.name}</span>
                      <span className="shrink-0 text-[10px] text-neutral-500">{r.pos} · {r.teamLabel.split(' ').slice(-1)[0]}</span>
                    </button>
                    <button
                      onClick={() => watchlist.remove(r.id)}
                      aria-label={`Remove ${r.name}`}
                      className="shrink-0 text-neutral-600 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
