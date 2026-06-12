# PLAN.md — Roster_Builder

## Current state (2026-06-12)
**M1 (foundation + first deploy) complete.** The hardened-TS scaffold is green on pnpm
(typecheck/test/build/dev all pass; CI proven on a clean runner) and the placeholder is **live**
at https://mibarnes.github.io/Roster_Builder/ via the modern official-Pages-actions workflow
(env-driven `VITE_BASE`, no secret in the bundle). `main` still holds the old build (cutover is M6).
Branch `rebuild/hardened-ts`. The app UI is **not yet ported** — next is M2 (typed contracts +
team registry). Execution order is the M1–M6 milestone plan; tactical detail in [RESTORATION.md](RESTORATION.md).

Phase 0 (scaffold): done — toolchain skeleton + 32 real team datasets + 34 logos seeded; old
npm/JSX build cleared from the branch (recoverable from `main`).

## Recently completed
- Reconnaissance across GitHub + D-drive backup + `.recovery` → [_recovery/RECOVERY_REPORT.md](_recovery/RECOVERY_REPORT.md).
- Recovered the **uncommitted frontier** (3 components, 34 teams, logos, `.env`) from the D drive
  — it existed in no git history. Staged to `_recovered/` (gitignored, local).
- Seeded **32 real CFBD team captures** + **34 logos** into committed final homes
  (`src/data/collected/`, `src/assets/logos/`) — securing the irreplaceable data in git.
- Hardened toolchain: pnpm (supply-chain config), TypeScript strict, env-driven Vite base,
  Tailwind/PostCSS/Vitest, vendored npm guard, gitignored `.env` + durable secret copy.

## Active / next
- [x] **M1 Foundation + first deploy** — toolchain green on pnpm; CI proven; placeholder live.
- [x] **M2 Typed contracts + `teamRegistry.ts`** — zod schemas; 33-team registry; data-QA gate.
- [x] **M3 Harden collector + gold pilot data** — TS collector (pilots-only, fail-loud); Miami now real.
- [x] **M4 Pilot vertical slice** — data layer (lazy per-team JSON, no monolith) + core UI; live.
- [x] **M5 Broaden** — all 33 teams load; frontier features (Comparison/Radar/PositionDepth) wired.
- [~] **M6 Harden + cutover** — error boundary + 117 tests + secrets scrub DONE; **cutover to `main`
      pending user confirmation** (browser pixel-verify blocked: chromium missing system libs here).

Live (rebuild branch): https://mibarnes.github.io/Roster_Builder/ — full app, Florida + Miami gold,
other 31 teams honest-partial. `main` still holds the OLD build until cutover.

## Longer-term direction
README roadmap carried from the original: export depth chart as image, injury/portal tracking,
recruiting-class analysis, historical roster comparisons, live stats. Bulk re-collection of the
full conference (beyond the 2 pilots) is a deferred future phase.

## Explicitly deferred
- Formalizing the `.AI_APPS` workspace class in global `~/.AI_TOOLS/AGENTS.md` §6.
- Re-collecting the 31 non-pilot teams (carried as static seed; uneven quality accepted for now).
- ESLint config (not added in scaffold; add if/when desired).
- API-key rotation (user chose to keep the existing key).

## Decisions log
- **2026-06-12** Full TypeScript + zod; ACC+SEC 34-team scope; seed real captures only; pilots =
  Florida + Miami; reconnect to same public repo; keep CFBD key. (See RESTORATION.md §Decisions.)
- **2026-06-12** App at repo root (not `app/`); scaffold stops before `pnpm install` (clean handoff).
- **2026-06-12** Miami + Alabama recovered data are mock placeholders → not seeded as real;
  Alabama dropped, Miami becomes a pilot (re-collected).
