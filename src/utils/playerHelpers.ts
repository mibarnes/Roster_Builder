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

/**
 * Human label for the recruiting-rating SOURCE (C2) — surfaced beside the rating
 * in the modal so the provenance is honest:
 *  - 247 Composite (the team's own CFBD/247-composite recruiting)
 *  - HS — signed with {school} '{yy} (cross-school national-index HS rating)
 *  - Transfer portal — from {origin}, {eligibility}
 * Returns null when there is no source tag (legacy teams / genuine walk-ons).
 */
export const getRecruitSourceLabel = (
  player: Pick<
    UIPlayer,
    'recruitSource' | 'recruitedSchool' | 'recruitYear' | 'transferOrigin' | 'transferEligibility' | 'isTransfer' | 'fromSchool'
  >,
): string | null => {
  const yy = (y: number | null): string => (y != null ? `'${String(y).slice(-2)}` : '')
  switch (player.recruitSource) {
    case 'cfbd-team':
      return '247 Composite'
    case 'cfbd-natl-id':
    case 'cfbd-natl-name': {
      const school = player.recruitedSchool
      return school
        ? `HS — signed with ${school} ${yy(player.recruitYear)}`.trim()
        : `HS recruiting ${yy(player.recruitYear)}`.trim()
    }
    case 'cfbd-portal': {
      const origin = player.transferOrigin
      const elig = player.transferEligibility
      const tail = [origin ? `from ${origin}` : null, elig].filter(Boolean).join(', ')
      return tail ? `Transfer portal — ${tail}` : 'Transfer portal'
    }
    case '247-portal':
      return player.transferOrigin
        ? `Transfer portal (247) — from ${player.transferOrigin}`
        : 'Transfer portal (247)'
    default:
      // No source tag: fall back to a sensible label when we still know it's a transfer.
      if (player.isTransfer && player.fromSchool) return `Transfer — from ${player.fromSchool}`
      return null
  }
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
