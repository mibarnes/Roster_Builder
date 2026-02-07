import React from 'react';
import PositionGroup from './PositionGroup.jsx';

const defensiveFrontSlots = ['LDE', 'NT', 'DT', 'RDE'];

export default function DefenseFormation({ defensiveStarters, onPlayerClick }) {
  return (
    <div className="h-full flex flex-col justify-start gap-4 py-3 px-4">
      <div className="flex justify-center gap-3">
        {defensiveFrontSlots.map((slot, i) => (
          <PositionGroup key={slot} players={defensiveStarters[slot]} onClick={onPlayerClick} baseDelay={i * 80} />
        ))}
      </div>

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
}
