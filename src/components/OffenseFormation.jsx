import React from 'react';
import PositionGroup from './PositionGroup.jsx';

const offensiveLineSlots = ['LT', 'LG', 'C', 'RG', 'RT'];

export default function OffenseFormation({ offensiveStarters, onPlayerClick }) {
  return (
    <div className="h-full flex flex-col justify-start gap-4 py-3 px-4">
      <div className="flex justify-center gap-2">
        {offensiveLineSlots.map((slot, i) => (
          <PositionGroup key={slot} players={offensiveStarters[slot]} onClick={onPlayerClick} baseDelay={i * 80} />
        ))}
      </div>

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
}
