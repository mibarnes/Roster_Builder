import type { UIPlayer } from '../data/schema/ui.ts'

/** Transfers show their portal stars when present; otherwise recruit stars. */
export const getEffectiveStars = (player: Pick<UIPlayer, 'isTransfer' | 'transferStars' | 'stars'>): number =>
  player.isTransfer && player.transferStars ? player.transferStars : player.stars

export const getClassColor = (classYear: string | null): string =>
  ({
    FR: '#4ade80',
    SO: '#60a5fa',
    JR: '#fbbf24',
    SR: '#f87171',
  })[classYear ?? ''] ?? '#94a3b8'

export const getOvrColor = (ovr: number): string =>
  ovr >= 90 ? '#fbbf24' : ovr >= 85 ? '#84cc16' : ovr >= 80 ? '#22c55e' : '#14b8a6'

/** OVR badge text — honest "NR" for unrated players (never a fake number). */
export const getOvrDisplay = (player: Pick<UIPlayer, 'isRated' | 'ovr'>): string =>
  player.isRated ? String(player.ovr) : 'NR'

/** Muted grey for the NR badge so it reads as "unrated", not a low score. */
export const NR_COLOR = '#6b7280'

/** OVR color that respects NR (grey) vs a rated tier color. */
export const getOvrDisplayColor = (player: Pick<UIPlayer, 'isRated' | 'ovr'>): string =>
  player.isRated ? getOvrColor(player.ovr) : NR_COLOR

/** Human label for a rating method (modal). */
export const RATING_METHOD_LABEL: Record<UIPlayer['ratingMethod'], string> = {
  blended: 'Blended',
  'recruiting-projection': 'Recruiting projection',
  'production-only': 'Production only',
  nr: 'Not rated',
}

/** Up-to-2-char initials for the headshot fallback (e.g. "DJ Lagway" → "DL"). */
export const getInitials = (name: string | null | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Human labels for conflict field keys surfaced in the "sources disagree" affordance. */
const CONFLICT_FIELD_LABEL: Record<string, string> = {
  classYear: 'class year',
  position: 'position',
  jersey: 'jersey number',
  height: 'height',
  weight: 'weight',
  hometown: 'hometown',
}

/** Tooltip text for the conflict badge, e.g. "Sources disagree: class year, position". */
export const getConflictTitle = (conflictFields: string[]): string =>
  'Sources disagree: ' + conflictFields.map((f) => CONFLICT_FIELD_LABEL[f] ?? f).join(', ')
