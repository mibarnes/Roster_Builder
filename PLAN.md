# PLAN.md — Roster_Builder

## Current state (2026-06-12)
**Phase 0 (scaffold) complete.** Fresh hardened-TS project created at `~/.AI_APPS/ROSTER_BUILDER/`,
reconnected to public repo `mibarnes/Roster_Builder` on branch `rebuild/hardened-ts`. The old
npm/JSX build was cleared from this branch (recoverable from `main`). Toolchain skeleton + 32 real
team datasets + 34 logos are in place. The app UI is **not yet ported** — that work is driven by
[RESTORATION.md](RESTORATION.md), Phases 1–7.

## Recently completed
- Reconnaissance across GitHub + D-drive backup + `.recovery` → [_recovery/RECOVERY_REPORT.md](_recovery/RECOVERY_REPORT.md).
- Recovered the **uncommitted frontier** (3 components, 34 teams, logos, `.env`) from the D drive
  — it existed in no git history. Staged to `_recovered/` (gitignored, local).
- Seeded **32 real CFBD team captures** + **34 logos** into committed final homes
  (`src/data/collected/`, `src/assets/logos/`) — securing the irreplaceable data in git.
- Hardened toolchain: pnpm (supply-chain config), TypeScript strict, env-driven Vite base,
  Tailwind/PostCSS/Vitest, vendored npm guard, gitignored `.env` + durable secret copy.

## Active / next (next session)
Execute **RESTORATION.md Phase 1 → onward**:
1. **P1 Toolchain green** — `pnpm install`, verify dev/build/test run on the placeholder app.
2. **P2 Typed contracts + `teamRegistry.ts`** — zod schemas; one canonical 34-team registry.
3. **P3 Data layer port** — adapters → pipeline → mapToUI in TS; drop the 266K-line monolith for
   lazy per-team JSON; honest `bundled`/`mock` modes.
4. **P4 UI port + frontier features** — TSX components incl. TeamComparison / Radar / PositionDepth.
5. **P5 Pilot re-collection** — Florida + Miami only, gold-standard captures.
6. **P6 Testing + a11y hardening.**
7. **P7 Deploy (pnpm CI) + push to replace old `main`** (with user confirmation).

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
