/** Coarse position group from a display position + side — for HQ + similar-players. */
export const COARSE_GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'ST'] as const
export type CoarseGroup = (typeof COARSE_GROUPS)[number]

export const coarseGroup = (pos: string, side: 'OFF' | 'DEF' | 'ST' = 'OFF'): CoarseGroup => {
  const p = pos.toUpperCase()
  if (/(^|\b)QB/.test(p)) return 'QB'
  if (/(RB|HB|FB|TB)/.test(p)) return 'RB'
  if (/(WR|WLR|SLOT)/.test(p)) return 'WR'
  if (/\bTE\b/.test(p)) return 'TE'
  if (/(OL|OT|OG|LT|RT|LG|RG|^C$|CENTER|TACKLE|GUARD)/.test(p)) return 'OL'
  if (/(DL|DE|DT|NT|EDGE|NG)/.test(p)) return 'DL'
  if (/(LB|MLB|WLB|SLB|ILB|OLB)/.test(p)) return 'LB'
  if (/(CB|DB|S$|SS|FS|NB|SAF|CORNER)/.test(p)) return 'DB'
  if (/(K|P|LS|KR|PR|ST)/.test(p)) return 'ST'
  return side === 'OFF' ? 'WR' : 'LB'
}
