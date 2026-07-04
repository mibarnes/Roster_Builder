import { describe, expect, it } from 'vitest'
import { groupPlayersBySide, isDerivedOnly, playersInGroup, OFFENSE_GROUPS } from './positionGrouping.ts'
import type { UIPlayer } from '../../data/schema/ui.ts'

let seq = 0
const mk = (over: Partial<UIPlayer>): UIPlayer => ({
  id: ++seq,
  playerId: `CFBD-${seq}`,
  posRank: null,
  posGroupSize: 0,
  name: 'Player',
  number: 1,
  pos: 'QB',
  year: 'JR',
  side: 'OFF',
  stars: 0,
  transferStars: undefined,
  isTransfer: false,
  fromSchool: null,
  composite: 50,
  compositeRating: null,
  transferRating: null,
  nationalRank: null,
  positionRank: null,
  ht: null,
  wt: null,
  ovr: 80,
  isRated: true,
  ratingMethod: 'blended',
  ratingBreakdown: { recruiting: null, production: null, class: 71, weights: { recruiting: 0.45, production: 0.45, class: 0.1 } },
  eligibilityRemaining: null,
  stats: {},
  games: null,
  usageOverall: null,
  ppaAll: null,
  usage: null,
  ppa: null,
  perGame: null,
  hometown: null,
  recruitMatchMethod: null,
  recruitSource: null,
  recruitedSchool: null,
  recruitYear: null,
  transferOrigin: null,
  transferEligibility: null,
  isStub: false,
  headshotUrl: null,
  highSchool: null,
  previousSchool: null,
  isWalkOn: false,
  newIn2026: false,
  unrated: false,
  conflictFields: [],
  dataCompleteness: { hasRecruiting: false, hasProduction: false, matchedBy: null },
  ...over,
})

describe('playersInGroup', () => {
  it('selects only matching positions and sorts by OVR descending', () => {
    const players = [
      mk({ pos: 'QB', ovr: 78, name: 'QB Low' }),
      mk({ pos: 'QB', ovr: 91, name: 'QB High' }),
      mk({ pos: 'RB', ovr: 99, name: 'RB' }),
    ]
    const qbGroup = OFFENSE_GROUPS.find((g) => g.label === 'QB')!
    const result = playersInGroup(qbGroup, players)
    expect(result.map((p) => p.name)).toEqual(['QB High', 'QB Low'])
  })

  it('buckets all OL slot positions into the OL group', () => {
    const players = [mk({ pos: 'LT' }), mk({ pos: 'C' }), mk({ pos: 'RG' }), mk({ pos: 'WR' })]
    const olGroup = OFFENSE_GROUPS.find((g) => g.label === 'OL')!
    expect(playersInGroup(olGroup, players)).toHaveLength(3)
  })
})

describe('groupPlayersBySide', () => {
  const roster: UIPlayer[] = [
    mk({ side: 'OFF', pos: 'QB' }),
    mk({ side: 'OFF', pos: 'WR' }),
    mk({ side: 'OFF', pos: 'LT' }),
    mk({ side: 'DEF', pos: 'DE' }),
    mk({ side: 'DEF', pos: 'CB' }),
    mk({ side: 'ST', pos: 'K' }),
  ]

  it('groups offensive players into offense groups only', () => {
    const grouped = groupPlayersBySide(roster, 'ALL_OFFENSE')
    const byLabel = Object.fromEntries(grouped.map((g) => [g.group.label, g.players.length]))
    expect(byLabel.QB).toBe(1)
    expect(byLabel.WR).toBe(1)
    expect(byLabel.OL).toBe(1)
    // No defensive or ST player leaks into the offense grid.
    const total = grouped.reduce((acc, g) => acc + g.players.length, 0)
    expect(total).toBe(3)
  })

  it('groups defensive players into defense groups only', () => {
    const grouped = groupPlayersBySide(roster, 'ALL_DEFENSE')
    const byLabel = Object.fromEntries(grouped.map((g) => [g.group.label, g.players.length]))
    expect(byLabel.DL).toBe(1) // DE → DL
    expect(byLabel.CB).toBe(1)
    const total = grouped.reduce((acc, g) => acc + g.players.length, 0)
    expect(total).toBe(2)
  })
})

describe('isDerivedOnly', () => {
  it('flags players with no real recruiting composite', () => {
    expect(isDerivedOnly(mk({ composite: 0 }))).toBe(true)
    expect(isDerivedOnly(mk({ composite: 84.2 }))).toBe(false)
  })
})
