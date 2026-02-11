import React, { useMemo } from 'react';
import Star from './Star.jsx';
import { getEffectiveStars, getOvrColor } from '../utils/playerHelpers.js';

export default function RatingsView({ allPlayers, filters, setFilters, onPlayerClick }) {
  const all = useMemo(() => allPlayers, [allPlayers]);
  const filtered = useMemo(() => {
    const r = [...all]
      .filter((p) => (filters.side !== 'ALL' ? p.side === filters.side : true))
      .filter((p) => (filters.pos !== 'ALL' ? p.pos === filters.pos : true))
      .filter((p) => (filters.stars > 0 ? getEffectiveStars(p) >= filters.stars : true));

    r.sort((a, b) => {
      if (filters.sort === 'composite') return b.composite - a.composite;
      if (filters.sort === 'ovr') return b.ovr - a.ovr;
      return getEffectiveStars(b) - getEffectiveStars(a);
    });

    return r;
  }, [all, filters]);

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'DE', 'DT', 'NT', 'LB', 'CB', 'SS', 'FS', 'NB'];

  return (
    <div className="h-full flex flex-col bg-card-bg">
      <div className="flex-shrink-0 p-3 flex items-center gap-2 overflow-x-auto bg-surface border-b border-surface-border">
        <div className="flex rounded-xl overflow-hidden bg-surface-border" role="tablist" aria-label="Filter by side">
          {['ALL', 'OFF', 'DEF'].map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={filters.side === s}
              onClick={() => setFilters((f) => ({ ...f, side: s }))}
              className={`px-4 py-2 text-[11px] font-bold transition-all ${filters.side === s ? 'team-accent-bg text-white' : 'text-[#666666]'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by position"
          value={filters.pos}
          onChange={(e) => setFilters((f) => ({ ...f, pos: e.target.value }))}
          className="px-3 py-2 text-[11px] font-bold rounded-xl border-none outline-none text-white bg-surface-border"
        >
          {positions.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select
          aria-label="Filter by stars"
          value={filters.stars}
          onChange={(e) => setFilters((f) => ({ ...f, stars: +e.target.value }))}
          className="px-3 py-2 text-[11px] font-bold rounded-xl border-none outline-none text-white bg-surface-border"
        >
          <option value={0}>★ ANY</option><option value={3}>★ 3+</option><option value={4}>★ 4+</option><option value={5}>★ 5</option>
        </select>
        <select
          aria-label="Sort ratings list"
          value={filters.sort}
          onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
          className="px-3 py-2 text-[11px] font-bold rounded-xl border-none outline-none text-white bg-surface-border"
        >
          <option value="composite">COMPOSITE</option><option value="ovr">OVERALL</option><option value="stars">STARS</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((p, i) => {
          const stars = getEffectiveStars(p);
          return (
            <div
              key={p.id}
              onClick={() => onPlayerClick(p)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-gray-900/50 active:bg-gray-800/50 border-b border-surface-border"
              style={{ animation: `fadeSlideUp 0.3s ease-out ${i * 25}ms both` }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-lg flex-shrink-0 team-accent-bg" style={{ color: getOvrColor(p.ovr) }}>{p.ovr}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-white">{p.name.toUpperCase()}</span>
                  <span className="text-[11px] text-gray-500 font-medium">#{p.number}</span>
                  {p.year.includes('RS') && <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-rs-purple">RS</span>}
                  {p.isTransfer && <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-portal-orange">PTL</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] font-bold text-gray-400">{p.pos}</span>
                  <span className="text-[11px] text-gray-500">{p.year.replace('RS ', '')}</span>
                  <div className="flex gap-0.5" aria-label={`${stars} out of 5 stars`}>
                    {[...Array(stars)].map((_, j) => <Star key={j} filled size="w-3.5 h-3.5" />)}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-black text-white">{p.composite.toFixed(1)}</div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold">COMPOSITE</div>
              </div>
              <svg className="w-5 h-5 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          );
        })}
      </div>
      <div className="flex-shrink-0 py-2.5 px-4 text-[12px] text-gray-400 font-semibold bg-surface border-t border-surface-border">
        {filtered.length} players
      </div>
    </div>
  );
}
