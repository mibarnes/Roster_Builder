import React, { useEffect, useState } from 'react';
import { loadPlayerPipeline } from './data/index.js';
import { mapPipelineToUI } from './data/mapPipelineToUI.js';
import CompositeHeader from './components/CompositeHeader.jsx';
import DefenseFormation from './components/DefenseFormation.jsx';
import OffenseFormation from './components/OffenseFormation.jsx';
import PlayerModal from './components/PlayerModal.jsx';
import RatingsView from './components/RatingsView.jsx';
import Star from './components/Star.jsx';

const EMPTY_OFFENSE = { LT: [], LG: [], C: [], RG: [], RT: [], WRX: [], SLOT: [], QB: [], RB: [], TE: [], WRZ: [] };
const EMPTY_DEFENSE = { LDE: [], NT: [], DT: [], RDE: [], LCB: [], SS: [], WLB: [], MLB: [], NB: [], FS: [], RCB: [] };
const EMPTY_METRICS = {
  offense: { avgStarterComposite: 0 },
  defense: { avgStarterComposite: 0 },
  team: { avgStarterComposite: 0 },
};

export default function MiamiRosterCompare() {
  const [tab, setTab] = useState('offense');
  const [filters, setFilters] = useState({ side: 'ALL', pos: 'ALL', stars: 0, sort: 'composite' });
  const [selected, setSelected] = useState(null);
  const [rosterData, setRosterData] = useState({ offensiveStarters: EMPTY_OFFENSE, defensiveStarters: EMPTY_DEFENSE, allPlayers: [] });
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const hydrateRoster = async () => {
      try {
        const summary = await loadPlayerPipeline({ mode: 'mock' });
        setRosterData(mapPipelineToUI(summary.pipeline));
        setMetrics(summary.pipeline.metrics ?? EMPTY_METRICS);
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
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none font-sans" style={{ background: '#000000' }}>
      <header className="flex-shrink-0 px-4 py-3" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-lg" style={{ background: '#1a4d2e' }}>U</div>
            <div>
              <h1 className="text-base font-black text-white tracking-tight">MIAMI HURRICANES</h1>
              <p className="text-[11px] text-gray-400 font-semibold">2025 ROSTER DEPTH CHART</p>
            </div>
          </div>
          <CompositeHeader metrics={metrics} />
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

      {isLoading && <div className="px-4 py-2 text-xs font-semibold text-emerald-300" style={{ background: '#052e16' }}>Loading roster data…</div>}
      {loadError && <div className="px-4 py-2 text-xs font-semibold text-red-300" style={{ background: '#3f0b0b' }}>Failed to load data: {loadError}</div>}

      <main className="flex-1 overflow-hidden relative">
        {tab !== 'ratings' && <div className="absolute inset-0">{[...Array(11)].map((_, i) => <div key={i} className="absolute w-full h-px" style={{ top: `${(i + 1) * 8}%`, background: 'rgba(255,255,255,0.05)' }} />)}</div>}
        <div className="relative h-full">
          {tab === 'offense' && <div className="h-full overflow-y-auto py-3"><div className="mx-auto max-w-6xl h-full rounded-2xl border border-gray-900 bg-black px-3"><OffenseFormation offensiveStarters={offensiveStarters} onPlayerClick={setSelected} /></div></div>}
          {tab === 'defense' && <div className="h-full overflow-y-auto py-3"><div className="mx-auto max-w-6xl h-full rounded-2xl border border-gray-900 bg-black px-3"><DefenseFormation defensiveStarters={defensiveStarters} onPlayerClick={setSelected} /></div></div>}
          {tab === 'ratings' && <RatingsView allPlayers={allPlayers} filters={filters} setFilters={setFilters} onPlayerClick={setSelected} />}
        </div>
      </main>

      {tab !== 'ratings' && (
        <footer className="flex-shrink-0 py-2.5 px-4" style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5"><Star filled size="w-3.5 h-3.5" />Recruit Stars</span>
            <span className="flex items-center gap-1.5"><span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: '#7c3aed' }}>RS</span>Redshirt</span>
            <span className="flex items-center gap-1.5"><span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style={{ background: '#f97316' }}>PTL</span>Portal</span>
            <span><span className="text-green-400 font-bold">FR</span> <span className="text-blue-400 font-bold">SO</span> <span className="text-amber-400 font-bold">JR</span> <span className="text-red-400 font-bold">SR</span></span>
          </div>
        </footer>
      )}

      <PlayerModal player={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
