import { describe, expect, it } from 'vitest'
import { buildHash, defaultRoute, parseHash, routeTeamId, type Route } from './router.ts'

describe('router — parseHash', () => {
  it('parses a team route with a valid tab', () => {
    expect(parseHash('#/team/florida-gators/ratings')).toEqual({
      kind: 'team',
      teamId: 'florida-gators',
      tab: 'ratings',
    })
  })

  it('defaults an invalid/missing tab to offense', () => {
    expect(parseHash('#/team/miami-hurricanes')).toEqual({
      kind: 'team',
      teamId: 'miami-hurricanes',
      tab: 'offense',
    })
    const bogus = parseHash('#/team/miami-hurricanes/bogus')
    expect(bogus).toEqual({ kind: 'team', teamId: 'miami-hurricanes', tab: 'offense' })
  })

  it('parses compare + player routes', () => {
    expect(parseHash('#/compare/florida-gators/miami-hurricanes')).toEqual({
      kind: 'compare',
      leftId: 'florida-gators',
      rightId: 'miami-hurricanes',
    })
    expect(parseHash('#/player/florida-gators/CFBD-5079555')).toEqual({
      kind: 'player',
      teamId: 'florida-gators',
      playerId: 'CFBD-5079555',
    })
  })

  it('falls back to the default route on empty/garbage/partial hashes', () => {
    expect(parseHash('')).toEqual(defaultRoute())
    expect(parseHash('#/')).toEqual(defaultRoute())
    expect(parseHash('#/nonsense/x')).toEqual(defaultRoute())
    expect(parseHash('#/compare/onlyone')).toEqual(defaultRoute())
  })
})

describe('router — buildHash is the inverse of parseHash', () => {
  const routes: Route[] = [
    { kind: 'team', teamId: 'florida-gators', tab: 'offense' },
    { kind: 'team', teamId: 'georgia-bulldogs', tab: 'defense' },
    { kind: 'compare', leftId: 'florida-gators', rightId: 'miami-hurricanes' },
    { kind: 'player', teamId: 'florida-gators', playerId: 'ourlads-stub-dj-lagway' },
  ]
  it.each(routes)('round-trips %o', (route) => {
    expect(parseHash(buildHash(route))).toEqual(route)
  })
})

describe('router — routeTeamId', () => {
  it('returns the in-context team (left team for compare)', () => {
    expect(routeTeamId({ kind: 'team', teamId: 'a', tab: 'offense' })).toBe('a')
    expect(routeTeamId({ kind: 'player', teamId: 'b', playerId: 'p' })).toBe('b')
    expect(routeTeamId({ kind: 'compare', leftId: 'c', rightId: 'd' })).toBe('c')
  })
})
