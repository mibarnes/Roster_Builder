# FINALIZATION_BLUEPRINT.md — Roster_Builder → Top-Class CFB Intelligence Tool

> **Purpose.** One-shot sweeping review + critique + ideation (2026-07-03, Claude Fable 5).
> This document assesses the working demo as it exists on `main` and lays out every major step
> proposed to evolve it into a polished, production-final application. It is written to be
> **consumed by a later build-oriented Claude session** as raw material for an integration plan:
> bullets are concise but carry enough technical direction (file paths, data shapes, precedence
> rules) to be actionable without re-deriving context.
>
> **Structure.** Written in phases (Part 0 → Part 9) so interim progress survives session caps.
> Parts 1–4 are *assessment* (what exists, what's weak); Parts 5–8 are *the build-out plan*
> (hardening + expansion, sequenced); Part 9 is the consolidated stub-elimination register and
> suggested milestone ordering. All proposals are mutually consistent — where two ideas touch the
> same subsystem, the intended composition is stated explicitly.

---

## Part 0 — Frame: what this app is, and what "final" means

### 0.1 Identity

- **Product:** an EA-Sports-style **college football roster intelligence system** — ACC + SEC
  (33-team registry + pilots), with **Florida Gators + Miami Hurricanes** as gold-standard pilot
  teams. Core presentation model = **the team's current depth chart**; core asset = a **complete
  player catalog** blending recruiting pedigree with on-field production.
- **Stack:** React 18 + Vite 6 + Tailwind 3, TypeScript strict (`noUncheckedIndexedAccess`), zod
  at every data boundary, pnpm-only, Vitest (~259 tests), GitHub Pages + Netlify deploys.
- **Data engine:** offline TS collector (`scripts/collect*`) → per-team JSON under
  `src/data/collected/<team>/` → golden-record reconciliation (pilots) → typed pipeline →
  UI mapping. CFBD API is the load-bearing source; ESPN roster API is the 2026 spine; official
  sites, OurLads, 247/On3 are overlays.

### 0.2 The honest current state (from PLAN.md + code + data audit)

- Pilots are **deep**: multi-source golden records (`player-master.json` + `sources/*.json`),
  field-level provenance/confidence, conflict flags, headshots, usage/PPA, per-game logs,
  blended OVR with honest **NR** for no-data players, transfer chips with origin/eligibility.
- The other **31 teams are shallow static seeds** (2025-vintage `roster/recruiting/production`
   3-file shape) — no reconciliation, no headshots, no advanced stats, no vintage refresh, and a
  different (older) schema shape than the pilots' golden path.
- The app is a **client-only static site**: all data ships in the repo/bundle; there is no
  backend, no scheduled refresh, no URL routing, no persistence.
- Known deferred items (PLAN.md): not-yet-enrolled 2026 signees, On3/Rivals + NIL, 31-team
  re-collection, injuries/measurables, hometown maps, long-tail transfer name-matches.

### 0.3 Definition of "final" adopted by this blueprint

A polished final application must satisfy all six of these:

1. **One data path.** Every team flows through the golden-record master path; the legacy 3-file
   pipeline and its `bundled`/`mock` remnants are deleted. "Pilot" becomes a data-*depth* tier,
   not a separate code path.
2. **Live-feeling freshness.** Scheduled re-collection with vintage stamps surfaced in-UI, a
   transfer-aware cross-team identity graph, and explicit "as-of" framing everywhere data ages.
3. **Zero stubs.** No placeholder players (`ourlads-stub-*` in UI), no dead controls, no
   unwired schema fields, no mock remnants — every stub in Part 9's register is resolved or
   consciously *removed* (not hidden).
4. **Intelligence, not display.** Analytics that answer real scouting questions (roster
   construction, portal net-gain/loss, class trajectory, positional strength vs conference) —
   not just per-player stat echo.
5. **Product-grade UX.** URL routing/deep links, mobile-usable depth chart, design-system
   coherence (team theming done via tokens), a11y held at the recovered focus-trap/ARIA
   standard, perceived-performance polish (skeletons, prefetch).
6. **Operable.** One-command full refresh with quota-safe collection, CI data-QA gates,
   pixel-verification in the loop, and documentation that lets any future session run the whole
   machine without re-derivation.

### 0.4 Governing constraints (carried from AGENTS.md / RESTORATION.md — non-negotiable)

- pnpm-only; TS strict; zod at boundaries; no `as any` widening.
- CFBD key never `VITE_`-prefixed / never in browser code; `.env` untracked.
- **Real captures only** in `src/data/collected/` — mock data lives in `src/data/mock/`, labeled.
- Confirm-before-push (public repo); collection beyond pilots requires explicit approval —
  this blueprint *plans* the 31-team expansion but its execution remains user-gated.
- Static-hosting-first: proposals below deliberately avoid requiring a always-on server; where a
  backend-ish capability is needed it is expressed as build-time generation or a scheduled
  GitHub Action, keeping Pages/Netlify viable.

---

## Part 1 — Assessment: collection pipeline (`scripts/collect*`)

### 1.1 What exists (architecture, verified against code)

- **Entry:** `node --env-file=.env scripts/collect.ts`; pilot-gated (`--team=<id>`, non-pilot
  exits 2 with zero network; `--force-nonpilot` override). Env: `CFBD_API_KEY`, `CFBD_SEASON`
  (2025), `ROSTER_SEASON` (2026). `collectorVersion` = git SHA.
- **Run-wide closure** (`collect.ts:785-808`): CFBD national recruiting index (2019–26, ~18k rows)
  + transfer-portal feed fetched once per run via `Promise.all`, held in memory, **not persisted**.
- **Layer 1 (all teams, HARD):** 6 CFBD endpoints in parallel (roster, season stats,
  games/players, usage, PPA, returning) + 8 recruiting years + OurLads depth + 247 supplement →
  `roster/recruiting/production/advanced/context.json`, each zod-validated pre-write.
- **Layer 2 (pilots only, gated on `team.espnId` at `collect.ts:506`):** ESPN spine (HARD) +
  official-site overlay + On3 (best-effort) → `sources/*.json` → `reconcile/` (crosswalk →
  field-level golden merge with `{value,_meta}` provenance envelopes + conflict flags → coverage
  report) → `player-master.json`. Invariant `masterCount >= spineCount` asserted.
- **Vintage:** `_history.json` appends prior `collectedAt`/`collectorVersion` before overwrite —
  timestamps only; prior *data* is clobbered.

### 1.2 Critique — the load-bearing weaknesses

- **No HTTP caching at all.** No ETag/If-Modified-Since, no on-disk raw cache, no TTL. Every run
  re-fetches everything (including the ~18k-row national index). Blocks cheap scheduled refresh.
- **No rate limiting or bounded concurrency.** Unbounded `Promise.all` fan-out (6-wide CFBD per
  team + 8 recruiting years + Presto ~100 profile fetches 6-wide). Fine at 2 teams; at 33 teams
  (~460+ CFBD calls) it will trip quota/burst limits.
- **Retry is inconsistent.** OurLads and ESPN retry with backoff; the core CFBD `fetchJson`
  (`cfbd.ts:62`), 247, official-site, and On3 fetchers do **not** — one transient 429/503 on any
  HARD CFBD call fails the whole team.
- **Writes are not atomic.** Layer-1 files land on disk (`collect.ts:456-460`) *before* the master
  build (`:506`); an ESPN/master failure leaves a team with fresh layer-1 JSON and a stale/absent
  master. The "no partial garbage" banner claim is only true for pre-write failures.
- **Scraping is regex-over-HTML with pilot-specific assumptions.** OurLads keys on hardcoded
  tbody IDs (`ctl00_phContent_dcTBody*`); 247 keys on exact CSS class names (silent `[]` on
  redesign); official-site supports exactly two engines (`nuxt-sidearm` = Florida,
  `wmt-presto` = Miami). Position aliases (`JACK/WOLF/STING/HUSKY`) are scheme-specific.
- **Transfer blind spots (core to the "blended live" goal):**
  - Each team folder reconciles in isolation — **no cross-team identity join**. A transfer exists
    as two unrelated records (origin team's 2025 CFBD data, destination team's 2026 spine) with
    no shared canonical key; portal `origin/destination` is captured but never used to link.
  - **Origin-school production is dropped.** Production comes from `/games/players?team=`, so an
    incoming transfer's 2025 stat line (recorded under the origin school) never reaches the
    destination master → `production=null` and a misleading `newIn2026` label (`merge.ts:208,229`).
- **Stub/dead paths:** On3 source permanently returns `degraded:true, players:[]`
  (`on3.ts:30-47`); stars-conflict tally computed then voided (`merge.ts:278-293`); `jerseyMatch`
  defined-then-voided (`crosswalk.ts:417`); unused exports in `playerId.ts` (`id247`,
  `matchesRosterName`, `reconcile`) and `cfbd.ts`. No literal TODO markers — debt is behavioral.

### 1.3 Directed remediation (feeds Part 5 sequencing)

| # | Action | Direction |
|---|---|---|
| P1 | Retry+backoff+429-awareness on **all** fetchers | Extract one `fetchWithPolicy` (jittered exponential, honors `Retry-After`); wrap `fetchJson`, 247, official, On3. Mirror the existing ESPN/OurLads pattern. |
| P2 | Run-wide token-bucket rate limiter + bounded concurrency | Single scheduler wrapping `fetch`; config per host (CFBD ~5 rps, scrape hosts ~1 rps); replace naked `Promise.all` fan-outs with a `pLimit`-style queue. |
| P3 | Atomic per-team writes | Stage all outputs (incl. master + sources) in `collected/<team>/.staging/`, fsync, rename-in only on full success; delete staging on failure. Fixes the layer-1/master ordering gap. |
| P4 | On-disk raw-response cache with TTL + conditional GET | `scripts/.cache/<host>/<hash>.json` keyed by URL, stores body+ETag+fetchedAt; national index/portal get long TTL within a run window. Cuts quota + makes scheduled runs cheap. |
| P5 | Registry backfill: `espnId` + `officialRosterUrl` for all 33 teams + preflight validator | The single hard blocker for golden-path breadth. Preflight fails fast listing missing fields per targeted team. |
| P6 | Official-site engine framework | Registered engine list + per-team `engine` hint in the registry; implement the dominant CMS families (most ACC/SEC schools are Sidearm variants); unknown engine → telemetry counter + degrade, never throw. |
| P7 | Transfer production carry-over | For each portal-linked incoming transfer, fetch 2025 `/games/players?team=<origin>` (or athlete-scoped endpoint), attach as `priorProduction` with school+season labels; fix `newIn2026` to mean genuinely-new. |
| P8 | Cross-team identity index | Build-time artifact `src/data/collected/_identity.json`: canonical `CFBD-<athleteId>` → every (team, season, role) appearance, wired from portal origin/destination + national index. Prerequisite for Parts 5.3 and 6 (portal flow analytics, player continuity). |
| P9 | Scrape-shape smoke assertions | Row-count floors per source (OurLads tbody count, 247 class size, ESPN spine size vs history) → machine-readable warn-and-degrade telemetry in the run report, replacing all-or-nothing throws. |
| P10 | Retire or finish dead paths | Decide On3: implement a real parser or delete the source + merge fill; un-void stars-conflict tally into `perFieldConflictCounts`; delete unused `playerId.ts`/`cfbd.ts` exports and `jerseyMatch`. |

---

## Part 2 — Assessment: in-app data layer (`src/data/`)

### 2.1 What exists

- **Flow:** `App.tsx:63` → `loadPlayerPipeline` → `loadDataset` (module-level `Map` cache keyed
  `${mode}:${teamId}`) → `loadTeamData` (six `import.meta.glob` maps → lazy per-team JSON chunks;
  no monolith) → zod parse at the boundary → **fork**: pilots take
  `PlayerMasterSourceSchema` → `masterToDatasetBySource` (adapter that unwraps `{value,_meta}`
  envelopes); the 31 legacy teams take the 3-file path. Then `buildPlayerPipeline` (id → exact
  name → fuzzy ≥0.82 join; blended team rating) → `mapPipelineToUI` (flat `UIPlayer`, slot-as-
  ground-truth position override, NR → `ovr:0 / isRated:false`).
- **Bundle:** collected JSON ships as lazy chunks (~200KB legacy / ~500KB pilot fetched per team);
  `_history.json` + `sources/` are excluded from the build. But pilots' now-unused 5 legacy files
  still emit as dead chunks (~430KB × 2 in `dist/`).
- **Rating:** OVR = 0.45 recruiting + 0.45 production + 0.10 class; sub-scores z-scored within
  position group (mean→73, ±1σ→±9, clamp 50–99); recruiting-only players get a class-scaled
  projection penalty; honest `overall:null` NR.

### 2.2 Critique

- **Two divergent data paths** is the single largest structural debt: pilots (golden master,
  provenance, conflict flags, walk-on/newIn2026 flags) vs legacy 31 (older shape, no flags — the
  coverage banner's golden metrics are pilot-only). Every feature must be built twice or gated.
- **The ratings-source join is permanently dead code:** `ratings` is always `undefined`; the
  `ratingsLookup`/`attributes`/`archetype` branch (`buildPlayerPipeline.ts:285-287,401-405,478`)
  and `schema/ratings.ts` are unreachable. Same for unused `normalize/depthChart.ts`.
- **Mock-mode remnants:** `buildMockDataset`, `mock`/`mock-fallback` `DataMode`, `VITE_DATA_MODE`,
  and the legacy half of `STAT_ABBREVIATIONS` survive only for a mode nobody uses.
- **Typing is de-facto loose in the join engine:** `Record<string, unknown>` + per-field casts
  (`buildPlayerPipeline.ts:329-449`) mean a schema change is a silent `?? null`, not a compile
  error. Several schemas `.passthrough()`, defeating the fail-loud intent.
- **Position knowledge is scattered across 4+ modules** (allowlist in `schema/roster.ts:12`, a
  divergent copy in `masterToDataset.ts:29-33`, slot overrides in `mapPipelineToUI.ts:35-47`,
  alias maps in `normalize/*`).
- **Rating weaknesses:** within-team normalization only (a 73 on Vanderbilt ≠ a 73 on Georgia —
  cross-team comparison is not apples-to-apples, which quietly undermines TeamComparisonView);
  hand-tuned magic coefficients with no backtest; small-group (`n<3`) fallback is coarse; no
  multi-season decay, opponent adjustment, or confidence expression.
- **No cross-team player identity** (mirror of pipeline finding): `transferOrigin`/
  `previousSchool` are free-text strings, not `TeamId` foreign keys; eligibility is a raw string.
- **No downstream memoization:** the pipeline + UI map re-run per team switch (fine today, but
  the pipeline cache should hold the *built* dataset once analytics grow).

### 2.3 Directed remediation

| # | Action | Direction |
|---|---|---|
| D1 | **Unify all 33 teams onto the golden master path**; delete the legacy 3-file branch | Depends on P5/P6 collection breadth. End state: `loadTeamData` has one path; `masterToDataset` becomes the only adapter; legacy-only schema variants deleted. |
| D2 | Global player identity | Add `playerGlobalId` (canonical `CFBD-<athleteId>`) to `UIPlayer`; `transferOrigin` → structured `{teamId?: TeamId, name: string}`; eligibility → structured `{yearsLeft?: number, raw: string}`. Consumes the `_identity.json` artifact from P8. |
| D3 | Delete dead code | Ratings-join branch + `schema/ratings.ts` + `normalize/depthChart.ts` (~150 lines unreachable). Note: if Part 6's attribute/archetype idea is adopted, *rebuild* it typed rather than resurrecting this branch. |
| D4 | Remove mock mode + `VITE_DATA_MODE` | Collapse `DataMode` to `'bundled'`; explicit load-error policy (error surface, not synthetic fallback); delete `buildMockDataset` + legacy `STAT_ABBREVIATIONS` half. |
| D5 | Type the join engine against inferred schema types | Replace `Record<string, unknown>` casts with `z.infer` types; drop `.passthrough()` on runtime-consumed schemas; fix `percentReceivingPPA` casing at collection time and delete the dual-read hack (`buildPlayerPipeline.ts:246`). |
| D6 | One canonical position/slot module | `src/data/positions.ts`: allowlist + aliases + slot→position overrides + group taxonomy (incl. ST), unit-tested; all 4 current tables import from it. Collector's `normalize.ts` shares it (scripts may import from `src/`). |
| D7 | Rating v2 — cross-team calibrated | Two-stage: (a) national/conference baseline pass computed at collect time over all 33 masters (position-group distributions across the full league) stored as `src/data/collected/_baselines.json`; (b) in-app OVR z-scores against the league baseline, not the team. Extract all coefficients to a documented `ratingConfig.ts` with golden-file tests (known-player sanity + monotonicity). Optional `confidence: 'high'|'med'|'low'` from data completeness. |
| D8 | Cache the built pipeline per team | Move the cache boundary from raw dataset to `{pipeline, ui}` product; `useMemo` in App as a second layer. |
| D9 | Prune dead chunks | Once D1 lands, stop emitting pilots' legacy 5-file chunks; assert in CI that `dist/` contains one data chunk per team ± shared artifacts. |
| D10 | Data-QA gate in CI | A `pnpm check:data` script that zod-parses every collected file + asserts registry↔folder parity, master invariants (`masterCount>=spineCount`), and baseline freshness; wire into deploy.yml before build. |

---

## Part 3 — Assessment: UI/UX

### 3.1 What exists

- Single `App.tsx` state machine (no router): offense/defense formation tabs (+ starters/2nd/all
  depth toggle → `PositionDepthView`), `RatingsView` (sort/filter list), full-screen
  `TeamComparisonView` (2-team radar + 9 position-group table + matchup spotlight + edge bars),
  rich `PlayerModal` (focus-trapped: rating breakdown, usage/PPA splits, per-game log, recruiting
  provenance, transfer chips). Dark theme, per-team `--team-accent` CSS var, staggered entry
  animations. A11y baseline is genuinely decent (ARIA tabs, focus trap, labeled stars).

### 3.2 Critique — ranked polish gaps

- **No routing/deep links/persistence.** Team, tab, opponent, selected player all reset on
  refresh; comparison is a modal takeover with no history integration; nothing shareable.
- **Desktop-only.** `h-screen w-screen overflow-hidden` + fixed-width formation cards +
  `grid-cols-6` clip on portrait/mobile; `text-[6px]`–`text-[7px]` chips below legibility.
- **Formations are hardcoded schemes:** offense = 11-personnel 3-WR only; defense = 4-3/nickel
  only (`NB` always a base slot). No 3-4, 2-TE, 2-back. The "field" is faint stripes — no LOS,
  yard numbers, or end-zone theming.
- **Special teams invisible:** data model carries `side:'ST'` + K/P, but no ST tab, group, or
  slots anywhere; K/P appear only in the ALL ratings list.
- **Comparison drill-down broken expectation:** expanded position-group rows do **not** open
  `PlayerModal` (no `onPlayerClick` threaded); metric is fixed to avg-starter-OVR only; hard
  2-team cap; RadarChart normalization hardcoded to OVR 65–93 band.
- **Modal hierarchy:** duplicate OVR tile (`PlayerModal.tsx:222-231`); season stats + game log
  buried at the bottom; raw stat-key labels ungrouped by phase; no positional-rank context or
  trend sparkline.
- **A11y regressions vs its own standard:** `RatingsView` rows are click-only `div`s
  (`RatingsView.tsx:94-97`); radar spokes mouse-only; no `prefers-reduced-motion`; low-contrast
  gray-on-black smalls; dark-navy team accents (#0C2340 etc.) near-invisible on black.
- **Header subtitle heuristic** ("2026 ROSTER · 2025 STATS" keyed on headshot presence,
  `App.tsx:161`) will mislabel non-pilot teams — should key on explicit vintage metadata.
- **No skeletons** (content pops in); empty formation slots render blank, not labeled; Ratings
  lacks a no-results state.

### 3.3 Directed remediation

| # | Action | Direction |
|---|---|---|
| U1 | URL routing + deep links | Hash-based router (no server rewrites needed on Pages) or React Router with hash history: `#/team/:id/:tab`, `#/compare/:a/:b`, `#/player/:teamId/:playerId`. Comparison becomes a route; modal gets a shareable URL; back/forward works. |
| U2 | Responsive layout | Remove the `overflow-hidden` viewport lock; formation grid reflows (scale-down cards → horizontal-scroll field on mobile → stacked position-group list under a breakpoint); raise the type floor to 9–10px; test at 375px width. |
| U3 | Wire comparison → PlayerModal | Thread `onPlayerClick` through `TeamComparisonView` rows + matchup spotlight; open the modal with the correct team's dataset (both are loaded). |
| U4 | Persistence | `localStorage` hook for last team/tab/opponent/filters; hydrate on boot; URL params win over storage. |
| U5 | A11y closure | Ratings rows → `role="button"` + `tabIndex` + key handlers (mirror `PlayerCard`); focusable radar spokes; `prefers-reduced-motion` media guard on all keyframes/staggers; contrast-audit gray text; per-team accent contrast fix (see U8). |
| U6 | Special-teams surface | Add `ST` group to `positionGrouping.ts`; 4th tab (or panel under defense) with K/P/LS/KR/PR slots; include K/P in RatingsView position filter. Depends on D6 taxonomy. |
| U7 | Modal information redesign | Order: identity header → OVR + breakdown → season stats grouped by phase (passing/rushing/receiving/defense) + per-game log with sparklines → usage/PPA → recruiting/transfer origin story → bio → provenance footer. Delete duplicate OVR tile. Add within-team position rank ("WR3 of 12, #2 by OVR"). |
| U8 | Team theming v2 | Registry gains `secondaryColor` + precomputed `accentOnDark` (contrast-lifted variant, generated once at build); end-zone/field accents themed; consider light mode later, tokens-first now. |
| U9 | Formation/personnel variants | Data-driven formation templates (`4-3`, `3-4`, `nickel`, `11/12/21 personnel`) selected per team from depth-chart shape (OurLads slots reveal the scheme) with a manual switcher; render FB/2nd TE when present. |
| U10 | Comparison metric selector | Toggle: OVR / recruiting composite / stars / class-weighted / returning production; recomputes radar + tables via `comparisonMath` (extract magic thresholds to a documented config, show in tooltips; add numeric ring labels). |
| U11 | Skeletons + empty states | Skeleton cards during hydrate; labeled empty formation slots (position abbrev, dashed outline); "no players match filters" state in Ratings. |
| U12 | Global player search | Omnibox (Cmd/K) across all teams using a build-time compact name index (`_searchIndex.json`: name, team, pos, ovr) — lazy-loaded on first open; selecting loads the team + opens the modal. Synergizes with U1 deep links. |

---

## Part 4 — Assessment: data completeness (measured, 2026-07-03)

### 4.1 Pilots (golden masters)

| Metric | Florida | Miami |
|---|---|---|
| Players | 130 | 115 |
| Headshot | 73.8% | 85.2% |
| Height+weight | 76.2% | 67.0% |
| Hometown | 87.7% | 96.5% |
| High school | 41.5% | 57.4% |
| Recruiting rating | 66.2% | 72.2% |
| Any production | 41.5% | 38.3% |
| Usage/PPA | 14.6% | 13.9% |
| Transfers / walk-ons / stubs | 19 / 28 / 16 | 21 / 27 / 4 |
| Unrated | 44 | 33 |
| Conflict flags (class/pos) | 15 / 6 | 11 / 4 |

- Vintage: collected 2026-06-13 (`collectorVersion 2297c7f`), 2026 roster + 2025 production;
  `_history.json` holds the 06-12 prior stamps. `matchedByIdPct` ≈ 82.5/82.9; On3 degraded.
- Interpretation: the low usage/PPA % is expected (CFBD only covers meaningful snap counts);
  production ~40% is honest (walk-ons/freshmen). The *real* gaps are high school (<60%) —
  official-site-only field — and the 16 Florida OurLads stubs (2026 signees absent from ESPN).

### 4.2 Legacy 31 — a full tier below, not a gradient

- Single-source CFBD snapshot, `asOf 2026-03-07`, collector v1 — **~3 months staler and one
  schema version behind** the pilots.
- Rated (stars) 43–61%; production presence 86–100% but **season totals only** (7 stat keys, no
  per-game, no usage/PPA); **zero** headshots/hometown/HS/previous-school/provenance/depth-stub
  tracking.
- **Bug: `isTransfer` is false for all 3,840 legacy players** while their `recruiting.json` files
  do carry transfer flags (e.g. Vanderbilt 29, Syracuse 25) — the flag was never merged into the
  roster spine. Any portal analytics on legacy data are silently wrong today.
- 12.9% of legacy players have null height+weight+classYear (thin stubs).
- Positions are clean (16 canonical codes); playerIds unique everywhere.

### 4.3 Cross-team overlap (transfer-blending ground truth)

- Checked pilot transfers whose origin school is one of the 31 collected teams: **0 exact
  same-person records** in origin rosters — the 2025 legacy rosters already dropped players who
  transferred out. ~14% of pilot names collide with *some* legacy roster, essentially all
  homonyms/false positives.
- **Implication:** the cross-team identity graph (P8/D2) is not primarily a dedup problem today —
  it's a *history reconstruction* problem (attaching origin-season production and origin-team
  context to the destination record). Dedup matters only once rosters are collected at multiple
  vintages (Part 5.3), at which point the same person genuinely exists in two team snapshots.

### 4.4 Payload

- Total 7.8MB; pilots are 24% of it (masters 508K + 444K). Legacy teams 164–232K each.
  Per-team lazy chunks keep runtime cost fine; the concern is `dist/` bloat (dead pilot legacy
  chunks, D9) and master growth once 33 teams go golden (~500K × 33 ≈ 16MB repo-side — acceptable
  for git, but consider trimming `sources/*.json` from the app glob scope, which is already true,
  and pruning per-field `_meta` in a UI-facing derivative if masters fatten further).

---

# THE BUILD-OUT PLAN

## Part 5 — Data platform finalization (the spine of everything)

> Composition note: Part 5 consumes P1–P10 (Part 1.3) and D1–D10 (Part 2.3) and sequences them
> with new platform-level designs. Everything in Parts 6–7 assumes this part lands first.

### 5.1 Track A — Collector industrialization (pre-req for breadth)

1. **Fetch substrate** (P1+P2+P4 together, one refactor): `scripts/collect/net.ts` exposing
   `fetchWithPolicy(url, {host, ttl, hard})` — retry/backoff/429, per-host token bucket, on-disk
   cache with ETag. All sources migrate onto it; naked `fetch` banned by a lint/grep gate.
2. **Atomic team writes** (P3): staging dir + rename-in; run report gains
   `teamsCommitted/teamsRolledBack`.
3. **Run telemetry as an artifact**: write `src/data/collected/_runReport.json` (per-team source
   statuses, row counts vs floors (P9), quota spent, duration). The UI's coverage banner and the
   ops docs read from this instead of ad-hoc greps.
4. **Dead-path cleanup** (P10): decide On3 (recommend: delete source + merge fill now, re-add
   behind the engine framework if a stable parse ever exists); un-void stars-conflict tally;
   delete unused exports.

### 5.2 Track B — 33-team golden expansion (the tier collapse)

1. **Registry backfill** (P5): `espnId` for all 33 (ESPN team API lookup — scriptable in one
   pass), `officialRosterUrl` + `engine` hint per school. Preflight validator fails fast.
2. **Official-site engine framework** (P6): Sidearm is the dominant ACC/SEC CMS — implement
   `sidearm-json` (most schools expose a JSON island or `/api/roster` endpoint), keep
   `nuxt-sidearm` + `wmt-presto`, add `unknown → degrade+telemetry`. Accept that 5–8 schools may
   stay degraded (HS/hometown gaps only — not load-bearing).
3. **Batched rollout, user-gated per AGENTS.md**: collect in waves of ~5 teams (quota-safe with
   5.1's limiter), verify each wave's `_runReport` + data-QA gate, commit per wave. Pilot rule
   relaxes: `isPilot` becomes `tier: 'gold'` for all 33 once their master validates.
4. **App-side unification** (D1): delete the legacy path the same milestone the last wave lands.
   The `isTransfer`-always-false legacy bug (4.2) disappears with the path itself.
5. **Fix-forward for the two pilot-specific gaps**: 2026 signees (ESPN spine lag) — add a
   `signee` synthetic-spine source from CFBD recruiting commits so signed HS players get real
   records flagged `notYetEnrolled` instead of OurLads stubs; and HS coverage — official-site
   engines are the only fix, accept partial.

### 5.3 Track C — Freshness & the "live" feel (the blended-live architecture)

The app is static-hosted; "live" therefore means **scheduled recollection + explicit as-of
framing + change surfacing**, not websockets.

1. **Scheduled refresh**: GitHub Action (`collect.yml`, cron weekly in-season / monthly off) runs
   the collector with `CFBD_API_KEY` as a repo secret, opens a PR with the data diff + run report
   summary (never direct-push; preserves confirm-before-push doctrine). During portal windows
   (Dec–Jan, Apr) raise cadence for the portal feed only — it's one cheap endpoint.
2. **Vintage-aware snapshots**: before overwrite, move the previous `player-master.json` to
   `collected/<team>/snapshots/<date>.json` (git-tracked, small count — keep last N=6). This is
   what upgrades `_history.json` from timestamps to *diffable data history*, and is the input
   for the "what changed" feed and multi-vintage identity (4.3).
3. **Change feed**: collector emits `collected/_changes.json` — per-team adds/departures/
   position/depth moves/rating changes vs prior snapshot, with dates. Powers a UI "Roster Moves"
   ticker (Part 7) and makes the site *feel* alive between visits.
4. **As-of framing everywhere**: header subtitle keys on `provenance.rosterSeason/productionSeason`
   + `collectedAt` (kills the headshot heuristic, 3.2); every analytics view footnotes its data
   vintage; stale teams (>45 days in-season) get a subtle "data aging" chip — honesty as brand.

### 5.4 Track D — Transfer blending (the cross-team identity graph)

Design (composes P7+P8+D2; consistent with 4.3's finding that this is history-reconstruction):

1. **Identity artifact**: `collected/_identity.json` — `playerGlobalId` (= `CFBD-<athleteId>`,
   fallback `espn-<id>`, last-resort slug+dob hash) → appearances
   `[{teamId, season, source, role}]`, built from portal origin/destination + national recruiting
   index + (once 5.3.2 exists) successive snapshots.
2. **Origin production carry** (P7): for each portal-linked incoming transfer, fetch origin-team
   2025 `/games/players`, attach `priorProduction: {school, season, stats, perGame}` to the
   destination master. UI: the modal's stat section gains a school-labeled prior-season block;
   rating v2 (D7) may consume prior production at a documented discount factor (e.g. 0.8 —
   competition-context unknown) instead of treating transfers as production-less.
3. **Departure records**: teams also get `departures[]` (players in prior snapshot/portal with
   `origin == team`) so a roster page can show outflow, not just inflow — required for honest
   portal net-gain/loss analytics (Part 6).
4. **UI contract**: transfer chip click → mini origin card (origin team logo via registry,
   prior stat line, portal date/eligibility); if origin is an in-registry team, deep-link to it
   (U1). `transferOrigin` becomes `{teamId?: TeamId, name: string}` (D2).

---

## Part 6 — Intelligence expansion (from display to scouting tool)

> Composition note: every idea here reads from the golden masters + the Part 5 artifacts
> (`_identity.json`, `_baselines.json`, `_changes.json`, snapshots). None requires a server —
> heavy aggregation happens at collect time into small committed artifacts; the client only
> renders. Ratings v2 (D7) is the shared numeric foundation; all rankings below use it.

### 6.1 Rating v2+ (extends D7)

- **League-calibrated OVR** (D7) is the prerequisite — comparison views become honest.
- **Confidence tiering**: `ovrConfidence` from data completeness (production games, usage sample,
  recruiting presence). UI renders low-confidence OVRs with a hollow badge — keeps NR honesty
  while extending coverage.
- **Trajectory delta**: with ≥2 snapshots, per-player `ovrTrend` (rising/steady/falling) — cheap
  once 5.3.2 exists; renders as ▲▼ on cards and a "Risers" list.
- **Positional scarcity weighting** for team grades: a 90 QB is worth more than a 90 S; document
  weights in `ratingConfig.ts` (with the D7 coefficients, one config surface).

### 6.2 Team intelligence page (new view: "Team HQ")

One route per team (`#/team/:id/hq`) aggregating what currently exists only as scattered banners:

- **Roster construction chart**: scholarship distribution by class year × position group (stacked
  bars) — instantly shows "old OL, young secondary". Data already present (classYear, position).
- **Portal ledger**: incoming vs outgoing transfers with ratings (needs 5.4.3 departures) —
  net-talent-flow number per window.
- **Returning production tile-set**: context.json already captured (usage/PPA returning %) —
  currently surfaced as one banner line; expand to per-phase (pass/rush/receiving) gauges.
- **Recruiting class trajectory**: avg composite + class rank per recruit-year 2020–26 from the
  national index (already in memory at collect time — persist per-team slice
  `collected/<team>/classHistory.json`) — line chart showing program direction.
- **Strength vs conference**: per position group, team avg OVR vs league distribution
  (`_baselines.json`) as percentile bars — the "where are we weak" answer.

### 6.3 Cross-team analytics (new view: "League")

- **Conference boards**: sortable 33-team table — avg starter OVR, returning production, portal
  net, class trajectory, roster age. All computable from committed artifacts at load of a single
  small `collected/_league.json` (built at collect time; do NOT load 33 team chunks client-side).
- **Position-group leaderboards**: top-10 units league-wide (e.g. best WR rooms) + top-25 player
  boards per position with team context. Feeds from `_league.json` per-group aggregates +
  `_searchIndex.json` (U12) for player rows.
- **Portal flow map**: Sankey/chord of transfer movement among the 33 (+ "outside" bucket) per
  window, from `_identity.json`. Visually distinctive; cheap data.
- **Head-to-head upgrade** (extends U10): comparison view gains a "common opponents" strip and a
  starters-vs-starters positional matchup grid (LT vs RDE style) once formations are data-driven
  (U9).

### 6.4 Player intelligence (modal → full player page)

- **Player route** (`#/player/:teamId/:pid`, U1) with the modal's content as a page + additions:
  career timeline (recruit year → schools via identity graph → seasons), prior-school production
  (5.4.2), trajectory sparkline (6.1), percentile bars vs position (from `_baselines.json`).
- **Auto-generated scouting blurb** (build-time, optional): 2–3 sentence template-generated
  summary from structured facts ("4★ 2024 signee; started 9 games at LT as a true FR; top-15%
  pass-block usage") — template-only, no LLM dependency in the build; an LLM-polish pass can be
  a manual collector flag later.
- **Similar players**: nearest-neighbor within position on (composite, production profile, size)
  — precompute top-5 per player at collect time into the master (tiny field, big delight).

### 6.5 Geography (deferred-list item, now concrete)

- Pilot masters already carry `homeLat/homeLon`. Build-time aggregate
  `collected/<team>/geo.json`; render a dependency-free SVG US map (state-level choropleth +
  city dots) in Team HQ — "recruiting footprint". No map-tile service needed (static-host safe).
  Extend to league view: contested-state overlays between two compared teams.

### 6.6 Explicitly rejected (to keep the plan conflict-free)

- **Live game-day stats / websockets** — breaks static hosting; out of scope for "final v1".
- **NIL valuations** — source (On3) blocked; revisit only behind the engine framework.
- **Injury feeds** — no reliable free source; represent only what official rosters expose
  (status field passes through if present; no fabricated availability).
- **User accounts/watchlists server-side** — localStorage watchlist only (Part 7); no backend.

## Part 7 — Product & UX finalization

> Composition note: U1–U12 (Part 3.3) are the hardening baseline. Items here are the expansion
> layer on top; each names its dependencies. Design tokens follow the dataviz/design-system
> discipline: one accent system, WCAG-checked, `prefers-reduced-motion` respected (U5).

- **7.1 Information architecture v2** (depends U1): persistent left rail or top nav —
  *Team* (depth chart / ratings / HQ) · *League* (boards / portal map) · *Compare* · *Search*
  (U12). The depth chart remains the team landing view — it is the product's signature.
- **7.2 "Roster Moves" ticker** (depends 5.3.3): dismissible strip on Team views showing latest
  `_changes.json` entries ("WR J. Smith ↑ to first team · Jun 13"); full changelog page per team.
  This is the single highest-leverage "live feel" feature per dollar.
- **7.3 Depth chart export** (original README roadmap): render-to-PNG of the formation view
  (SVG/canvas re-render, not DOM screenshot) with team theming + vintage stamp — share-ready.
- **7.4 Watchlist**: star players (localStorage, `playerGlobalId`-keyed so it survives transfers)
  → "My Board" view with cross-team list + change highlights since last visit (diff vs stored
  snapshot date). No backend.
- **7.5 Depth-chart what-if (scenario mode)**: drag a player between slots locally (state-only,
  clearly labeled "hypothetical"); team grade + comparison recompute live. Powerful scouting toy;
  pure client state, zero data-model risk. Gate behind a toggle to protect the "honest data"
  brand — hypothetical mode gets a distinct visual treatment (dashed borders).
- **7.6 Print/compact mode** for the ratings table and HQ (media queries) — analysts print.
- **7.7 Onboarding polish**: first-visit coach marks (3 tooltips max), an "About the data"
  page auto-generated from `_runReport.json` + provenance docs — transparency as a feature.
- **7.8 Performance**: prefetch the compared/last-visited team chunk on idle; preload headshots
  for above-the-fold starters; `content-visibility:auto` on long lists; Lighthouse budget in CI
  (≥90 perf/a11y on the team view).

## Part 8 — Ops, deploy & quality machine

- **8.1 Fix `netlify.toml` now**: `command = "npm run build"` violates the pnpm-only contract —
  change to `pnpm install --frozen-lockfile && pnpm build` (or drop Netlify if unused; decide).
  *This is the one item worth doing before anything else — it's a standing rule violation.*
- **8.2 CI data-QA gate** (D10): `pnpm check:data` in deploy.yml — zod-parse all collected files,
  registry↔folder parity, master invariants, artifact freshness (`_league.json` newer than any
  master), dead-chunk assertion (D9).
- **8.3 Scheduled collection workflow** (5.3.1): separate `collect.yml` with repo-secret key,
  wave-batched, PR-based. Include the pixel-verify script as a job step (chromium already
  solved via `scripts/verify-screenshot.sh`) against a preview build — screenshots attached to
  the PR for eyeball review.
- **8.4 Test posture**: keep the 259-test suite green through refactors; add golden-file tests
  for rating v2 (D7), snapshot tests for `_changes.json` diffing, and one Playwright-style smoke
  (navigate team → modal → compare) if a browser harness is ever added; otherwise pixel-verify
  covers it.
- **8.5 Docs consolidation**: retire the six original PRDs in `docs/` to `docs/archive/`
  (they describe the pre-rebuild app; their a11y/testing asks are long since absorbed).
  `README.md` still says "Phase 0 … app not yet ported" — **stale, rewrite** to describe the
  live app. RESTORATION.md stays as history. This blueprint becomes the forward doc; PLAN.md
  tracks execution against Part 9's milestones.
- **8.6 Secrets & publishing hygiene**: unchanged doctrine (key never in bundle; confirm before
  push; scheduled workflow uses PR flow so a human approves every public data change).

## Part 9 — Stub/skeleton elimination register + milestone plan

### 9.1 The complete stub register (all known; resolve or consciously remove — never hide)

| # | Stub / skeleton | Location | Resolution (part-ref) |
|---|---|---|---|
| S1 | On3 source permanently `degraded:[]` | `scripts/collect/sources/on3.ts:30-47` | Delete source + merge fill (5.1.4); re-add only behind engine framework with a real parser |
| S2 | Voided stars-conflict tally | `scripts/collect/reconcile/merge.ts:278-293` | Un-void into `perFieldConflictCounts` (P10) |
| S3 | `jerseyMatch` defined-then-voided | `crosswalk.ts:65,417` | Either wire as a merge cross-check or delete (P10) |
| S4 | Unused exports (`id247`, `matchesRosterName`, `reconcile`, `fetchRecruitingNational`, `fetchPortalYear`) | `playerId.ts`, `cfbd.ts` | Confirm unreferenced; delete (P10) |
| S5 | Dead ratings-join branch + schema | `buildPlayerPipeline.ts:285-287,401-405,478`, `schema/ratings.ts` | Delete (D3); rating v2 replaces the concept |
| S6 | Dead `normalize/depthChart.ts` module | `src/data/normalize/depthChart.ts` | Delete; keep its alias knowledge in the canonical positions module (D6) |
| S7 | Mock mode + `VITE_DATA_MODE` + legacy `STAT_ABBREVIATIONS` half | `loadDataset.ts:24-79`, `vite-env.d.ts`, `mapPipelineToUI.ts:49-64` | Remove after D1 (D4) |
| S8 | `ourlads-stub-*` placeholder players (FL 16 / MIA 4) | pilot masters | Replace via signee synthetic-spine source (5.2.5); residual genuine unknowns stay flagged, rendered as labeled depth-only entries |
| S9 | Legacy 31-team 3-file tier (the biggest "skeleton") | `src/data/collected/*` (31 dirs) + `loadTeamData.ts:69-84` | Golden expansion + path deletion (5.2) |
| S10 | Legacy `isTransfer` always-false bug | all 31 `roster.json` | Dies with S9; interim: do not ship portal analytics until S9 lands |
| S11 | Unwired comparison→modal drill-down | `TeamComparisonView.tsx` | U3 |
| S12 | Invisible special-teams data | `positionGrouping.ts`, formations | U6 |
| S13 | Header subtitle heuristic (headshot-keyed) | `App.tsx:161` | 5.3.4 (provenance-keyed) |
| S14 | Dead pilot legacy chunks in `dist/` | build output | D9 |
| S15 | `npm run build` in netlify.toml | `netlify.toml` | 8.1 (immediate) |
| S16 | Stale README ("app not yet ported") | `README.md` | 8.5 |
| S17 | Empty-slot blank columns in formations | `OffenseFormation/DefenseFormation` | U11 |
| S18 | `_recovered/`, `_recovery/` staging dirs | repo root (gitignored/report) | Keep `_recovery/RECOVERY_REPORT.md`; archive note in README; delete `_recovered/` only after 33-team golden data supersedes every recovered asset (explicit user sign-off — irreplaceable-data doctrine) |

### 9.2 Milestone sequencing (proposed F-series; each independently shippable)

| Milestone | Contents | Gate |
|---|---|---|
| **F0 — Contract hygiene** (hours) | S15 netlify fix; S16 README rewrite; PRD archive (8.5); dead-code deletions S2–S7 where independent (D3, D4 can wait for F3) | tests green |
| **F1 — Collector industrialization** | 5.1 (fetch substrate, atomic writes, run report, dead paths); pixel-verify in CI (8.3 partial) | re-collect pilots byte-comparable ± vintage |
| **F2 — Routing + UX hardening** | U1, U2, U3, U4, U5, U7, U11 (pure frontend, parallel to F1) | Lighthouse ≥90 a11y; mobile usable at 375px |
| **F3 — Golden expansion waves** (user-gated) | 5.2 registry backfill + engines + waves; D1 path unification; D4/D5/D6 cleanup; S8 signee source | all 33 masters validate; legacy path deleted; 259+ tests green |
| **F4 — Identity + rating v2** | 5.4 identity graph + origin production; D7 league-calibrated ratings + `_baselines.json`; D2 typed identity | comparison honest cross-team; transfer modal shows prior stats |
| **F5 — Freshness loop** | 5.3 scheduled collection PRs, snapshots, `_changes.json`; 7.2 Roster Moves ticker; 5.3.4 as-of framing | one automated refresh PR merged end-to-end |
| **F6 — Intelligence surfaces** | 6.2 Team HQ; 6.3 League view + `_league.json`; U6 special teams; U9 formations; U10 metric selector | new routes live, artifacts in CI gate |
| **F7 — Player depth + delight** | 6.4 player pages + similar players + blurbs; 6.5 geo maps; U12 search; 7.4 watchlist; 7.3 export; 6.1 trajectory | — |
| **F8 — Final polish** | 7.5 what-if mode; 7.6 print; 7.7 onboarding/about-data; 7.8 perf budget; full stub-register sweep audit (every S# closed or explicitly deferred with date) | zero-stub attestation in PLAN.md |

**Dependency spine:** F1 → F3 → F4 → F5/F6 (F5 and F6 parallel) → F7 → F8. F0 and F2 are
parallel to everything. The user-approval gates (collection breadth F3, any push) are preserved
throughout.

### 9.3 What a later build session should do first

1. Read Part 0.3/0.4 (definition of final + constraints), then the milestone table (9.2).
2. Pick the target milestone; pull its referenced items (P/D/U/S numbers) — each carries
   file:line anchors from the July-2026 audit; re-verify anchors before editing (code moves).
3. Keep PLAN.md as the execution ledger; this blueprint is the design reference, not a status doc.

---

*Document complete — authored 2026-07-03 by Claude Fable 5 from a four-track parallel audit
(collector pipeline, in-app data layer, UI/UX, measured data completeness) of the live codebase.*
