# CFB Roster Portal (Roster_Builder)

An interactive, EA-Sports-style web app for exploring college-football rosters, depth charts,
and player ratings across the **ACC + SEC (34 teams)** — team metrics, an interactive depth
chart, a ratings/filter view, and a multi-team comparison view (radar + position-depth).

> **This is the hardened v2 rebuild.** It recreates a build that was lost, recovered from a
> public GitHub repo + a D-drive backup that held substantial uncommitted work. The rebuild is
> **TypeScript + zod + pnpm**, on one clean team registry, with env-driven deploy paths. See
> [RESTORATION.md](RESTORATION.md) for the full recovery story and the phased build plan, and
> [_recovery/RECOVERY_REPORT.md](_recovery/RECOVERY_REPORT.md) for the reconnaissance detail.

## Status

**Phase 0 (scaffold) complete** — toolchain skeleton + recovered data seeded. The application
itself is **not yet ported**; that is Phases 1–7, driven by [RESTORATION.md](RESTORATION.md).
`src/App.tsx` is a placeholder shell.

## Stack

- React 18 + Vite 6 + Tailwind 3, **TypeScript** (strict), **zod** at data boundaries
- **pnpm** (corepack-pinned) — this project does **not** use npm (see [AGENTS.md](AGENTS.md))
- Vitest + React Testing Library
- Data: CollegeFootballData API (CFBD) + OurLads / 247Sports scrapers (offline collection)

## Quick start (after Phase 1)

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm approve-builds esbuild     # one-time
pnpm dev                        # http://localhost:3000
pnpm build                      # typecheck + production build
pnpm test                       # vitest
```

> Requires the Node version in [.node-version](.node-version) (fnm auto-switches on `cd`).

## Data model (high level)

`source adapters (roster / recruiting / ratings / production) → buildPlayerPipeline (join by
playerId) → mapPipelineToUI → React`. A `bundled` vs `mock` data mode switch. Real per-team data
is collected offline by `scripts/` and stored as per-team JSON under `src/data/collected/<team>/`.

- **32 teams** are seeded with real CFBD captures (carried from the recovered backup).
- **Pilot teams = Florida Gators + Miami Hurricanes** — the two we actively build out; all
  re-collection / data-hardening focuses on these. (Miami was a mock placeholder in the recovered
  build and is re-collected fresh.) Other teams' uneven data is surfaced honestly in the UI.

## Repo layout

| Path | What |
|---|---|
| `src/` | App (TSX) — ported in Phases 3–4 |
| `src/data/collected/<team>/` | Seeded real per-team JSON (roster / recruiting / production) |
| `src/assets/logos/` | 34 team logos |
| `scripts/` | Data collectors (ported to TS in Phase 5) + `guard-no-npm.sh` |
| `docs/` | Original PRD / phase docs (reference) |
| `_recovered/` | **Gitignored.** Local read-only staging of the recovered build to port from |
| `_recovery/` | Recovery reconnaissance report |
| `RESTORATION.md` | The phased rebuild execution guide (start here next session) |

## Deployment

GitHub Pages (`VITE_BASE=/Roster_Builder/`) and Netlify (root) from the same build. Reconnected
to the public repo **mibarnes/Roster_Builder**; the hardened build replaces the old `main` (Phase 7).
