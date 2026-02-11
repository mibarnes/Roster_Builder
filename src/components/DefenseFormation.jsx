import React from 'react';
import PositionGroup from './PositionGroup.jsx';

const defensiveFrontSlots = ['LDE', 'NT', 'DT', 'RDE'];

export default function DefenseFormation({ defensiveStarters, onPlayerClick }) {
  return (
    <div className="h-full flex flex-col justify-start gap-5 py-3 px-4">
      <div className="flex justify-center gap-3">
        {defensiveFrontSlots.map((slot, i) => (
          <PositionGroup key={slot} players={defensiveStarters[slot]} onClick={onPlayerClick} baseDelay={i * 80} />
        ))}
      </div>

      <div className="grid grid-cols-5 items-start gap-2">
        <div />
        <div className="flex justify-center">
          <PositionGroup players={defensiveStarters.WLB} onClick={onPlayerClick} baseDelay={320} />
        </div>
        <div className="flex justify-center">
          <PositionGroup players={defensiveStarters.MLB} onClick={onPlayerClick} baseDelay={400} />
        </div>
        <div className="flex justify-center">
          <PositionGroup players={defensiveStarters.NB} onClick={onPlayerClick} baseDelay={480} />
        </div>
        <div />
      </div>

      <div className="mx-auto flex w-full max-w-[620px] items-start justify-between px-8">
        <div className="flex justify-center">
          <PositionGroup players={defensiveStarters.LCB} onClick={onPlayerClick} baseDelay={560} />
        </div>
        <div className="flex justify-center">
          <PositionGroup players={defensiveStarters.SS} onClick={onPlayerClick} baseDelay={640} />
        </div>
        <div className="flex justify-center">
          <PositionGroup players={defensiveStarters.FS} onClick={onPlayerClick} baseDelay={720} />
        </div>
        <div className="flex justify-center">
          <PositionGroup players={defensiveStarters.RCB} onClick={onPlayerClick} baseDelay={800} />
        </div>
      </div>
    </div>
  );
}
