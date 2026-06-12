/**
 * 247Sports recruiting/commits HTML parser — PURE functions.
 * Isolated for unit testing against a saved fixture. Best-effort by design:
 * brittle markup is tolerated (returns [] / nulls) rather than throwing.
 * Ported from collect-cfbd-roster-stats.mjs.
 */
import { decodeHtml, normalizePosition, stdName, stripTags, toHeight } from '../normalize.ts'

export interface Recruit247 {
  name: string
  cleanedName: string
  player247Id: string | null
  playerUrl: string
  position: string
  height: string
  weight: number | null
  stars: number | null
  score: number | null
  nationalRank: number | null
  positionRank: number | null
  status: string
}

export interface Transfer247 {
  name: string
  cleanedName: string
  player247Id: string | null
  playerUrl: string
  position: string
  height: string
  weight: number | null
  transferStars: number | null
  transferRating: number | null
  fromSchool: string | null
  eligibility: string | null
}

export interface ClassSummary247 {
  compositeRank?: number
  overallRank?: number
  transferRank?: number
}

/** Parse the team class-ranking summary bar. */
export const parse247ClassSummary = (html: string): ClassSummary247 => {
  const ranks: ClassSummary247 = {}
  const pattern = /<div class="ir-bar__ranks">\s*<h3>([^<]+)<\/h3>\s*<span class="ir-bar__number">([^<]+)<\/span>/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    const label = stripTags(match[1]!).toLowerCase()
    const value = Number(stripTags(match[2]!).replace(/[^0-9.-]/g, ''))
    if (Number.isNaN(value)) continue
    if (label.includes('composite')) ranks.compositeRank = value
    if (label.includes('overall')) ranks.overallRank = value
    if (label.includes('transfer')) ranks.transferRank = value
  }
  return ranks
}

/** Parse high-school commit list items. */
export const parse247Commits = (html: string): Recruit247[] => {
  const rows: Recruit247[] = []
  const split = html.split('<li class="ri-page__list-item">').slice(1)

  for (const item of split) {
    const row = item.split('</li>')[0]!
    if (!row.includes('ri-page__name-link')) continue

    const nameMatch = row.match(/class="ri-page__name-link"[^>]*href="([^"]+)"[^>]*>([^<]+)</)
    if (!nameMatch) continue

    const href = decodeHtml(nameMatch[1]!)
    const name = stripTags(nameMatch[2]!)
    const idMatch = href.match(/-(\d+)\/?$/)

    const metrics = stripTags((row.match(/<div class="metrics">([\s\S]*?)<\/div>/) || [])[1] || '')
    const [heightRaw, weightRaw] = metrics.split('/').map((p) => p?.trim())

    const stars = (row.match(/icon-starsolid yellow/g) || []).length || null
    const scoreRaw = stripTags((row.match(/<span class="score">([^<]+)<\/span>/) || [])[1] || '')
    const score = Number(scoreRaw.replace(/[^0-9.]/g, ''))

    const nationalRankRaw = stripTags((row.match(/class="natrank"[^>]*>([^<]+)</) || [])[1] || '')
    const positionRankRaw = stripTags((row.match(/class="posrank"[^>]*>([^<]+)</) || [])[1] || '')
    const positionRaw = stripTags((row.match(/<div class="position">([\s\S]*?)<\/div>/) || [])[1] || '')
    const status = stripTags((row.match(/<p class="commit-date[^"]*">([\s\S]*?)<\/p>/) || [])[1] || '')

    rows.push({
      name,
      cleanedName: stdName(name),
      player247Id: idMatch ? idMatch[1]! : null,
      playerUrl: href.startsWith('http') ? href : `https:${href}`,
      position: normalizePosition(positionRaw),
      height: toHeight(heightRaw),
      weight: Number.isFinite(Number(weightRaw)) ? Number(weightRaw) : null,
      stars,
      score: Number.isFinite(score) ? score : null,
      nationalRank: Number.isFinite(Number(nationalRankRaw)) ? Number(nationalRankRaw) : null,
      positionRank: Number.isFinite(Number(positionRankRaw)) ? Number(positionRankRaw) : null,
      status,
    })
  }

  return rows
}

/** Parse transfer-portal list items embedded on the commits page. */
export const parse247Transfers = (html: string): Transfer247[] => {
  const rows: Transfer247[] = []
  const items = html.split('<li class="portal-list_itm">').slice(1)

  for (const item of items) {
    const row = item.split('</li>')[0]!
    if (row.includes('class="name"') || row.includes('list-header')) continue

    const nameMatch = row.match(/<div class="player">\s*<a href="([^"]+)">([^<]+)<\/a>/)
    if (!nameMatch) continue

    const href = decodeHtml(nameMatch[1]!)
    const name = stripTags(nameMatch[2]!).trim()
    if (!name) continue

    const idMatch = href.match(/-(\d+)\/?$/)

    const metrics = stripTags((row.match(/<div class="metrics">([\s\S]*?)<\/div>/) || [])[1] || '')
    const [heightRaw, weightRaw] = metrics.split('/').map((p) => p?.trim())

    const beforeTMarker = row.split('<span class="level">(T)</span>')[0] ?? ''
    const transferStars = (beforeTMarker.match(/icon-starsolid yellow/g) || []).length || null

    const tScoreMatch = row.match(/<span class="score">([\d.]+)\s*<span class="level">\(T\)<\/span>/)
    const transferRating = tScoreMatch ? Number(tScoreMatch[1]!) : null
    if (!transferRating) continue

    const positionRaw = stripTags((row.match(/<div class="position">([\s\S]*?)<\/div>/) || [])[1] || '')
    const eligibilityRaw = stripTags((row.match(/<div class="eligibility[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '')

    const transferInstIdx = row.indexOf('<div class="transfer-institution">')
    const fromSchoolMatch = transferInstIdx >= 0 ? row.slice(transferInstIdx).match(/<img[^>]*alt="([^"]+)"/) : null
    const fromSchool = fromSchoolMatch ? decodeHtml(fromSchoolMatch[1]!).trim() : null

    rows.push({
      name,
      cleanedName: stdName(name),
      player247Id: idMatch ? idMatch[1]! : null,
      playerUrl: href.startsWith('http') ? href : `https:${href}`,
      position: normalizePosition(positionRaw),
      height: toHeight(heightRaw),
      weight: Number.isFinite(Number(weightRaw)) ? Number(weightRaw) : null,
      transferStars,
      transferRating,
      fromSchool,
      eligibility: eligibilityRaw.trim() || null,
    })
  }

  return rows
}
