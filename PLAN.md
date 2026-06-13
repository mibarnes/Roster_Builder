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
- **E1+E2 data-enrichment round (2026-06-12)** — wired 5 new CFBD endpoints into the collector:
  `/games/players` (real games-played count + 10-category aggregation, now PRIMARY production),
  `/recruiting/players` (athleteId-keyed → PRIMARY recruiting, CFBD-id join precedence over 247),
  `/player/usage` + `/ppa/players/season` (new `advanced.json`), `/player/returning` (new
  `context.json`), and roster hometown. New schemas `advanced.ts`/`context.ts`; tightened
  `roster`/`recruiting`/`production` (named position allowlist, 0–1 composite, `games` + flexible
  stat record, `isRedshirt`, hometown). Canonical id module `scripts/collect/playerId.ts`
  (CFBD > 247 > stub precedence). Provenance + vintage block per file; prior vintage preserved in
  `_history.json`. Both pilots re-collected; tsc + 160 tests green. (Stub reduction wired but 0 on
  pilots — the unresolved depth names are genuinely 2026 signees CFBD has no athlete record for.)
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

M6 cutover DONE — `main` is the hardened build, live.

## Round 2 — Pilot enrichment + blended rating (2026-06-12, COMPLETE, live on main)
Florida + Miami enriched + hardened + deployed:
- **Capture:** +5 CFBD endpoints (games/players, recruiting/players id-keyed via athleteId, usage,
  ppa, returning) + hometown. Recruiting ~75–78% via clean id joins; production from real game logs
  (games-played + 10-category phase-namespaced stats); usage/PPA; provenance + `_history.json` vintage.
- **Rating:** blended OVR = 0.45 recruiting + 0.45 production + 0.10 class, position-group-normalized,
  **NR** for no-data players (no more flat-70). Real spread — FL 62/73/90, MIA 58/72/90.
- **UI:** NR honest; rating breakdown + usage/PPA + hometown + per-game stats in modal; stub/fuzzy/
  no-production badges; team coverage banner. 171 tests; tsc strict clean.

## Hardening pass H1–H3 (2026-06-13, COMPLETE, live on main)
- **H1 surfaced already-captured data:** team returning-production banner (context.json), full usage
  situational splits + complete PPA (avg+total) in the modal, per-game log table (perGame).
- **H2 integrity:** derived `isRedshirt` from roster tenure (27 FL / 24 MIA; was always-false dead
  field) — re-collected pilots; rating tune — class-scaled "no playing time" penalty on g=0
  recruiting-projections so proven starters top the board (DJ Lagway / Mohamed Toure #1).
- **H3 verify:** + projection-penalty & inferRedshirt unit tests; jsdom modal render test covers the
  new sections (headless pixel-check blocked by sandbox chromium — eyeball recommended). 181 tests.

## Pilot deepening — full 2026 roster + golden-record reconciliation (2026-06-13, COMPLETE, live)
Florida + Miami rebuilt as multi-source golden records (deduped + fact-checked):
- **Sources:** ESPN roster API = 2026 current-roster **spine** (ids/bio/class/status/**headshots**;
  ESPN id == CFBD athleteId → direct join); **official sites** overlay HS/previous-school/hometown
  (FL Nuxt, MIA Presto SPA scrape); CFBD = 2025 production/usage/ppa + 247-composite recruiting;
  OurLads depth; On3/Rivals best-effort (degraded/blocked). Vintage = **2026 roster + 2025 production**.
- **Reconciliation engine** (`scripts/collect/reconcile/`): per-source id crosswalk → field-level
  **golden merge** (documented precedence + per-field provenance/confidence + **conflict/fact-check
  flags**) → coverage report. **Every spine player → a record (100%)**; walk-ons/new-2026/unrated
  flagged honestly. Storage: `player-master.json` + `sources/*.json` per team.
- **Numbers:** FL 130 / MIA 115 players; rated 68/69; **transfers rated 15/17** (247 overlay, was
  1/3); special-teams included; headshots 96/98; HS 54/66; position conflicts 6/4 (fixed full-word→code).
- **UI:** headshots, HS/previous-school/hometown, transfer/walk-on/new-2026 chips, conflict indicator,
  2025-labeled production, extended coverage banner. Pipeline consumes the golden master (31 legacy
  teams unchanged). **248 tests**; tsc strict; deployed.

### Known residual gaps (honest, documented)
- **2026 HS signing class not yet on the ESPN spine** — CFBD has the 17 FL recruits but ESPN's
  published roster doesn't carry them yet; the name-match machinery is built and will auto-rate them
  once ESPN adds them (no fabrication). The "new-2026" count is mostly OurLads depth stubs.
- **Transfers' original-school recruiting** is only as good as the 247 portal scrape (CFBD
  `/recruiting/players?team=` returns the team's own recruits only); On3/Rivals (the fuller fix) is
  blocked. Unmatched transfers stay honestly `isTransfer + unrated`.
- **On3/Rivals scrape** is blocked/degraded (non-load-bearing by design). NIL still deferred.

## Gap closure — CFBD-native recruiting + pixel verification (2026-06-13, COMPLETE, live)
- **Recruiting closed via CFBD-native feeds (no scraping):** national recruiting index
  (`/recruiting/players` 2019–26, ~23k rows, in-memory) + transfer-portal feed (`/player/portal`).
  Recruiting now attaches to **every spine player** by precedence (`recruitSource`):
  cfbd-team → cfbd-natl-id → cfbd-natl-name (cross-school HS rating + recruitedSchool/year) →
  cfbd-portal (origin/eligibility) → 247-portal → unrated. Fixed the ESPN-only spine name-index.
- **Results:** stubs FL 30→16 / MIA 15→4; transfers rated FL 89% / MIA 81%; residual unrated are
  genuinely unrated in all CFBD feeds (honest). UI shows recruiting source + transfer origin/eligibility.
- **Pixel verification finally working:** `scripts/verify-screenshot.sh` (headless chromium via the
  micromamba-resolved NSS libs). Caught + fixed two bugs jsdom/greps missed — banner "114% recruited"
  (→ 75%, recruited = star-rated) and the "2025 ROSTER" label (→ "2026 ROSTER · 2025 STATS"). 259 tests.

Deferred (later): On3/Rivals scrape + NIL (blocked); not-yet-enrolled future signees; extend to the
31 non-pilot teams; injury/measurables; hometown maps; auto-refresh the 2026 class when ESPN publishes
it; long-tail transfer name-match misses (a few notable transfers still NR — honest, not fabricated).

Live: https://mibarnes.github.io/Roster_Builder/ (publishes from `main`).

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
