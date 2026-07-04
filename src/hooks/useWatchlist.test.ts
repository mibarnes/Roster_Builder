/** Watchlist store — toggle is idempotent-per-id, persists, and notifies. */
import { watchlist } from './useWatchlist.ts'

const entry = (id: string) => ({ id, name: `P${id}`, teamId: 'georgia-bulldogs', teamLabel: 'Georgia Bulldogs', pos: 'QB', ovr: 90 })

beforeEach(() => {
  for (const e of watchlist.list()) watchlist.remove(e.id)
})

it('toggles a player on and off, keyed by id', () => {
  expect(watchlist.has('CFBD-1')).toBe(false)
  watchlist.toggle(entry('CFBD-1'))
  expect(watchlist.has('CFBD-1')).toBe(true)
  expect(watchlist.list()).toHaveLength(1)
  watchlist.toggle(entry('CFBD-1'))
  expect(watchlist.has('CFBD-1')).toBe(false)
})

it('notifies subscribers on change + persists to localStorage', () => {
  let ticks = 0
  const unsub = watchlist.subscribe(() => (ticks += 1))
  watchlist.toggle(entry('CFBD-2'))
  expect(ticks).toBe(1)
  expect(JSON.parse(localStorage.getItem('rb.watchlist.v1')!)['CFBD-2']).toBeTruthy()
  unsub()
})
