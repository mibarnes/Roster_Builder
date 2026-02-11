import React, { useState } from 'react';
import Star from './Star.jsx';
import { getEffectiveStars } from '../utils/playerHelpers.js';

const classTextColor = {
  FR: 'text-green-400',
  SO: 'text-blue-400',
  JR: 'text-amber-400',
  SR: 'text-red-400'
};

export default function PlayerCard({ player, isStarter, onClick, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const ovr = player.ovr;
  const stars = getEffectiveStars(player);
  const isRS = player.year.includes('RS');
  const classYear = player.year.replace('RS ', '');

  const handleActivate = () => onClick(player);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View details for ${player.name}`}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer select-none focus:outline-none focus-visible:ring-2 team-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg"
      style={{
        animation: `fadeSlideUp 0.4s ease-out ${delay}ms both`,
        transform: hovered ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div
        className={`relative overflow-hidden rounded-[10px] ${isStarter ? 'w-[100px] border-2 team-accent-border shadow-[0_4px_12px_rgba(0,0,0,0.6)]' : 'w-[90px] border border-[#2a2a2a] shadow-[0_2px_8px_rgba(0,0,0,0.5)]'} bg-card-bg ${isStarter ? 'opacity-100' : 'opacity-90'}`}
        style={{
          boxShadow: hovered
            ? '0 8px 20px rgba(var(--team-accent-rgb, 26, 77, 46), 0.5), 0 0 15px rgba(var(--team-accent-rgb, 26, 77, 46), 0.3)'
            : undefined
        }}
      >
        <div className="team-accent-bg px-2 py-1.5 relative">
          <div className="absolute top-1 left-1.5">
            <span className="font-bold text-white text-[9px]">#{player.number}</span>
          </div>
          <div className="text-center pt-1">
            <span className="font-black text-white text-xs uppercase tracking-wide">{player.pos}</span>
          </div>
        </div>

        <div className="px-2.5 py-2">
          <div className="flex justify-center gap-0.5 mb-1.5" aria-label={`${stars} out of 5 stars`}>
            {[...Array(5)].map((_, i) => <Star key={i} filled={i < stars} />)}
          </div>

          <div className="text-center min-h-[32px] flex items-center justify-center mb-1">
            <span className="text-[9px] font-bold text-white uppercase tracking-tight leading-snug break-words max-w-full">{player.name.toUpperCase()}</span>
          </div>

          <div className="flex justify-between items-center text-[8px] mb-1">
            <span className="font-bold text-gray-400">OVR {ovr}</span>
            <span className={`font-bold ${classTextColor[classYear] ?? 'text-slate-400'}`} aria-label={`Class ${classYear}`}>{classYear}</span>
          </div>

          <div className="flex justify-center gap-1 min-h-[12px]">
            {isRS && <span className="text-[6px] font-black text-white px-1.5 py-0.5 rounded-full bg-rs-purple">RS</span>}
            {player.isTransfer && <span className="text-[6px] font-black text-white px-1.5 py-0.5 rounded-full bg-portal-orange">PTL</span>}
          </div>
        </div>

        {hovered && <div className="absolute inset-0 pointer-events-none team-accent-overlay" />}
      </div>

      {!isStarter && <div className="text-center mt-1"><span className="text-[7px] font-bold text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full">BACKUP</span></div>}
    </div>
  );
}
