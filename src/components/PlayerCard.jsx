import React, { useState } from 'react';
import Star from './Star.jsx';
import { getClassColor, getEffectiveStars } from '../utils/playerHelpers.js';

export default function PlayerCard({ player, isStarter, onClick, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const ovr = player.ovr;
  const stars = getEffectiveStars(player);
  const isRS = player.year.includes('RS');
  const classYear = player.year.replace('RS ', '');

  return (
    <div
      onClick={() => onClick(player)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer select-none"
      style={{
        animation: `fadeSlideUp 0.4s ease-out ${delay}ms both`,
        transform: hovered ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div
        className={`relative overflow-hidden ${isStarter ? 'w-[100px]' : 'w-[90px]'}`}
        style={{
          background: '#000000',
          borderRadius: '10px',
          border: isStarter ? '2px solid #1a4d2e' : '1px solid #2a2a2a',
          boxShadow: hovered ? '0 8px 20px rgba(26,77,46,0.5), 0 0 15px rgba(26,77,46,0.3)' : isStarter ? '0 4px 12px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.5)',
          opacity: isStarter ? 1 : 0.9,
        }}
      >
        <div style={{ background: '#1a4d2e', padding: '6px 8px', position: 'relative' }}>
          <div className="absolute top-1 left-1.5">
            <span className="font-bold text-white text-[9px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>#{player.number}</span>
          </div>
          <div className="text-center pt-1">
            <span className="font-black text-white text-xs uppercase tracking-wide" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>{player.pos}</span>
          </div>
        </div>

        <div className="px-2.5 py-2">
          <div className="flex justify-center gap-0.5 mb-1.5">
            {[...Array(5)].map((_, i) => <Star key={i} filled={i < stars} />)}
          </div>

          <div className="text-center min-h-[32px] flex items-center justify-center mb-1">
            <span className="text-[9px] font-bold text-white uppercase tracking-tight leading-snug" style={{ wordBreak: 'break-word', maxWidth: '100%' }}>{player.name.toUpperCase()}</span>
          </div>

          <div className="flex justify-between items-center text-[8px] mb-1">
            <span className="font-bold text-gray-400">OVR {ovr}</span>
            <span className="font-bold" style={{ color: getClassColor(classYear) }}>{classYear}</span>
          </div>

          <div className="flex justify-center gap-1 min-h-[12px]">
            {isRS && <span className="text-[6px] font-black text-white px-1.5 py-0.5 rounded-full" style={{ background: '#7c3aed' }}>RS</span>}
            {player.isTransfer && <span className="text-[6px] font-black text-white px-1.5 py-0.5 rounded-full" style={{ background: '#f97316' }}>PTL</span>}
          </div>
        </div>

        {hovered && <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(26,77,46,0.15)' }} />}
      </div>

      {!isStarter && <div className="text-center mt-1"><span className="text-[7px] font-bold text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full">BACKUP</span></div>}
    </div>
  );
}
