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
