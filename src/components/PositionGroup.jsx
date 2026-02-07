import React from 'react';
import PlayerCard from './PlayerCard.jsx';

export default function PositionGroup({ players, onClick, baseDelay = 0 }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {players.map((p, i) => <PlayerCard key={p.id} player={p} isStarter={i === 0} onClick={onClick} delay={baseDelay + i * 60} />)}
    </div>
  );
}
