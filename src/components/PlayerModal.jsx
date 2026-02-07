import React from 'react';
import Star from './Star.jsx';
import { getEffectiveStars } from '../utils/playerHelpers.js';

export default function PlayerModal({ player, onClose }) {
  if (!player) return null;
  const stars = getEffectiveStars(player);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease-out' }} />
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ background: '#000000', border: '2px solid #1a4d2e', boxShadow: '0 30px 60px rgba(0,0,0,0.8)', animation: 'modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>

        <div className="relative p-5" style={{ background: '#0a0a0a' }}>
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white/80 hover:text-white hover:bg-gray-800 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center font-black text-3xl text-white shadow-xl" style={{ background: '#1a4d2e' }}>{player.ovr}</div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">{player.name.toUpperCase()}</h2>
              <p className="text-gray-400 text-sm font-semibold mt-1">#{player.number} • {player.pos} • {player.year}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-900 rounded-xl p-3">
              <div className="text-[11px] text-gray-400 uppercase font-semibold mb-2">Recruit Rating</div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} filled={i < stars} size="w-5 h-5" />)}</div>
                {player.isTransfer && <span className="text-[10px] font-black text-white px-2 py-1 rounded-full ml-1" style={{ background: '#f97316' }}>PORTAL</span>}
              </div>
            </div>
            <div className="flex-1 bg-gray-900 rounded-xl p-3">
              <div className="text-[11px] text-gray-400 uppercase font-semibold mb-2">Size</div>
              <div className="text-white font-bold text-lg">{player.ht} • {player.wt} lbs</div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase font-semibold">Composite Score</span>
              <span className="text-2xl font-black text-white">{player.composite.toFixed(1)}</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${player.composite}%`, background: '#1a4d2e', transition: 'width 0.5s ease-out' }} />
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-3">
            <div className="text-[11px] text-gray-400 uppercase font-semibold mb-3">2025 Season Stats</div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(player.stats).map(([key, val]) => (
                <div key={key} className="text-center bg-black rounded-xl py-2.5">
                  <div className="text-xl font-black text-white">{val}</div>
                  <div className="text-[10px] text-gray-400 uppercase font-semibold mt-0.5">{key}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
