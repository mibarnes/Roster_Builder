/**
 * Global player search (F7/U12) — a Cmd/K omnibox over every player in the 54
 * teams. The ~680KB `_searchIndex.json` is lazy-loaded on first open (never on
 * initial page load). Results are ranked: name-prefix matches first, then by the
 * league-calibrated OVR the index is pre-sorted on. Dependency-free.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getOvrColor, NR_COLOR } from '../../utils/playerHelpers.ts'

interface SearchRow {
  id: string
  n: string
  t: string
  tl: string
  p: string
  o: number | null
  s: number
}

export interface SearchOmniboxProps {
  onSelect: (teamId: string, playerId: string) => void
}

export default function SearchOmnibox({ onSelect }: SearchOmniboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchRow[] | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global Cmd/K (⌘K / Ctrl+K) toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Lazy-load the index the first time the box opens; focus the input.
  useEffect(() => {
    if (!open) return
    setActive(0)
    if (!index) {
      void import('../../data/collected/_searchIndex.json').then((m) => {
        setIndex((m.default as { players: SearchRow[] }).players)
      })
    }
    // Focus after paint.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, index])

  const results = useCallback((): SearchRow[] => {
    const q = query.trim().toLowerCase()
    if (!index || q.length < 2) return []
    const matched = index.filter((r) => r.n.toLowerCase().includes(q))
    // Prefix / word-start matches float up; the index is already OVR-desc within.
    matched.sort((a, b) => rank(a.n, q) - rank(b.n, q))
    return matched.slice(0, 40)
  }, [index, query])

  const rows = results()

  const pick = (r: SearchRow) => {
    setOpen(false)
    setQuery('')
    onSelect(r.t, r.id)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && rows[active]) pick(rows[active]!)
          }}
          placeholder={index ? 'Search any player across 54 teams…' : 'Loading index…'}
          className="w-full bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-neutral-500"
        />
        <div className="max-h-[50vh] overflow-y-auto border-t border-neutral-800">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-600">Type at least 2 letters. ⌘K toggles this anytime.</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-600">No players match “{query}”.</p>
          ) : (
            rows.map((r, i) => (
              <button
                key={`${r.t}:${r.id}`}
                onClick={() => pick(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === active ? 'bg-neutral-800' : 'hover:bg-neutral-900'}`}
              >
                <span
                  className="w-8 shrink-0 rounded text-center text-xs font-bold tabular-nums"
                  style={{ color: r.o != null ? getOvrColor(r.o) : NR_COLOR }}
                >
                  {r.o ?? 'NR'}
                </span>
                <span className="flex-1 truncate text-sm text-neutral-100">{r.n}</span>
                <span className="shrink-0 text-xs text-neutral-500">{r.p}</span>
                <span className="w-40 shrink-0 truncate text-right text-xs text-neutral-400">{r.tl}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** Lower rank = higher priority: exact prefix (0) < word-start (1) < substring (2). */
function rank(name: string, q: string): number {
  const n = name.toLowerCase()
  if (n.startsWith(q)) return 0
  if (n.split(/\s+/).some((w) => w.startsWith(q))) return 1
  return 2
}
