import React, { useMemo } from 'react';
import Star from './Star.jsx';
import { getEffectiveStars, getOvrColor } from '../utils/playerHelpers.js';

export default function RatingsView({ allPlayers, filters, setFilters, onPlayerClick }) {
  const all = useMemo(() => allPlayers, [allPlayers]);
  const filtered = useMemo(() => {
    let r = [...all];
    if (filters.side !== 'ALL') r = r.filter(p => p.side === filters.side);
    if (filters.pos !== 'ALL') r = r.filter(p => p.pos === filters.pos);
    if (filters.stars > 0) r = r.filter(p => getEffectiveStars(p) >= filters.stars);
    r.sort((a, b) => filters.sort === 'composite'
      ? b.composite - a.composite
      : filters.sort === 'ovr'
        ? b.ovr - a.ovr
        : getEffectiveStars(b) - getEffectiveStars(a));
    return r;
  }, [all, filters]);

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'DE', 'DT', 'NT', 'LB', 'CB', 'SS', 'FS', 'NB'];

  return (
    <div className="h-full flex flex-col" style={{ background: '#000000' }}>
      <div className="flex-shrink-0 p-3 flex items-center gap-2 overflow-x-auto" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex rounded-xl overflow-hidden" style={{ background: '#1a1a1a' }}>
          {['ALL', 'OFF', 'DEF'].map(s => (
            <button key={s} onClick={() => setFilters(f => ({ ...f, side: s }))} className="px-4 py-2 text-[11px] font-bold transition-all"
              style={{ background: filters.side === s ? '#1a4d2e' : 'transparent', color: filters.side === s ? 'white' : '#666666' }}>{s}</button>
          ))}
        </div>
        <select value={filters.pos} onChange={e => setFilters(f => ({ ...f, pos: e.target.value }))} className="px-3 py-2 text-[11px] font-bold rounded-xl border-none outline-none text-white" style={{ background: '#1a1a1a' }}>
          {positions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filters.stars} onChange={e => setFilters(f => ({ ...f, stars: +e.target.value }))} className="px-3 py-2 text-[11px] font-bold rounded-xl border-none outline-none text-white" style={{ background: '#1a1a1a' }}>
          <option value={0}>★ ANY</option><option value={3}>★ 3+</option><option value={4}>★ 4+</option><option value={5}>★ 5</option>
        </select>
        <select value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))} className="px-3 py-2 text-[11px] font-bold rounded-xl border-none outline-none text-white" style={{ background: '#1a1a1a' }}>
          <option value="composite">COMPOSITE</option><option value="ovr">OVERALL</option><option value="stars">STARS</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((p, i) => {
          const stars = getEffectiveStars(p);
          return (
            <div key={p.id} onClick={() => onPlayerClick(p)} className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-gray-900/50 active:bg-gray-800/50"
              style={{ borderBottom: '1px solid #1a1a1a', animation: `fadeSlideUp 0.3s ease-out ${i * 25}ms both` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-lg flex-shrink-0"
                style={{ background: '#1a4d2e', color: getOvrColor(p.ovr) }}>{p.ovr}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-white">{p.name.split(' ').pop().toUpperCase()}</span>
                  <span className="text-[11px] text-gray-500 font-medium">#{p.number}</span>
                  {p.year.includes('RS') && <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: '#7c3aed' }}>RS</span>}
                  {p.isTransfer && <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: '#f97316' }}>PTL</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] font-bold text-gray-400">{p.pos}</span>
                  <span className="text-[11px] text-gray-500">{p.year.replace('RS ', '')}</span>
                  <div className="flex gap-0.5">{[...Array(stars)].map((_, j) => <Star key={j} filled size="w-3.5 h-3.5" />)}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-black text-white">{p.composite.toFixed(1)}</div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold">COMPOSITE</div>
              </div>
              <svg className="w-5 h-5 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 py-2.5 px-4 text-[12px] text-gray-400 font-semibold" style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a' }}>
        {filtered.length} players
      </div>
    </div>
  );
}
