export const getEffectiveStars = (player) => (
  player.isTransfer && player.transferStars ? player.transferStars : player.stars
);

export const getClassColor = (classYear) => ({
  FR: '#4ade80',
  SO: '#60a5fa',
  JR: '#fbbf24',
  SR: '#f87171',
}[classYear] || '#94a3b8');

export const getOvrColor = (ovr) => (
  ovr >= 90 ? '#fbbf24' : ovr >= 85 ? '#84cc16' : ovr >= 80 ? '#22c55e' : '#14b8a6'
);
