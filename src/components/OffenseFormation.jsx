import React from 'react';
import PositionGroup from './PositionGroup.jsx';

const offensiveLineSlots = ['LT', 'LG', 'C', 'RG', 'RT'];

export default function OffenseFormation({ offensiveStarters, onPlayerClick }) {
  return (
    <div className="h-full flex flex-col justify-start gap-5 py-3 px-4">
      <div className="flex justify-center gap-3">
        {offensiveLineSlots.map((slot, i) => (
          <PositionGroup key={slot} players={offensiveStarters[slot]} onClick={onPlayerClick} baseDelay={i * 80} />
        ))}
        <PositionGroup players={offensiveStarters.TE} onClick={onPlayerClick} baseDelay={400} />
      </div>

      <div className="grid grid-cols-6 items-start gap-3">
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.WRX} onClick={onPlayerClick} baseDelay={480} />
        </div>
        <div />
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.QB} onClick={onPlayerClick} baseDelay={560} />
        </div>
        <div />
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.SLOT} onClick={onPlayerClick} baseDelay={640} />
        </div>
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.WRZ} onClick={onPlayerClick} baseDelay={720} />
        </div>
      </div>

      <div className="grid grid-cols-6 items-start gap-3">
        <div />
        <div />
        <div className="flex justify-center">
          <PositionGroup players={offensiveStarters.RB} onClick={onPlayerClick} baseDelay={800} />
        </div>
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
