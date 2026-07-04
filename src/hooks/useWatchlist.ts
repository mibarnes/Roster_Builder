/**
 * Watchlist (F7/7.4) — a localStorage-backed set of saved players, keyed by the
 * stable `playerId` (CFBD-<athleteId>, unique across teams). A tiny external
 * store shared via useSyncExternalStore so the modal's toggle and the header's
 * count stay in sync everywhere.
 */
import { useSyncExternalStore } from 'react'

export interface WatchEntry {
  id: string
  name: string
  teamId: string
  teamLabel: string
  pos: string
  ovr: number | null
}

const KEY = 'rb.watchlist.v1'

const read = (): Record<string, WatchEntry> => {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return raw && typeof raw === 'object' ? (raw as Record<string, WatchEntry>) : {}
  } catch {
    return {}
  }
}

let cache: Record<string, WatchEntry> = read()
const listeners = new Set<() => void>()
const emit = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* storage unavailable (private mode) — in-memory only */
  }
  listeners.forEach((l) => l())
}

export const watchlist = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  snapshot: () => cache,
  has: (id: string) => id in cache,
  list: (): WatchEntry[] => Object.values(cache),
  toggle(e: WatchEntry) {
    const next = { ...cache }
    if (e.id in next) delete next[e.id]
    else next[e.id] = e
    cache = next
    emit()
  },
  remove(id: string) {
    if (!(id in cache)) return
    const next = { ...cache }
    delete next[id]
    cache = next
    emit()
  },
}

/** Subscribe a component to the watchlist store (re-renders on change). */
export function useWatchlist(): Record<string, WatchEntry> {
  return useSyncExternalStore(watchlist.subscribe, watchlist.snapshot, watchlist.snapshot)
}
