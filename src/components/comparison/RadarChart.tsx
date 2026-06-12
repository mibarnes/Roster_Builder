/**
 * Dependency-free SVG radar (9 position-group spokes) with click-to-inspect
 * tooltips. Ported faithfully from the recovered RadarChart.jsx; consumed by
 * TeamComparisonView. No external charting dependency.
 */
import { useState } from 'react'
import type { EdgeSide } from './comparisonMath.ts'

const LABELS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'] as const
const N = LABELS.length
const CX = 150
const CY = 150
const R = 100
const RINGS = 4

const spokeAngle = (i: number): number => (i * 2 * Math.PI) / N - Math.PI / 2
const polarPt = (i: number, r: number): [number, number] => [
  CX + r * Math.cos(spokeAngle(i)),
  CY + r * Math.sin(spokeAngle(i)),
]
const toPoints = (pts: Array<[number, number]>): string =>
  pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
// OVR 65 → 0, OVR 93 → 1 (28-pt span). 0/negative ⇒ no value (collapse to center).
const normalize = (ovr: number): number =>
  ovr == null || ovr <= 0 ? 0 : Math.max(0, Math.min(1, (ovr - 65) / 28))

export interface SpokeMeta {
  groupId: string
  lOvr: number | null
  rOvr: number | null
  edge: EdgeSide
  lName: string | null
  rName: string | null
}

export interface RadarChartProps {
  leftValues: number[]
  rightValues: number[]
  leftColor: string
  rightColor: string
  spokeMeta: SpokeMeta[]
  leftLabel: string
  rightLabel: string
}

export default function RadarChart({
  leftValues,
  rightValues,
  leftColor,
  rightColor,
  spokeMeta,
  leftLabel,
  rightLabel,
}: RadarChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const leftPts = leftValues.map((v, i) => polarPt(i, normalize(v) * R))
  const rightPts = rightValues.map((v, i) => polarPt(i, normalize(v) * R))
  const ringPts = (r: number): Array<[number, number]> => LABELS.map((_, i) => polarPt(i, r))

  const handleSpoke = (i: number): void => setActiveIdx(activeIdx === i ? null : i)
  const activeMeta = activeIdx != null ? (spokeMeta[activeIdx] ?? null) : null

  return (
    <div>
      <svg viewBox="0 0 300 300" className="w-full max-w-[260px] mx-auto" role="img" aria-label="Position unit ratings radar">
        {[...Array(RINGS)].map((_, ri) => (
          <polygon
            key={ri}
            points={toPoints(ringPts((R * (ri + 1)) / RINGS))}
            fill={ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'none'}
            stroke="#1e293b"
            strokeWidth="1"
          />
        ))}

        {LABELS.map((label, i) => {
          const [x, y] = polarPt(i, R)
          return <line key={label} x1={CX} y1={CY} x2={x} y2={y} stroke="#1e293b" strokeWidth="1" />
        })}

        {rightValues.some((v) => v > 0) && (
          <polygon
            points={toPoints(rightPts)}
            fill={rightColor}
            fillOpacity={activeIdx != null ? 0.18 : 0.45}
            stroke={rightColor}
            strokeWidth="1.5"
            strokeOpacity={activeIdx != null ? 0.4 : 0.9}
            style={{ transition: 'fill-opacity 0.2s, stroke-opacity 0.2s' }}
          />
        )}

        {leftValues.some((v) => v > 0) && (
          <polygon
            points={toPoints(leftPts)}
            fill={leftColor}
            fillOpacity={activeIdx != null ? 0.18 : 0.45}
            stroke={leftColor}
            strokeWidth="1.5"
            strokeOpacity={activeIdx != null ? 0.4 : 0.9}
            style={{ transition: 'fill-opacity 0.2s, stroke-opacity 0.2s' }}
          />
        )}

        {leftPts.map(([x, y], i) =>
          (leftValues[i] ?? 0) > 0 ? (
            <circle
              key={`ld${i}`}
              cx={x}
              cy={y}
              r={activeIdx === i ? 4 : 2.5}
              fill={leftColor}
              opacity={activeIdx != null && activeIdx !== i ? 0.3 : 1}
              style={{ transition: 'r 0.15s, opacity 0.2s' }}
            />
          ) : null,
        )}
        {rightPts.map(([x, y], i) =>
          (rightValues[i] ?? 0) > 0 ? (
            <circle
              key={`rd${i}`}
              cx={x}
              cy={y}
              r={activeIdx === i ? 4 : 2.5}
              fill={rightColor}
              opacity={activeIdx != null && activeIdx !== i ? 0.3 : 1}
              style={{ transition: 'r 0.15s, opacity 0.2s' }}
            />
          ) : null,
        )}

        {LABELS.map((label, i) => {
          const [x, y] = polarPt(i, R + 20)
          const isActive = activeIdx === i
          return (
            <g key={label} onClick={() => handleSpoke(i)} style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={13} fill="transparent" />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                fill={isActive ? '#e2e8f0' : '#64748b'}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                style={{ transition: 'fill 0.15s' }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {activeMeta && (
        <div className="mx-auto max-w-[240px] mt-2 rounded-xl bg-gray-900 border border-gray-700 px-3 py-2 text-center">
          <div className="text-[11px] font-black text-white uppercase tracking-widest mb-1.5">{activeMeta.groupId}</div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-center flex-1">
              <div className="text-lg font-black" style={{ color: leftColor }}>
                {activeMeta.lOvr ?? '—'}
              </div>
              {activeMeta.lName && <div className="text-[9px] text-gray-400 truncate">{activeMeta.lName}</div>}
              <div className="text-[8px] text-gray-500">{leftLabel}</div>
            </div>
            <div className="text-[10px] font-black text-gray-600">vs</div>
            <div className="text-center flex-1">
              <div className="text-lg font-black" style={{ color: rightColor }}>
                {activeMeta.rOvr ?? '—'}
              </div>
              {activeMeta.rName && <div className="text-[9px] text-gray-400 truncate">{activeMeta.rName}</div>}
              <div className="text-[8px] text-gray-500">{rightLabel}</div>
            </div>
          </div>
          {activeMeta.edge !== 'even' && (
            <div
              className="text-[9px] font-bold uppercase tracking-widest mt-1.5"
              style={{ color: activeMeta.edge === 'left' ? leftColor : rightColor }}
            >
              EDGE: {activeMeta.edge === 'left' ? leftLabel : rightLabel}
            </div>
          )}
          {activeMeta.edge === 'even' && <div className="text-[9px] text-gray-600 font-semibold mt-1.5">EVEN</div>}
          <button
            type="button"
            onClick={() => setActiveIdx(null)}
            className="text-[8px] text-gray-600 mt-1.5 hover:text-gray-400"
          >
            dismiss
          </button>
        </div>
      )}

      {!activeMeta && <div className="text-center text-[9px] text-gray-700 mt-1">Tap a position to inspect</div>}
    </div>
  )
}
