/**
 * On3 / Rivals recruiting fact-check client — BEST-EFFORT, non-load-bearing.
 *
 * These public endpoints are routinely 404/blocked (probed: 404/000). The
 * client ATTEMPTS a fetch and degrades to `{ players: [], degraded: true }` on
 * ANY failure — it must never fail the run. When (rarely) reachable, it fills
 * recruiting gaps the CFBD 247-composite missed.
 */
import type { On3Player } from '../../../src/data/schema/on3.ts'

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export interface On3FetchResult {
  degraded: boolean
  degradeReason: string | null
  players: On3Player[]
}

/** Candidate On3 roster/commits URL for a 247-style team slug. */
export const on3Url = (teamSlug: string): string =>
  `https://www.on3.com/college/${teamSlug}/football/roster/`

/**
 * Attempt the On3 fetch; degrade on any non-OK / network error. We intentionally
 * do NOT parse aggressively — On3 is JS-rendered and our realistic expectation is
 * a degraded result. If the page is reachable and ever exposes a JSON island, a
 * future pass can extend this; today it returns degraded-but-honest.
 */
export const fetchOn3 = async (teamSlug: string): Promise<On3FetchResult> => {
  const url = on3Url(teamSlug)
  try {
    const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' })
    if (!response.ok) {
      return { degraded: true, degradeReason: `HTTP ${response.status} from ${url}`, players: [] }
    }
    const html = await response.text()
    // On3 is client-rendered; no reliable SSR roster island today. Degrade honestly.
    return {
      degraded: true,
      degradeReason: `reached (${html.length} bytes) but no parseable roster island`,
      players: [],
    }
  } catch (error) {
    return { degraded: true, degradeReason: `fetch error: ${(error as Error).message}`, players: [] }
  }
}
