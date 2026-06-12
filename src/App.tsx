/**
 * Placeholder shell for the hardened TypeScript rebuild.
 *
 * This is intentionally minimal: Phase 0 (scaffold) establishes the toolchain only.
 * The real UI is ported from the recovered build in Phases 3–4 — see RESTORATION.md.
 * Recovered source to port: _recovered/backup_frontier/src/
 */
export default function App() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-extrabold text-miami-green">CFB Roster Portal</h1>
      <p className="max-w-md text-sm text-white/70">
        Hardened TypeScript rebuild — scaffold in place. UI port pending (see{' '}
        <code className="text-portal-orange">RESTORATION.md</code>).
      </p>
    </main>
  )
}
