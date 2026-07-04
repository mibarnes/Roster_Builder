/**
 * "About the data" (F8) — an honest, in-app explanation of where the numbers come
 * from and how OVR is computed. Surfaces provenance + methodology so nothing reads
 * as a black box (the project's zero-stub / honesty ethos). Static content + the
 * live team vintage.
 */
import type { DataVintage } from '../../data/schema/pipeline.ts'

export interface AboutDataModalProps {
  vintage: DataVintage | null
  onClose: () => void
}

export default function AboutDataModal({ vintage, onClose }: AboutDataModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About the data"
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-neutral-500 hover:text-white"
        >
          ✕
        </button>
        <h2 className="mb-1 text-lg font-black tracking-tight text-white">About the data</h2>
        {vintage?.collectedAt && (
          <p className="mb-4 text-xs text-neutral-500">
            This team: {vintage.rosterSeason} roster · {vintage.productionSeason} stats · collected{' '}
            {new Date(vintage.collectedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}

        <Section title="Where it comes from">
          Each player is a reconciled <b className="text-neutral-100">golden record</b> merged from:
          the <b className="text-neutral-100">ESPN</b> current-roster spine (identity, class, headshots),{' '}
          <b className="text-neutral-100">CollegeFootballData</b> (2025 production, usage, PPA, recruiting +
          transfer portal), each school's <b className="text-neutral-100">official site</b> (HS / hometown /
          previous school), and <b className="text-neutral-100">OurLads</b> depth charts. Nothing is
          fabricated — a player with no signal is shown <b className="text-neutral-100">NR</b> (not rated),
          never a fake number.
        </Section>

        <Section title="How OVR is computed">
          A blended 0–100 rating: <b className="text-neutral-100">45% recruiting</b> (247/on3 composite) +{' '}
          <b className="text-neutral-100">45% production</b> (per-position box score, games, usage, PPA) +{' '}
          <b className="text-neutral-100">10% class</b>. Each signal is a z-score against the{' '}
          <b className="text-neutral-100">league-wide</b> distribution for that position group (mean → 73),
          so a WR is measured against every FBS WR here — comparison across teams is honest. Confidence
          (from data completeness) tempers thin records.
        </Section>

        <Section title="Coverage + caveats">
          54 of the 67 Power-Four teams are loaded (the rest pend an API-quota reset). A few schools on
          non-standard roster CMSs degrade to hometown + recruiting only (no HS overlay) — still fully
          rated via ESPN + CFBD. Ratings are a model, not gospel; use them as a scouting lens.
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-400">{title}</h3>
      <p className="leading-relaxed text-[13px]">{children}</p>
    </div>
  )
}
