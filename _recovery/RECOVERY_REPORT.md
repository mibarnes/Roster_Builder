# Roster_Builder — Recovery Reconnaissance Report
_Compiled 2026-06-12. Preserves the recon that preceded the hardened rebuild._

## Sources searched
| Source | Result |
|---|---|
| GitHub `mibarnes/Roster_Builder` (public, created 2026-02-12) | ✅ last committed state (HEAD `b257880`) |
| D: `D:\Agents_2026_Mar\recovered\.AI_PROJ\.projects\github\Roster_Builder` | ✅ **richer** — uncommitted frontier (Mar 6–7 2026) |
| `~/.recovery/` | Only AI_TOOLS infra — no roster content |
| `_Data_Shelf/`, `~/.AI_TOOLS/.backups`, memory.db, KB | No roster references |
| D: sibling `Claude_Test` + `miami_roster_compare.jsx` | Precursor / origin prototype |

> The D drive was not WSL-readable (broken drvfs mount; sudo needs a password). The backup was
> copied to `C:\Users\mibar\Documents\_rb_recover_tmp\` via robocopy (excluding node_modules/dist),
> then into this repo's `_recovered/backup_frontier/`.

## The two divergent states
- **GitHub `main`** (`b257880`): 2 teams (Miami, Alabama), 3 tabs, full deploy/CI (Netlify +
  GitHub Pages), 6 PRD docs. **No** comparison/radar/depth features.
- **D-drive backup** (`feat/multi-team-pipeline-and-ui` @ `fbacca1` + large uncommitted WIP):
  the **frontier** — 34 teams configured, **32 real team datasets**, 34 team logos, and three
  finished-but-uncommitted components (`TeamComparisonView`, `RadarChart`, `PositionDepthView`),
  plus a working `.env` with the CFBD key. **This work existed in no git history.**

Neither copy is complete alone → the rebuild merges the backup's features+data onto GitHub's
deploy infra, hardened.

## Verified data-quality matrix (the seed)
| Class | Teams | `sourceId` | Players | Carried as seed? | Re-collect? |
|---|---|---|---|---|---|
| Real CFBD captures | 31 (ACC+SEC minus Miami/Bama/Florida) | `cfbd-roster-v1` | 95–185 | ✅ static | ❌ |
| Real + **PILOT** | florida-gators | `cfbd-roster-v1` | 133 | ✅ | ✅ gold-standard |
| Mock placeholder + **PILOT** | miami-hurricanes | `internal-roster-v1` | 44 | ❌ | ✅ fresh |
| Mock placeholder (drop) | alabama-crimson-tide | `internal-roster-v1` | 44 | ❌ | ❌ |

Each real capture: `roster.json` (populated depthChart) + `recruiting.json` + `production.json`.
No real `ratings.json` (OVR is derived = recruiting composite × 100). `ourlads-stub-*` placeholder
players (OurLads depth names unmatched to CFBD) range **0–39/team**; teams with 0 stubs (Cal, Duke,
GT, Stanford, Syracuse, Virginia, Wake) have **thin depth charts** (weak OurLads scrape). Seed is
real but uneven — pilot re-collection homogenizes Florida + Miami only.

## Architecture (recovered build)
`source adapters (roster/recruiting/ratings/production) → buildPlayerPipeline (join by playerId:
id → exact-name → fuzzy ≥0.82) → mapPipelineToUI (slot-as-ground-truth for DBs) → React`.
`DATA_MODE` switch (mock vs "connected"); "connected" actually reads pre-collected JSON (no live
browser fetch) and silently falls back to mock on error. Real data collected offline by
`scripts/collect-cfbd-roster-stats.mjs` (CFBD API + 247Sports + OurLads HTML scrapes).

## Git history narrative
Built by AI agents via 13 numbered PRs (`claude/*` designed/reviewed, `codex/*` implemented):
initial portal (`0a7022e`) → depth-chart revamp → Phase A mock dataset → Phase 2 source adapters
→ Phase 3 pipeline → 4-phase maintenance cleanup (PRDs `bf451fc`) → multi-team pipeline + themed
UI (`fbacca1`, last feature commit) → deployment scramble (~12 commits) ending `b257880`.
The backup's uncommitted WIP builds on top of `fbacca1`.

## Origin prototype
`miami_roster_compare.jsx` (449 lines, single file) — the hardcoded-Miami PoC the whole app grew
from: 44 inline players, all 9 components inline, 3 tabs. Productionized into the source-partitioned
pipeline + 34-team multi-view app. Dead code in the rebuild (kept only in `_recovered/` as origin).

## Hardening fixes folded into the rebuild
npm→pnpm · env-driven Vite base (was hardcoded, and *missing* in the backup) · one team registry
(was duplicated 4–5×) · lazy per-team JSON (drop 266K-line bundled monolith) · TypeScript + zod ·
honest data modes + visible mock-fallback · test runner without `rg` dep · collector fails loud.

## Security
Recovered `.env` holds a **real CFBD API key** (was on a public-repo project + backup drive). User
chose to **keep** it as the core key. Stored gitignored in `.env` + `~/.config/ai-secrets/roster_builder/`.
Consumed only by the Node collector; un-`VITE_`-prefixed so it stays out of the client bundle.
