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

**Live** at https://mibarnes.github.io/Roster_Builder/ (publishes from `main`). The full rebuild
(M1–M6) + pilot enrichment + multi-source golden-record reconciliation are complete: interactive
depth chart, ratings/filter view, multi-team comparison (radar + position-depth), and a rich
player modal — all TypeScript-strict + zod, **259 tests**.

**Florida + Miami** are gold-standard *pilot* teams (multi-source golden masters with headshots,
provenance, conflict flags, blended ratings); the other 31 teams carry a shallower single-source
static seed. Evolving this demo into a polished, zero-stub CFB intelligence tool is the **F0–F8
finalization plan** — design in [docs/FINALIZATION_BLUEPRINT.md](docs/FINALIZATION_BLUEPRINT.md),
execution tracked in [PLAN.md](PLAN.md). [RESTORATION.md](RESTORATION.md) is retained as recovery
history.

## Stack

- React 18 + Vite 6 + Tailwind 3, **TypeScript** (strict), **zod** at data boundaries
- **pnpm** (corepack-pinned) — this project does **not** use npm (see [AGENTS.md](AGENTS.md))
- Vitest + React Testing Library
- Data: CollegeFootballData API (CFBD) + OurLads / 247Sports scrapers (offline collection)

## Quick start

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

Two data depths flow into one in-app pipeline (unifying them is F3 in [PLAN.md](PLAN.md)):

- **Pilots (Florida, Miami)** — multi-source **golden master** (`player-master.json` +
  `sources/*.json`): ESPN roster spine (2026 + headshots) + official-site overlay (HS/hometown) +
  CFBD (2025 production/usage/ppa + recruiting) + OurLads depth, reconciled by
  `scripts/collect/reconcile/` (field-level golden merge with provenance/confidence + conflict flags).
- **The other 31 teams** — single-source CFBD static seed (`roster/recruiting/production` 3-file shape).

In-app: `loadTeamData → buildPlayerPipeline (join by playerId) → mapPipelineToUI → React`. Blended
OVR = 0.45 recruiting + 0.45 production + 0.10 class, position-group-normalized, honest **NR (null)**
for no-data players. Per-team JSON is collected offline by `scripts/collect*` and ships as lazy chunks.

## Repo layout

| Path | What |
|---|---|
| `src/` | App (TSX) — components, data layer, pipeline, rating |
| `src/data/collected/<team>/` | Per-team JSON (pilots: golden master + sources; others: 3-file seed) |
| `src/assets/logos/` | 34 team logos |
| `scripts/collect*` | TS data collectors (pilots-only guard, fail-loud) + `verify-screenshot.sh` + `guard-no-npm.sh` |
| `docs/` | [FINALIZATION_BLUEPRINT.md](docs/FINALIZATION_BLUEPRINT.md) (forward design) + `archive/` (pre-rebuild PRDs) |
| `_recovered/` | **Gitignored.** Local read-only staging of the recovered build |
| `_recovery/` | Recovery reconnaissance report |
| `PLAN.md` | Execution ledger (F0–F8 finalization) — start here |
| `RESTORATION.md` | Recovery history |

## Deployment

GitHub Pages (`VITE_BASE=/Roster_Builder/`) and Netlify (root) from the same pnpm build,
publishing from `main`. Public repo **mibarnes/Roster_Builder** — confirm-before-push doctrine.
