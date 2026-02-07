import React from 'react';

export default function CompositeHeader({ metrics }) {
  const badges = [
    { label: 'OFF', value: metrics?.offense?.avgStarterComposite ?? 0 },
    { label: 'DEF', value: metrics?.defense?.avgStarterComposite ?? 0 },
    { label: 'OVR', value: metrics?.team?.avgStarterComposite ?? 0 },
  ];

  return (
    <div className="flex items-center gap-2">
      {badges.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-miami-green">
          <span className="text-[10px] font-medium text-gray-300">{label}</span>
          <span className="text-[12px] font-black text-white">{Number(value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}
