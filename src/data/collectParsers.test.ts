/**
 * Unit tests for the isolated, fragile HTML parsers (M3 hardening).
 * They run against real saved fixtures (a fetched OurLads depth-chart page and a
 * 247Sports commits page) so a markup change in either source breaks CI loudly
 * rather than silently producing garbage data.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDepthChartFromOurlads,
  extractOurladsSectionRows,
  OURLADS_TBODY_IDS,
  parseOurladsDepthTable,
} from '../../scripts/collect/parsers/ourlads.ts'
import {
  parse247ClassSummary,
  parse247Commits,
  parse247Transfers,
} from '../../scripts/collect/parsers/recruiting247.ts'
import { mapRosterRows } from '../../scripts/collect/cfbd.ts'

const FIX = join(process.cwd(), 'scripts/collect/parsers/__fixtures__')
const ourladsHtml = readFileSync(join(FIX, 'ourlads-florida.html'), 'utf8')
const html247 = readFileSync(join(FIX, '247-florida-2025.html'), 'utf8')

describe('ourlads parser', () => {
  it('extracts offense + defense rows from the real page', () => {
    const offense = extractOurladsSectionRows(ourladsHtml, OURLADS_TBODY_IDS.offense)
    const defense = extractOurladsSectionRows(ourladsHtml, OURLADS_TBODY_IDS.defense)
    expect(offense.length).toBeGreaterThan(5)
    expect(defense.length).toBeGreaterThan(5)
  })

  it('each parsed row has a position token and a 5-deep player array', () => {
    const offense = extractOurladsSectionRows(ourladsHtml, OURLADS_TBODY_IDS.offense)
    for (const row of offense) {
      expect(row.position.length).toBeGreaterThan(0)
      expect(row.players).toHaveLength(5)
    }
    // The starters column should resolve real names (not all-null).
    const starters = offense.map((r) => r.players[0]).filter(Boolean)
    expect(starters.length).toBeGreaterThan(5)
  })

  it('parseOurladsDepthTable flips "Last, First CLASS" into "First Last"', () => {
    const rows = parseOurladsDepthTable(
      '<tr><td>QB</td><td>9</td><td>Lagway, DJ SO</td><td>13</td><td>Mertz, Aidan RS SR</td></tr>',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.position).toBe('QB')
    expect(rows[0]!.players[0]).toBe('DJ Lagway')
    expect(rows[0]!.players[1]).toBe('Aidan Mertz')
  })

  it('builds a depth chart against a roster with low stub ratio', () => {
    // Synthetic minimal roster covering the starters keeps the test independent
    // of the live CFBD roster; the real low-stub assertion happens in collection.
    const roster = mapRosterRows([
      { id: 1, firstName: 'Aaron', lastName: 'Philo', position: 'QB', year: 2 },
      { id: 2, firstName: 'Jadan', lastName: 'Baugh', position: 'RB', year: 2 },
    ])
    const result = buildDepthChartFromOurlads(ourladsHtml, roster)
    expect(result.parsedRows.offense).toBeGreaterThan(0)
    expect(result.parsedRows.defense).toBeGreaterThan(0)
    expect(Object.keys(result.depthChart.offense).length).toBeGreaterThan(0)
    // The two known roster names should resolve to their CFBD ids, not stubs.
    const offenseIds = Object.values(result.depthChart.offense)
    expect(offenseIds).toContain('CFBD-1') // Aaron Philo at QB
    expect(offenseIds).toContain('CFBD-2') // Jadan Baugh at RB
  })
})

describe('247 recruiting parser', () => {
  it('parses commit rows with names + ids from the real page', () => {
    const commits = parse247Commits(html247)
    expect(commits.length).toBeGreaterThan(0)
    for (const c of commits.slice(0, 5)) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.cleanedName.length).toBeGreaterThan(0)
    }
    // At least some commits should carry a star rating + 247 id.
    expect(commits.some((c) => (c.stars ?? 0) > 0)).toBe(true)
    expect(commits.some((c) => c.player247Id)).toBe(true)
  })

  it('parse247ClassSummary returns numeric ranks (or an empty object, never throws)', () => {
    const summary = parse247ClassSummary(html247)
    expect(typeof summary).toBe('object')
    for (const v of Object.values(summary)) expect(typeof v).toBe('number')
  })

  it('parse247Transfers tolerates absent portal markup without throwing', () => {
    const transfers = parse247Transfers(html247)
    expect(Array.isArray(transfers)).toBe(true)
    for (const t of transfers.slice(0, 3)) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.transferRating).toBeTruthy()
    }
  })
})
