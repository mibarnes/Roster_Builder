/**
 * router.ts — a tiny dependency-free hash router (U1). Hash routing needs no
 * server rewrites, so it works on GitHub Pages / Netlify as-is. Three routes:
 *
 *   #/team/:teamId/:tab            offense | defense | ratings
 *   #/compare/:leftId/:rightId     two-team comparison
 *   #/player/:teamId/:playerId     a player modal, deep-linked + shareable
 *
 * The route is the source of truth for which VIEW is shown; depth-toggle +
 * ratings filters stay local UI state (persisted via localStorage, U4).
 */
import { useEffect, useState } from 'react'
import { DEFAULT_TEAM_ID } from './data/teamRegistry.ts'

export type RouteTab = 'offense' | 'defense' | 'ratings'

export type Route =
  | { kind: 'team'; teamId: string; tab: RouteTab }
  | { kind: 'compare'; leftId: string; rightId: string }
  | { kind: 'player'; teamId: string; playerId: string }

const TABS: readonly RouteTab[] = ['offense', 'defense', 'ratings']
const isTab = (s: string | undefined): s is RouteTab => s != null && (TABS as readonly string[]).includes(s)

export const defaultRoute = (): Route => ({ kind: 'team', teamId: DEFAULT_TEAM_ID, tab: 'offense' })

/** Parse a location hash into a Route, falling back to the default on anything unknown. */
export function parseHash(hash: string): Route {
  const parts = hash
    .replace(/^#/, '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p)
      } catch {
        return p
      }
    })

  if (parts[0] === 'team' && parts[1]) {
    return { kind: 'team', teamId: parts[1], tab: isTab(parts[2]) ? parts[2] : 'offense' }
  }
  if (parts[0] === 'compare' && parts[1] && parts[2]) {
    return { kind: 'compare', leftId: parts[1], rightId: parts[2] }
  }
  if (parts[0] === 'player' && parts[1] && parts[2]) {
    return { kind: 'player', teamId: parts[1], playerId: parts[2] }
  }
  return defaultRoute()
}

/** Serialize a Route to a location hash (inverse of parseHash). */
export function buildHash(route: Route): string {
  const enc = encodeURIComponent
  switch (route.kind) {
    case 'team':
      return `#/team/${enc(route.teamId)}/${route.tab}`
    case 'compare':
      return `#/compare/${enc(route.leftId)}/${enc(route.rightId)}`
    case 'player':
      return `#/player/${enc(route.teamId)}/${enc(route.playerId)}`
  }
}

/** The current team in context for data loading (compare uses the left team). */
export const routeTeamId = (route: Route): string =>
  route.kind === 'compare' ? route.leftId : route.teamId

/** Subscribe to the hash route + get a navigate() that updates it. */
export function useHashRoute(): { route: Route; navigate: (route: Route) => void } {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? defaultRoute() : parseHash(window.location.hash),
  )

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', sync)
    // Canonicalize an empty/garbage initial hash so the URL always reflects state.
    if (!window.location.hash) {
      window.history.replaceState(null, '', buildHash(defaultRoute()))
    }
    sync()
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const navigate = (next: Route) => {
    const hash = buildHash(next)
    if (typeof window === 'undefined') {
      setRoute(next)
      return
    }
    if (window.location.hash === hash) {
      setRoute(next) // same URL (e.g. closing a modal back to the same view) — force sync
    } else {
      window.location.hash = hash // triggers hashchange → sync()
    }
  }

  return { route, navigate }
}
