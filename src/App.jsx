import React, { useEffect, useMemo, useState } from 'react';
import { loadPlayerPipeline } from './data/index.js';
import { mapPipelineToUI } from './data/mapPipelineToUI.js';

const EMPTY_OFFENSE = {
  LT: [], LG: [], C: [], RG: [], RT: [], WRX: [], SLOT: [], QB: [], RB: [], TE: [], WRZ: []
};

const EMPTY_DEFENSE = {
  LDE: [], NT: [], DT: [], RDE: [], LCB: [], SS: [], WLB: [], MLB: [], NB: [], FS: [], RCB: []
};

const Star = ({ filled }) => (
  <svg viewBox="0 0 20 20" className={`w-2.5 h-2.5 ${filled ? 'text-amber-400' : 'text-slate-700'}`} fill="currentColor">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const PlayerCard = ({ player, isStarter, onClick, delay = 0 }) => {
  const [hovered, setHovered] = useState(false);
  const ovr = player.ovr;
  const stars = player.isTransfer && player.transferStars ? player.transferStars : player.stars;
  const isRS = player.year.includes('RS');
  const classYear = player.year.replace('RS ', '');

  const getClassColor = () => ({ FR: '#4ade80', SO: '#60a5fa', JR: '#fbbf24', SR: '#f87171' }[classYear] || '#94a3b8');

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
            <span className="font-bold" style={{ color: getClassColor() }}>{classYear}</span>
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
};

const PositionGroup = ({ players, onClick, baseDelay = 0 }) => (
  <div className="flex flex-col items-center gap-1">
    {players.map((p, i) => <PlayerCard key={p.id} player={p} isStarter={i === 0} onClick={onClick} delay={baseDelay + i * 60} />)}
  </div>
);

const OffenseFormation = ({ offensiveStarters, onPlayerClick }) => (
  <div className="h-full flex flex-col justify-start gap-4 py-3 px-4">
    {/* Offensive Line - Front */}
    <div className="flex justify-center gap-2">
      {[offensiveStarters.LT, offensiveStarters.LG, offensiveStarters.C, offensiveStarters.RG, offensiveStarters.RT].map((pos, i) => (
        <PositionGroup key={i} players={pos} onClick={onPlayerClick} baseDelay={i * 80} />
      ))}
    </div>

    {/* QB/HB Behind with WR/TE Flanking */}
    <div className="flex justify-between items-center gap-2">
      <div className="flex gap-4">
        <PositionGroup players={offensiveStarters.WRX} onClick={onPlayerClick} baseDelay={400} />
        <PositionGroup players={offensiveStarters.SLOT} onClick={onPlayerClick} baseDelay={500} />
      </div>
      <div className="flex gap-6">
        <PositionGroup players={offensiveStarters.QB} onClick={onPlayerClick} baseDelay={600} />
        <PositionGroup players={offensiveStarters.RB} onClick={onPlayerClick} baseDelay={700} />
      </div>
      <div className="flex gap-4">
        <PositionGroup players={offensiveStarters.TE} onClick={onPlayerClick} baseDelay={800} />
        <PositionGroup players={offensiveStarters.WRZ} onClick={onPlayerClick} baseDelay={900} />
      </div>
    </div>
  </div>
);

const DefenseFormation = ({ defensiveStarters, onPlayerClick }) => (
  <div className="h-full flex flex-col justify-start gap-4 py-3 px-4">
    {/* Defensive Line - 4 players */}
    <div className="flex justify-center gap-3">
      {[defensiveStarters.LDE, defensiveStarters.NT, defensiveStarters.DT, defensiveStarters.RDE].map((pos, i) => (
        <PositionGroup key={i} players={pos} onClick={onPlayerClick} baseDelay={i * 80} />
      ))}
    </div>

    {/* Linebackers (3) with DBs (4) Flanking */}
    <div className="flex justify-between items-center gap-2">
      <div className="flex gap-4">
        <PositionGroup players={defensiveStarters.LCB} onClick={onPlayerClick} baseDelay={320} />
        <PositionGroup players={defensiveStarters.SS} onClick={onPlayerClick} baseDelay={400} />
      </div>
      <div className="flex gap-8">
        <PositionGroup players={defensiveStarters.WLB} onClick={onPlayerClick} baseDelay={480} />
        <PositionGroup players={defensiveStarters.MLB} onClick={onPlayerClick} baseDelay={560} />
        <PositionGroup players={defensiveStarters.NB} onClick={onPlayerClick} baseDelay={640} />
      </div>
      <div className="flex gap-4">
        <PositionGroup players={defensiveStarters.FS} onClick={onPlayerClick} baseDelay={720} />
        <PositionGroup players={defensiveStarters.RCB} onClick={onPlayerClick} baseDelay={800} />
      </div>
    </div>
  </div>
);

const PlayerModal = ({ player, onClose }) => {
  if (!player) return null;
  const stars = player.isTransfer && player.transferStars ? player.transferStars : player.stars;

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
                <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <svg key={i} viewBox="0 0 20 20" className={`w-5 h-5 ${i < stars ? 'text-amber-400' : 'text-gray-700'}`} fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}</div>
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
};

const RatingsView = ({ allPlayers, filters, setFilters, onPlayerClick }) => {
  const all = useMemo(() => allPlayers, [allPlayers]);
  const filtered = useMemo(() => {
    let r = [...all];
    if (filters.side !== 'ALL') r = r.filter(p => p.side === filters.side);
    if (filters.pos !== 'ALL') r = r.filter(p => p.pos === filters.pos);
    if (filters.stars > 0) r = r.filter(p => (p.isTransfer && p.transferStars ? p.transferStars : p.stars) >= filters.stars);
    r.sort((a, b) => filters.sort === 'composite' ? b.composite - a.composite : filters.sort === 'ovr' ? b.ovr - a.ovr : (b.isTransfer && b.transferStars ? b.transferStars : b.stars) - (a.isTransfer && a.transferStars ? a.transferStars : a.stars));
    return r;
  }, [all, filters]);

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'DE', 'DT', 'NT', 'LB', 'CB', 'SS', 'FS', 'NB'];
  const getOvrColor = (ovr) => ovr >= 90 ? '#fbbf24' : ovr >= 85 ? '#84cc16' : ovr >= 80 ? '#22c55e' : '#14b8a6';

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
          const stars = p.isTransfer && p.transferStars ? p.transferStars : p.stars;
          return (
            <div key={p.id} onClick={() => onPlayerClick(p)} className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-gray-900/50 active:bg-gray-800/50"
              style={{ borderBottom: '1px solid #1a1a1a', animation: `fadeSlideUp 0.3s ease-out ${i * 25}ms both` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg flex-shrink-0"
                style={{ background: '#1a4d2e' }}>{p.ovr}</div>
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
                  <div className="flex gap-0.5">{[...Array(stars)].map((_, j) => <svg key={j} viewBox="0 0 20 20" className="w-3.5 h-3.5 text-amber-400" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}</div>
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
};

const CompositeHeader = ({ offensiveStarters, defensiveStarters }) => {
  const calc = (p, d) => { let t = 0, c = 0; Object.values(p).forEach(x => x.slice(0, d).forEach(y => { t += y.composite; c++; })); return c ? (t / c).toFixed(1) : '0.0'; };
  return (
    <div className="flex items-center gap-2">
      {[
        { label: 'OFF', value: calc(offensiveStarters, 1) },
        { label: 'DEF', value: calc(defensiveStarters, 1) },
        { label: 'OVR', value: ((+calc(offensiveStarters, 1) + +calc(defensiveStarters, 1)) / 2).toFixed(1) }
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: '#1a4d2e' }}>
          <span className="text-[10px] font-medium text-gray-300">{label}</span>
          <span className="text-[12px] font-black text-white">{value}</span>
        </div>
      ))}
    </div>
  );
};

export default function MiamiRosterCompare() {
  const [tab, setTab] = useState('offense');
  const [filters, setFilters] = useState({ side: 'ALL', pos: 'ALL', stars: 0, sort: 'composite' });
  const [selected, setSelected] = useState(null);
  const [rosterData, setRosterData] = useState({ offensiveStarters: EMPTY_OFFENSE, defensiveStarters: EMPTY_DEFENSE, allPlayers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const hydrateRoster = async () => {
      try {
        const summary = await loadPlayerPipeline({ mode: 'mock' });
        setRosterData(mapPipelineToUI(summary.pipeline));
      } catch (error) {
        setLoadError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateRoster();
  }, []);

  const { offensiveStarters, defensiveStarters, allPlayers } = rosterData;

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
      
      <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background: '#000000', fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <header className="flex-shrink-0 px-4 py-3" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-lg" style={{ background: '#1a4d2e' }}>U</div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight">MIAMI HURRICANES</h1>
                <p className="text-[11px] text-gray-400 font-semibold">2025 ROSTER DEPTH CHART</p>
              </div>
            </div>
            <CompositeHeader offensiveStarters={offensiveStarters} defensiveStarters={defensiveStarters} />
          </div>
        </header>

        <nav className="flex-shrink-0 flex" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
          {[{ id: 'offense', label: 'OFFENSE', color: '#1a4d2e' }, { id: 'defense', label: 'DEFENSE', color: '#1a4d2e' }, { id: 'ratings', label: 'RATINGS', color: '#1a4d2e' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 py-3.5 text-[12px] font-bold relative transition-all" style={{ color: tab === t.id ? '#ffffff' : '#666666' }}>
              {t.label}
              {tab === t.id && <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: t.color }} />}
            </button>
          ))}
        </nav>

        {isLoading && <div className="px-4 py-2 text-xs font-semibold text-emerald-300" style={{ background: "#052e16" }}>Loading roster data…</div>}
        {loadError && <div className="px-4 py-2 text-xs font-semibold text-red-300" style={{ background: "#3f0b0b" }}>Failed to load data: {loadError}</div>}

        <main className="flex-1 overflow-hidden relative">
          {tab !== 'ratings' && (
            <div className="absolute inset-0">
              {[...Array(11)].map((_, i) => (
                <div key={i} className="absolute w-full h-px" style={{ top: `${(i + 1) * 8}%`, background: 'rgba(255,255,255,0.05)' }} />
              ))}
            </div>
          )}
          <div className="relative h-full">
            {tab === 'offense' && (
              <div className="h-full overflow-y-auto py-3">
                <div className="mx-auto max-w-6xl h-full rounded-2xl border border-gray-900 bg-black px-3">
                  <OffenseFormation offensiveStarters={offensiveStarters} onPlayerClick={setSelected} />
                </div>
              </div>
            )}
            {tab === 'defense' && (
              <div className="h-full overflow-y-auto py-3">
                <div className="mx-auto max-w-6xl h-full rounded-2xl border border-gray-900 bg-black px-3">
                  <DefenseFormation defensiveStarters={defensiveStarters} onPlayerClick={setSelected} />
                </div>
              </div>
            )}
            {tab === 'ratings' && <RatingsView allPlayers={allPlayers} filters={filters} setFilters={setFilters} onPlayerClick={setSelected} />}
          </div>
        </main>

        {tab !== 'ratings' && (
          <footer className="flex-shrink-0 py-2.5 px-4" style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a' }}>
            <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500">
              <span className="flex items-center gap-1.5"><svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-amber-400" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>Recruit Stars</span>
              <span className="flex items-center gap-1.5"><span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: '#7c3aed' }}>RS</span>Redshirt</span>
              <span className="flex items-center gap-1.5"><span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: '#f97316' }}>PTL</span>Portal</span>
              <span><span className="text-green-400 font-bold">FR</span> <span className="text-blue-400 font-bold">SO</span> <span className="text-amber-400 font-bold">JR</span> <span className="text-red-400 font-bold">SR</span></span>
            </div>
          </footer>
        )}

        <PlayerModal player={selected} onClose={() => setSelected(null)} />
      </div>
    </>
  );
}
