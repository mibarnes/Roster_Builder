import React, { useEffect, useState } from 'react';
import { loadPlayerPipeline } from './data/index.js';
import { mapPipelineToUI } from './data/mapPipelineToUI.js';
import CompositeHeader from './components/CompositeHeader.jsx';
import DefenseFormation from './components/DefenseFormation.jsx';
import OffenseFormation from './components/OffenseFormation.jsx';
import PlayerModal from './components/PlayerModal.jsx';
import RatingsView from './components/RatingsView.jsx';
import Star from './components/Star.jsx';
import { DEFAULT_TEAM_ID, TEAM_OPTIONS, getTeamAccentColor, getTeamById } from './data/teamConfig.js';

const EMPTY_OFFENSE = { LT: [], LG: [], C: [], RG: [], RT: [], WRX: [], SLOT: [], QB: [], RB: [], TE: [], WRZ: [] };
const EMPTY_DEFENSE = { LDE: [], NT: [], DT: [], RDE: [], LCB: [], SS: [], WLB: [], MLB: [], NB: [], FS: [], RCB: [] };
const EMPTY_METRICS = {
  offense: { avgStarterComposite: 0 },
  defense: { avgStarterComposite: 0 },
  team: { avgStarterComposite: 0 },
};

const hexToRgbString = (hex = '#1a4d2e') => {
  const clean = String(hex).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '26, 77, 46';
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

export default function MiamiRosterCompare() {
  const [tab, setTab] = useState('offense');
  const [teamId, setTeamId] = useState(DEFAULT_TEAM_ID);
  const [depthTeam, setDepthTeam] = useState('starters');
  const [filters, setFilters] = useState({ side: 'ALL', pos: 'ALL', stars: 0, sort: 'composite' });
  const [selected, setSelected] = useState(null);
  const [returnFocusEl, setReturnFocusEl] = useState(null);
  const [rosterData, setRosterData] = useState({ offensiveStarters: EMPTY_OFFENSE, defensiveStarters: EMPTY_DEFENSE, allPlayers: [] });
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const selectedTeam = getTeamById(teamId);
  const teamAccentColor = getTeamAccentColor(selectedTeam);
  const dataMode = import.meta.env?.VITE_DATA_MODE ?? 'connected';

  useEffect(() => {
    const hydrateRoster = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const summary = await loadPlayerPipeline({ mode: dataMode, team: selectedTeam.label });
        setRosterData(mapPipelineToUI(summary.pipeline));
        setMetrics(summary.pipeline.metrics ?? EMPTY_METRICS);
      } catch (error) {
        setLoadError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateRoster();
  }, [dataMode, selectedTeam.label]);

  const onPlayerClick = (player) => {
    setReturnFocusEl(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSelected(player);
  };

  const { offensiveStarters, defensiveStarters, allPlayers } = rosterData;
  const tabs = [{ id: 'offense', label: 'OFFENSE' }, { id: 'defense', label: 'DEFENSE' }, { id: 'ratings', label: 'RATINGS' }];
  const depthModes = [{ id: 'starters', label: 'Starters' }, { id: 'second-team', label: '2nd Team' }];
  const depthIndex = depthTeam === 'second-team' ? 1 : 0;
  const filterFormationByDepth = (formation, index) =>
    Object.fromEntries(
      Object.entries(formation).map(([slot, players]) => [
        slot,
        players[index] ? [players[index]] : []
      ])
    );
  const visibleOffense = filterFormationByDepth(offensiveStarters, depthIndex);
  const visibleDefense = filterFormationByDepth(defensiveStarters, depthIndex);

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden select-none font-sans bg-card-bg"
      style={{ '--team-accent': teamAccentColor, '--team-accent-rgb': hexToRgbString(teamAccentColor) }}
    >
      <header className="flex-shrink-0 px-4 py-3 bg-surface border-b border-surface-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-lg team-accent-bg">U</div>
            <div>
              <h1 className="text-base font-black text-white tracking-tight">{selectedTeam.label.toUpperCase()}</h1>
              <p className="text-[11px] text-gray-400 font-semibold">2025 ROSTER DEPTH CHART</p>
            </div>
          </div>
          <CompositeHeader metrics={metrics} />
        </div>
      </header>

      <div className="flex-shrink-0 px-4 py-2 bg-surface border-b border-surface-border">
        <div className="mx-auto max-w-6xl flex items-center justify-end gap-2">
          <label htmlFor="team-select" className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Team</label>
          <select
            id="team-select"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            className="rounded-md border border-surface-border bg-card-bg px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 team-accent-ring"
          >
            {TEAM_OPTIONS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="flex-shrink-0 flex bg-surface border-b border-surface-border" role="tablist" aria-label="Roster views">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3.5 text-[12px] font-bold relative transition-all ${tab === t.id ? 'text-white' : 'text-[#666666]'}`}
          >
            {t.label}
            {tab === t.id && <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full team-accent-bg" />}
          </button>
        ))}
      </nav>
      {tab !== 'ratings' && (
        <div className="flex-shrink-0 px-4 py-2.5 bg-surface border-b border-surface-border">
          <div className="mx-auto w-fit rounded-xl border border-surface-border bg-black/40 p-1">
            <div className="flex items-center gap-1" role="group" aria-label="Depth chart team">
              {depthModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setDepthTeam(mode.id)}
                  className={`min-w-[92px] rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    depthTeam === mode.id ? 'team-accent-bg text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  aria-pressed={depthTeam === mode.id}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading && <div className="px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950">Loading roster data…</div>}
      {loadError && <div className="px-4 py-2 text-xs font-semibold text-red-300 bg-red-950">Failed to load data: {loadError}</div>}

      <main className="flex-1 overflow-hidden relative">
        {tab !== 'ratings' && (
          <div className="absolute inset-0">
            {[...Array(11)].map((_, i) => (
              <div key={i} className="absolute w-full h-px bg-white/5" style={{ top: `${(i + 1) * 8}%` }} />
            ))}
          </div>
        )}
        <div className="relative h-full">
          {tab === 'offense' && <div className="h-full overflow-y-auto py-3"><div className="mx-auto max-w-6xl h-full rounded-2xl border border-gray-900 bg-black px-3"><OffenseFormation offensiveStarters={visibleOffense} onPlayerClick={onPlayerClick} /></div></div>}
          {tab === 'defense' && <div className="h-full overflow-y-auto py-3"><div className="mx-auto max-w-6xl h-full rounded-2xl border border-gray-900 bg-black px-3"><DefenseFormation defensiveStarters={visibleDefense} onPlayerClick={onPlayerClick} /></div></div>}
          {tab === 'ratings' && <RatingsView allPlayers={allPlayers} filters={filters} setFilters={setFilters} onPlayerClick={onPlayerClick} />}
        </div>
      </main>

      {tab !== 'ratings' && (
        <footer className="flex-shrink-0 py-2.5 px-4 bg-surface border-t border-surface-border">
          <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5"><Star filled size="w-3.5 h-3.5" />Recruit Stars</span>
            <span className="flex items-center gap-1.5"><span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-rs-purple">RS</span>Redshirt</span>
            <span className="flex items-center gap-1.5"><span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full bg-portal-orange">PTL</span>Portal</span>
            <span><span className="text-green-400 font-bold">FR</span> <span className="text-blue-400 font-bold">SO</span> <span className="text-amber-400 font-bold">JR</span> <span className="text-red-400 font-bold">SR</span></span>
          </div>
        </footer>
      )}

      <PlayerModal player={selected} onClose={() => setSelected(null)} returnFocusEl={returnFocusEl} />
    </div>
  );
}
