import { describe, expect, it } from 'vitest'
import {
  buildPosGroupRows,
  computeDepthGrade,
  computeGroupWins,
  computeTeamOvr,
  divBadge,
  overallDepthGrade,
} from './comparisonMath.ts'
import type { Formation, UIDataset, UIPlayer } from '../../data/schema/ui.ts'
import { EMPTY_COVERAGE } from '../../data/schema/pipeline.ts'

// Minimal UIPlayer factory — only the fields the math reads matter.
let seq = 0
const mk = (over: Partial<UIPlayer>): UIPlayer => ({
  id: ++seq,
  name: 'X Y',
  number: 1,
  pos: 'QB',
  year: 'JR',
  side: 'OFF',
  stars: 0,
  transferStars: undefined,
  isTransfer: false,
  fromSchool: null,
  composite: 0,
  compositeRating: null,
  transferRating: null,
  nationalRank: null,
  positionRank: null,
  ht: null,
  wt: null,
  ovr: 0,
  isRated: false,
  ratingMethod: 'nr',
  ratingBreakdown: { recruiting: null, production: null, class: 71, weights: { recruiting: 0.45, production: 0.45, class: 0.1 } },
  eligibilityRemaining: null,
  stats: {},
  games: null,
  usageOverall: null,
  ppaAll: null,
  hometown: null,
  recruitMatchMethod: null,
  isStub: false,
  dataCompleteness: { hasRecruiting: false, hasProduction: false, matchedBy: null },
  ...over,
})

const emptyOff: Formation = { QB: [], RB: [], WRX: [], WRZ: [], SLOT: [], TE: [], LT: [], LG: [], C: [], RG: [], RT: [] }
const emptyDef: Formation = { LDE: [], RDE: [], NT: [], DT: [], WLB: [], MLB: [], NB: [], LCB: [], RCB: [], SS: [], FS: [] }
const dataset = (off: Record<string, UIPlayer[]>, def: Record<string, UIPlayer[]> = {}): UIDataset => ({
  offensiveStarters: { ...emptyOff, ...off } as Formation,
  defensiveStarters: { ...emptyDef, ...def } as Formation,
  allPlayers: [],
  coverage: EMPTY_COVERAGE,
})

describe('computeDepthGrade', () => {
  it('returns THIN when no starters', () => {
    expect(computeDepthGrade(emptyOff, ['QB'])).toBe('THIN')
  })

  it('returns THIN when there is a starter but no backup', () => {
    const form: Formation = { ...emptyOff, QB: [mk({ ovr: 90 })] }
    expect(computeDepthGrade(form, ['QB'])).toBe('THIN')
  })

  it('returns DEEP when starter/backup gap is small (<=5)', () => {
    const form: Formation = { ...emptyOff, QB: [mk({ ovr: 90 }), mk({ ovr: 87 })] }
    expect(computeDepthGrade(form, ['QB'])).toBe('DEEP')
  })

  it('returns SOLID for a moderate gap (5-12)', () => {
    const form: Formation = { ...emptyOff, QB: [mk({ ovr: 90 }), mk({ ovr: 82 })] }
    expect(computeDepthGrade(form, ['QB'])).toBe('SOLID')
  })

  it('returns THIN for a large gap (>12)', () => {
    const form: Formation = { ...emptyOff, QB: [mk({ ovr: 95 }), mk({ ovr: 70 })] }
    expect(computeDepthGrade(form, ['QB'])).toBe('THIN')
  })
})

describe('divBadge', () => {
  it('flags overrated recruits ("Not Living Up")', () => {
    expect(divBadge(95, 75)?.label).toBe('Not Living Up to Hype')
  })
  it('flags underrated players ("Hidden Gem")', () => {
    expect(divBadge(60, 85)?.label).toBe('Hidden Gem')
  })
  it('returns null when composite is 0 (derived-only, no real recruiting signal)', () => {
    expect(divBadge(0, 70)).toBeNull()
  })
  it('returns null when within tolerance', () => {
    expect(divBadge(80, 78)).toBeNull()
  })
})

describe('buildPosGroupRows', () => {
  it('computes per-group OVR, edge and starter lists for two teams', () => {
    const left = dataset({ QB: [mk({ ovr: 90, composite: 90, name: 'Ace Left' })] })
    const right = dataset({ QB: [mk({ ovr: 80, composite: 80, name: 'Bob Right' })] })
    const rows = buildPosGroupRows(left, right)
    const qb = rows.find((r) => r.group.groupId === 'QB')!
    expect(qb.lStarterOvr).toBe(90)
    expect(qb.rStarterOvr).toBe(80)
    expect(qb.edge).toBe('left')
    expect(qb.lTopName).toBe('Left')
  })

  it('marks an empty group as even with null ovrs (no fabrication)', () => {
    const rows = buildPosGroupRows(dataset({}), dataset({}))
    const qb = rows.find((r) => r.group.groupId === 'QB')!
    expect(qb.lOvr).toBeNull()
    expect(qb.rOvr).toBeNull()
    expect(qb.edge).toBe('even')
  })

  it('ignores players with ovr 0 (unrated) when averaging', () => {
    const left = dataset({ WRX: [mk({ ovr: 0 })], WRZ: [mk({ ovr: 88 })] })
    const rows = buildPosGroupRows(left, dataset({}))
    const wr = rows.find((r) => r.group.groupId === 'WR')!
    expect(wr.lStarterOvr).toBe(88) // the 0-ovr player is excluded
  })

  it('flags a divergence badge + div player only on real composite data', () => {
    const left = dataset({ QB: [mk({ ovr: 70, composite: 92, name: 'Hyped One' })] })
    const rows = buildPosGroupRows(left, dataset({}))
    const qb = rows.find((r) => r.group.groupId === 'QB')!
    expect(qb.lBadge?.label).toBe('Not Living Up to Hype')
    expect(qb.lDivPlayer?.name).toBe('Hyped One')
  })
})

describe('computeGroupWins / computeTeamOvr / overallDepthGrade', () => {
  it('tallies group wins across both sides', () => {
    const left = dataset({ QB: [mk({ ovr: 90, composite: 90 })] }, { LCB: [mk({ ovr: 70, composite: 70, side: 'DEF', pos: 'CB' })] })
    const right = dataset({ QB: [mk({ ovr: 80, composite: 80 })] }, { LCB: [mk({ ovr: 85, composite: 85, side: 'DEF', pos: 'CB' })] })
    const wins = computeGroupWins(buildPosGroupRows(left, right))
    expect(wins.total).toBe(9)
    expect(wins.l).toBeGreaterThanOrEqual(1)
    expect(wins.r).toBeGreaterThanOrEqual(1)
  })

  it('computeTeamOvr averages rated starters, null when none', () => {
    expect(computeTeamOvr(dataset({}))).toBeNull()
    expect(computeTeamOvr(dataset({ QB: [mk({ ovr: 80 })], RB: [mk({ ovr: 90 })] }))).toBe(85)
  })

  it('overallDepthGrade returns the weaker side grade', () => {
    expect(overallDepthGrade(null)).toBe('THIN')
    expect(overallDepthGrade(dataset({}))).toBe('THIN')
  })
})
