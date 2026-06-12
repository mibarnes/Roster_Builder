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
