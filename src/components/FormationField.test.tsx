import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import OffenseFormation from './OffenseFormation.tsx'
import DefenseFormation from './DefenseFormation.tsx'
import { DEFENSE_SCHEMES, OFFENSE_SCHEMES } from '../data/formations.ts'
import { DEFENSE_SLOT_ORDER, OFFENSE_SLOT_ORDER } from '../data/positions.ts'
import type { Formation } from '../data/schema/ui.ts'

// No auto-cleanup is configured (setup.ts only wires jest-dom), so tear down
// between renders that both assert on document.body.
afterEach(cleanup)

// Empty formation → every slot renders its labeled placeholder, which is exactly
// the alignment label the scheme assigns (U9). Lets us assert scheme differences.
const EMPTY: Formation = {}

describe('U9 — formation scheme registry integrity', () => {
  it('every offense/defense scheme cell references a REAL slot (no phantoms)', () => {
    const offSlots = new Set(OFFENSE_SLOT_ORDER)
    for (const scheme of OFFENSE_SCHEMES) {
      for (const cell of scheme.rows.flat()) {
        if (cell) expect(offSlots.has(cell.slot), `${scheme.id}:${cell.slot}`).toBe(true)
      }
    }
    const defSlots = new Set(DEFENSE_SLOT_ORDER)
    for (const scheme of DEFENSE_SCHEMES) {
      for (const cell of scheme.rows.flat()) {
        if (cell) expect(defSlots.has(cell.slot), `${scheme.id}:${cell.slot}`).toBe(true)
      }
    }
  })

  it('uses the SAME 11 slots across a side’s schemes (alignment, not personnel)', () => {
    const usedSlots = (schemes: typeof OFFENSE_SCHEMES): Set<string>[] =>
      schemes.map((s) => new Set(s.rows.flat().filter(Boolean).map((c) => c!.slot)))
    for (const sets of [usedSlots(OFFENSE_SCHEMES), usedSlots(DEFENSE_SCHEMES)]) {
      const [first, ...rest] = sets
      for (const other of rest) {
        expect([...other].sort()).toEqual([...first!].sort())
      }
    }
  })
})

describe('U9 — schemes render distinct alignments of the same players', () => {
  it('defense: nickel labels the slot DB as NB; base walks it up as a SAM', () => {
    render(<DefenseFormation defensiveStarters={EMPTY} onPlayerClick={() => {}} schemeId="nickel" />)
    expect(screen.getByText('NB')).toBeInTheDocument()
    expect(screen.queryByText('SAM')).toBeNull()
    cleanup()
    render(<DefenseFormation defensiveStarters={EMPTY} onPlayerClick={() => {}} schemeId="base" />)
    expect(screen.getByText('SAM')).toBeInTheDocument()
    expect(screen.queryByText('NB')).toBeNull()
  })

  it('offense: pro aligns the slot receiver as an H-back; spread keeps it a WR', () => {
    render(<OffenseFormation offensiveStarters={EMPTY} onPlayerClick={() => {}} schemeId="pro" />)
    expect(screen.getByText('H')).toBeInTheDocument()
    cleanup()
    render(<OffenseFormation offensiveStarters={EMPTY} onPlayerClick={() => {}} schemeId="spread" />)
    expect(screen.queryByText('H')).toBeNull()
  })

  it('falls back to the default scheme for an unknown id', () => {
    render(<OffenseFormation offensiveStarters={EMPTY} onPlayerClick={() => {}} schemeId="bogus" />)
    // Default (spread) has no H-back wing.
    expect(screen.queryByText('H')).toBeNull()
    expect(screen.getByText('QB')).toBeInTheDocument()
  })
})
