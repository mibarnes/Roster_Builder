/**
 * F3/P6 — official-site engine framework.
 *  - `parseSidearmJsonRoster`: the snake_case Sidearm JSON data-model variant
 *    (Clemson/Auburn/Texas A&M …). Same devalue-ref array as the camelCase Nuxt
 *    variant, but `first_name`/`high_school`/`hometown`/`previous_school` keys.
 *  - `parseOfficialHtml`: engine detection routes a snake_case Nuxt island to
 *    `sidearm-json` (falling through from the camelCase attempt).
 *  - `preflightTeam(s)`: registry validation (errors vs degrade-warnings) and
 *    that the real 33-team registry passes with no errors.
 */
import { describe, it, expect } from 'vitest'
import {
  parseSidearmJsonRoster,
  parseOfficialHtml,
} from '../../scripts/collect/sources/officialSite.ts'
import {
  preflightTeam,
  preflightTeams,
} from '../../scripts/collect/preflight.ts'
import { TEAMS, getTeamById } from './teamRegistry.ts'
import type { Team } from './schema/index.ts'

// Minimal snake_case devalue array: player object at index 1 holds integer refs
// into the flat array; strings live at later indices. previous_school ref lands
// on `null` (index 9) → must resolve to null, NOT the literal "null".
const snakeArr: unknown[] = [
  null, // 0
  {
    first_name: 2,
    last_name: 3,
    full_name: 4,
    hometown: 5,
    high_school: 6,
    previous_school: 9,
    jersey_number: 7,
    player_position_id: 8, // non-string ref → position stays null (non-load-bearing)
  }, // 1
  'Michael', // 2
  'Foster', // 3
  'Michael Foster', // 4
  'Charlotte, N.C.', // 5
  'Indian Land (S.C.) HS', // 6
  '32', // 7
  { id: 469 }, // 8 (position lookup object — not a string)
  null, // 9 (no previous school)
]

// extractNuxtArray ignores islands < 1000 chars (real roster payloads are large),
// so pad the serialized array past that floor with an inert filler entry.
const wrapNuxt = (arr: unknown[]): string => {
  const padded = [...arr, 'x'.repeat(1100)]
  return `<html><body><script id="__NUXT_DATA__" type="application/json">${JSON.stringify(padded)}</script></body></html>`
}

describe('parseSidearmJsonRoster (snake_case Sidearm)', () => {
  it('resolves snake_case refs → name + bio overlay', () => {
    const players = parseSidearmJsonRoster(snakeArr)
    expect(players).toHaveLength(1)
    expect(players[0]).toMatchObject({
      name: 'Michael Foster',
      jersey: 32,
      hometown: 'Charlotte, N.C.',
      highSchool: 'Indian Land (S.C.) HS',
      previousSchool: null,
      position: null, // *_id refs are non-load-bearing; ESPN/CFBD supply these
      classYear: null,
    })
  })

  it('never emits the literal string "null" from a null-landing ref', () => {
    const [p] = parseSidearmJsonRoster(snakeArr)
    expect(p?.previousSchool).toBeNull()
  })

  it('ignores the camelCase shape (no snake_case keys → no rows)', () => {
    const camel: unknown[] = [null, { firstName: 2, lastName: 3, hometown: 4, highSchool: 5 }, 'A', 'B', 'X', 'Y']
    expect(parseSidearmJsonRoster(camel)).toHaveLength(0)
  })
})

describe('parseOfficialHtml engine routing', () => {
  it('routes a snake_case Nuxt island to the sidearm-json engine', () => {
    const res = parseOfficialHtml(wrapNuxt(snakeArr))
    expect(res.engine).toBe('sidearm-json')
    expect(res.degraded).toBe(false)
    expect(res.players).toHaveLength(1)
    expect(res.players[0]?.highSchool).toBe('Indian Land (S.C.) HS')
  })

  it('degrades (no throw) on a Nuxt island with no known player shape', () => {
    const res = parseOfficialHtml(wrapNuxt([null, { foo: 1, bar: 2 }, 'a', 'b']))
    expect(res.degraded).toBe(true)
    expect(res.players).toEqual([])
  })
})

describe('preflightTeam', () => {
  const base = (): Team => ({ ...(getTeamById('clemson-tigers') as Team) })

  it('passes a fully-populated team with no errors', () => {
    const r = preflightTeam(base())
    expect(r.ok).toBe(true)
    expect(r.issues.filter((i) => i.level === 'error')).toHaveLength(0)
  })

  it('errors on a missing/invalid espnId (roster spine is load-bearing)', () => {
    const t = { ...base(), espnId: undefined }
    const r = preflightTeam(t)
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.level === 'error' && i.field === 'espnId')).toBe(true)
  })

  it('warns (does not error) on an unknown official engine — degrade is allowed', () => {
    const t: Team = { ...base(), officialEngine: 'unknown' }
    const r = preflightTeam(t)
    expect(r.ok).toBe(true)
    expect(r.issues.some((i) => i.level === 'warn' && i.field === 'officialEngine')).toBe(true)
  })

  it('errors on a non-absolute official URL', () => {
    const t: Team = { ...base(), officialRosterUrl: 'floridagators.com/roster' }
    expect(preflightTeam(t).ok).toBe(false)
  })
})

describe('registry preflight (real 33-team registry)', () => {
  it('every team passes preflight with zero errors', () => {
    const r = preflightTeams(TEAMS)
    const errors = r.issues.filter((i) => i.level === 'error')
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0)
    expect(r.ok).toBe(true)
  })

  it('all 33 teams carry a numeric espnId + absolute officialRosterUrl', () => {
    for (const t of TEAMS) {
      expect(t.espnId, t.id).toMatch(/^\d+$/)
      expect(t.officialRosterUrl, t.id).toMatch(/^https:\/\//)
    }
  })
})
