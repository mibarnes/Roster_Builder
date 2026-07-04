# PLAN.md — Roster_Builder

> **Design reference:** [docs/FINALIZATION_BLUEPRINT.md](docs/FINALIZATION_BLUEPRINT.md) (Fable 5,
> 2026-07-03) — the four-track audit + full build-out design. This PLAN.md is the **execution
> ledger** against that blueprint. The blueprint carries file:line anchors from the July-2026
> audit; **re-verify anchors before editing** (code moves — e.g. `buildPlayerPipeline.ts` lives
> under `pipeline/`, `positions.ts` does not yet exist).

## Current state (2026-07-04)

**The app is live and hardened** at https://mibarnes.github.io/Roster_Builder/ (publishes from
`main`). The M1–M6 rebuild + Round-2 enrichment + golden-record reconciliation are complete (see
*Completed work* below). **259 tests; tsc strict clean.**

We are now executing the **F0–F8 finalization plan** — evolving the working demo into a polished,
zero-stub CFB intelligence tool. **Decisions locked 2026-07-04:** (1) full F0–F8 is the committed
plan-of-record; (2) the **33-team golden expansion (F3) is the spine** — cross-team intelligence
(rating v2, League view, portal flow) depends on it, so we commit to it (execution still user-gated
per wave); (3) F0 executes immediately.

**Active milestone: F0 — Contract hygiene** (then F1 → F2, the no-quota-risk front).

### Definition of "final" (blueprint Part 0.3 — the six gates)
1. **One data path** — every team on the golden-record master; legacy 3-file pipeline deleted.
2. **Live-feeling freshness** — scheduled re-collection, vintage stamps in-UI, as-of framing.
3. **Zero stubs** — every S# in the register (below) resolved or *consciously removed*, never hidden.
4. **Intelligence, not display** — analytics that answer scouting questions.
5. **Product-grade UX** — routing/deep links, mobile, a11y, design-system coherence.
6. **Operable** — one-command refresh, CI data-QA gates, pixel-verify in the loop, docs.

### Governing constraints (non-negotiable, from AGENTS.md / blueprint Part 0.4)
- pnpm-only; TS strict; zod at boundaries; no `as any`.
- CFBD key never `VITE_`-prefixed / never in browser; `.env` untracked.
- Real captures only in `src/data/collected/`; mock (if any) in `src/data/mock/`, labeled.
- **Confirm-before-push** (public repo); **collection beyond pilots requires explicit approval per wave.**
- Static-hosting-first — no always-on server; "backend" work = build-time generation or scheduled GH Action.

---

## Forward plan — F0–F8 (execution ledger)

**Dependency spine:** F1 → F3 → F4 → F5/F6 (parallel) → F7 → F8. **F0 and F2 are parallel to
everything.** User-approval gates (collection breadth at F3; any push) are preserved throughout.
Every milestone ends with **green tests + pixel-verify** (`scripts/verify-screenshot.sh`).

### F0 — Contract hygiene  ·  status: DONE (2026-07-04)
Same-day, safe, reversible, no quota. Fixes standing violations + shrinks surface before refactors.
- [x] **S15** `netlify.toml`: `npm run build` → `corepack enable && pnpm install --frozen-lockfile && pnpm build` (pnpm-only contract violation — blueprint 8.1).
- [x] **S16** Rewrite stale `README.md` (was "Phase 0 scaffold… not yet ported… placeholder shell" — the app is live). Status/quick-start/data-model/repo-layout all updated to reality.
- [x] Archive the 6 pre-rebuild PRDs (`docs/PRD_*`, `docs/phase-*`) → `docs/archive/` (blueprint 8.5).
- [x] **S6** Delete `src/data/normalize/depthChart.ts` — verified 0 external refs (the only *provably-independent pure* delete). 259 tests green, tsc clean.
- **Scoping finding (anchor drift):** the blueprint's other F0 dead-code targets are **not** safe pure deletes and were re-routed to **F1**: **S5** (ratings-join) is runtime-dead but *woven into the live `ratings.overall` output* in the core `buildPlayerPipeline` join engine — core-engine surgery, overlaps D5/D7, needs full test validation; **S1** (On3) needs a merge-fill change + re-collection; **S2** (stars-conflict tally) is *un-void wiring*, a behavioral change; **S3** (`jerseyMatch`) is a wire-or-delete decision; **S4** (unused collector exports) is collector-side. All belong with F1's collector pass. *(Mock mode S7 waits for D1 in F3.)*
- **Gate:** ✅ 259 tests green; tsc strict clean.

### F1 — Collector industrialization + canonical positions  ·  status: IN PROGRESS
Correctness + makes every future refresh cheap/safe. (Blueprint 5.1, P1–P4, P9–P10, + D6 pulled forward, + S5 re-routed from F0.)
- [ ] **Fetch substrate** `scripts/collect/net.ts` — `fetchWithPolicy(url,{host,ttl,hard})`: retry/backoff/429-aware (P1), per-host token-bucket rate limit + bounded concurrency (P2), on-disk raw cache + conditional GET (P4). Migrate all sources; ban naked `fetch` via grep gate.
- [ ] **Atomic per-team writes** (P3) — stage in `collected/<team>/.staging/`, rename-in only on full success. Fixes the layer-1/master ordering gap.
- [ ] **Run telemetry artifact** `src/data/collected/_runReport.json` (per-source status, row-count floors P9, quota, duration) — UI banner + ops docs read from it.
- [x] **D6 — one canonical `src/data/positions.ts`** ✅ **(2026-07-04)** — allowlist + PositionSchema/Position + ST alias/safePosition + POSITION_CLEANING_MAP/canonicalizePositionGroup + slot orders/aliases/overrides + group taxonomy (incl. new `ST_GROUPS` ready for U6/F6), unit-tested (6 tests). All 6 scattered/duplicated sites repointed (app + collector); dead `normalize/positionMapping.ts` deleted. Behavior-preserving; tsc + 265 tests + collector runtime smoke + build all green. *(Note: `scripts/collect/parsers/ourlads.ts` keeps its source-specific `OURLADS_POS_TO_BROAD` + local allowlist — parser-domain, intentionally not centralized.)*
- [ ] **Dead-path cleanup (P10 + S5, re-routed from F0):** **S1** delete On3 source + merge fill; **S2** un-void stars-conflict tally into `perFieldConflictCounts`; **S3** wire-or-delete `jerseyMatch`; **S4** delete unused `playerId.ts`/`cfbd.ts` exports; **S5** excise the dead ratings-join branch (`ratingsLookup`/`ratingsResolved`/`schema/ratings.ts` + `dataset.ts` `ratings` field + `ratings:undefined` load sites) while **preserving the live derived `ratings.overall` output** — full test validation required (overlaps D5/D7). Re-collect pilots to confirm.
- **Gate:** re-collect pilots byte-comparable ± vintage; tests green. *(D6 slice validated without a live re-collection: behavior-preserving values + collector runtime smoke; full re-collection deferred to the fetch-substrate slice, which needs network + a data-refresh decision.)*

### F2 — Routing + UX hardening  ·  status: PLANNED (parallel to F1)
Pure frontend, no quota. (Blueprint 3.3: U1–U5, U7, U11.)
- [ ] **U1** Hash router + deep links (`#/team/:id/:tab`, `#/compare/:a/:b`, `#/player/:teamId/:pid`); comparison + modal become routes with back/forward.
- [ ] **U2** Responsive — drop `overflow-hidden` viewport lock; formation grid reflows; type floor ≥9–10px; usable at 375px.
- [ ] **U3** Wire comparison → `PlayerModal` (thread `onPlayerClick`).
- [ ] **U4** Persistence — `localStorage` last team/tab/opponent/filters; URL wins over storage.
- [ ] **U5** A11y closure — Ratings rows → `role="button"`+keys; focusable radar spokes; `prefers-reduced-motion`; contrast audit; per-team accent contrast fix.
- [ ] **U7** Modal information redesign (identity → OVR+breakdown → phase-grouped stats + per-game sparklines → usage/PPA → recruiting/transfer story → provenance; delete duplicate OVR tile; add within-team position rank).
- [ ] **U11** Skeletons + labeled empty formation slots + Ratings no-results state.
- **Gate:** Lighthouse ≥90 a11y on team view; mobile usable at 375px.

### ── DECISION GATE (locked: PROCEED) — 33-team golden expansion ──

### F3 — Golden expansion waves  ·  status: PLANNED (user-gated per wave)
The tier collapse — collapses the two-path debt. (Blueprint 5.2, P5–P8, D1/D4/D5, S8–S10.)
- [ ] **P5 Registry backfill** — `espnId` (ESPN team API, one scriptable pass) + `officialRosterUrl` + `engine` hint for all 33; preflight validator fails fast per team.
- [ ] **P6 Official-site engine framework** — registered engines; implement `sidearm-json` (dominant ACC/SEC CMS) + keep `nuxt-sidearm`/`wmt-presto`; unknown → degrade+telemetry, never throw. Accept 5–8 schools degraded (HS/hometown only).
- [ ] **Wave rollout** — collect in waves of ~5 (quota-safe via F1 limiter), verify each wave's `_runReport` + data-QA gate, **commit per wave, user-approved.** `isPilot` → `tier:'gold'` for all 33 once master validates.
- [ ] **D1 App-side unification** — delete the legacy 3-file path the milestone the last wave lands; `masterToDataset` becomes the only adapter. The `isTransfer`-always-false legacy bug (S10) dies with the path.
- [ ] **D4/D5 cleanup** — remove mock mode + `VITE_DATA_MODE` + legacy `STAT_ABBREVIATIONS` (S7); type the join engine against `z.infer`, drop runtime `.passthrough()`.
- [ ] **S8 Signee source** — CFBD recruiting-commits synthetic spine → signed HS players get real records flagged `notYetEnrolled` instead of `ourlads-stub-*`.
- **Gate:** all 33 masters validate; legacy path deleted; 259+ tests green.

### F4 — Identity graph + rating v2  ·  status: PLANNED
Makes cross-team comparison honest. (Blueprint 5.4, 6.1, P7/P8, D2/D7.)
- [ ] **Identity artifact** `collected/_identity.json` — `playerGlobalId` (`CFBD-<athleteId>`) → appearances, from portal origin/destination + national index.
- [ ] **P7 Origin-production carry** — portal-linked incoming transfers get `priorProduction:{school,season,stats,perGame}`; fix `newIn2026` to mean genuinely new.
- [ ] **D2** `transferOrigin` → `{teamId?:TeamId, name}`; eligibility → structured; `departures[]` per team.
- [ ] **D7 Rating v2 — league-calibrated** — collect-time `_baselines.json` (position-group distributions across all 33); in-app OVR z-scores vs league (not team); extract coefficients to documented `ratingConfig.ts` with golden-file + monotonicity tests; optional `ovrConfidence` from completeness.
- **Gate:** comparison honest cross-team; transfer modal shows prior stats.

### F5 — Freshness loop  ·  status: PLANNED (parallel to F6)
"Live feel" without a server. (Blueprint 5.3, 7.2.)
- [ ] **Scheduled `collect.yml`** — cron (weekly in-season / monthly off), repo-secret key, opens a **PR** with data diff + run report (never direct-push). Higher portal-feed cadence in windows.
- [ ] **Vintage snapshots** — pre-overwrite `player-master.json` → `collected/<team>/snapshots/<date>.json` (keep last N=6); upgrades `_history.json` to diffable data history.
- [ ] **Change feed** `collected/_changes.json` — per-team adds/departures/depth/rating moves vs prior snapshot.
- [ ] **As-of framing** — header keys on `provenance.*Season` + `collectedAt` (kills the headshot heuristic, S13); vintage footnotes; "data aging" chip >45d in-season.
- [ ] **7.2 Roster Moves ticker** — dismissible strip from `_changes.json` + per-team changelog page.
- **Gate:** one automated refresh PR merged end-to-end.

### F6 — Intelligence surfaces  ·  status: PLANNED (parallel to F5)
Display → scouting tool. (Blueprint 6.2/6.3, U6/U9/U10, S12.)
- [ ] **Team HQ** (`#/team/:id/hq`) — roster-construction (class×position stacked bars), portal ledger, returning-production gauges, recruiting-class trajectory (`classHistory.json`), strength-vs-conference percentile bars (`_baselines.json`).
- [ ] **League view** — sortable 33-team boards + position-group leaderboards + portal flow Sankey, from a single small `collected/_league.json` (built at collect time — never load 33 chunks client-side).
- [ ] **U6 Special teams** (S12) — `ST` group + K/P/LS/KR/PR slots + tab; include in Ratings filter.
- [ ] **U9 Formations** — data-driven templates (4-3/3-4/nickel/11-12-21) from depth-chart shape + manual switcher.
- [ ] **U10 Comparison metric selector** — OVR / recruiting / stars / class-weighted / returning; documented thresholds.
- **Gate:** new routes live; artifacts in CI data-QA gate.

### F7 — Player depth + delight  ·  status: PLANNED
(Blueprint 6.1/6.4/6.5, U12, 7.3/7.4.)
- [ ] Player pages (career timeline, prior-school production, trajectory sparkline, percentile bars) + template scouting blurb (no LLM in build) + similar-players (precomputed top-5).
- [ ] Geo recruiting-footprint SVG map (`geo.json`, dependency-free).
- [ ] Global player search omnibox (Cmd/K, `_searchIndex.json`, U12).
- [ ] Watchlist (localStorage, `playerGlobalId`-keyed, 7.4) + depth-chart PNG export (7.3).

### F8 — Final polish  ·  status: PLANNED
(Blueprint 7.5–7.8.)
- [ ] What-if scenario mode (client-only, dashed "hypothetical" treatment) · print/compact mode · onboarding coach-marks + auto-generated "About the data" · perf budget (Lighthouse ≥90 in CI).
- [ ] **Zero-stub attestation** — full S1–S18 register swept; every item closed or explicitly dated-deferred in this PLAN.

---

## Stub / skeleton elimination register (blueprint Part 9.1 — resolve or consciously remove, never hide)

| # | Stub | Resolved in |
|---|---|---|
| S1 | On3 source permanently degraded | F1 (delete + merge fill — behavioral) |
| S2 | Voided stars-conflict tally | F1 (un-void wiring — behavioral) |
| S3 | `jerseyMatch` defined-then-voided | F1 (wire-or-delete) |
| S4 | Unused `playerId.ts`/`cfbd.ts` exports | F1 (collector-side) |
| S5 | Dead ratings-join branch + `schema/ratings.ts` | F1 (core-engine excision; preserve live `ratings.overall`) |
| S6 | Dead `normalize/depthChart.ts` | ✅ **F0 done (2026-07-04)** |
| S7 | Mock mode + `VITE_DATA_MODE` + legacy `STAT_ABBREVIATIONS` | F3 (after D1) |
| S8 | `ourlads-stub-*` placeholder players | F3 (signee source) |
| S9 | Legacy 31-team 3-file tier | F3 (golden expansion + path delete) |
| S10 | Legacy `isTransfer` always-false bug | F3 (dies with S9) |
| S11 | Unwired comparison→modal drill-down | F2 (U3) |
| S12 | Invisible special-teams data | F6 (U6) |
| S13 | Header subtitle headshot-heuristic | F5 (provenance-keyed) |
| S14 | Dead pilot legacy chunks in `dist/` | F3 (D9) |
| S15 | `npm run build` in netlify.toml | **F0 (immediate)** |
| S16 | Stale README | **F0 (immediate)** |
| S17 | Empty-slot blank formation columns | F2 (U11) |
| S18 | `_recovered/` staging dir | Delete only after 33-team golden supersedes every recovered asset — **explicit user sign-off** (irreplaceable-data doctrine). Keep `_recovery/RECOVERY_REPORT.md`. |

---

## Completed work (history — condensed)

- **M1–M6 rebuild (2026-06-12)** — hardened-TS scaffold on pnpm; typed contracts + 33-team
  `teamRegistry.ts`; TS collector (pilots-only, fail-loud); data layer (lazy per-team JSON,
  no monolith) + full UI incl. frontier views (TeamComparison/Radar/PositionDepth); error
  boundary; cutover to `main`, live. Recovered from a D-drive backup holding uncommitted work
  (originals staged, gitignored, in `_recovered/`). See [RESTORATION.md](RESTORATION.md).
- **Round 2 — pilot enrichment + blended rating (2026-06-12, live)** — +5 CFBD endpoints
  (games/players, recruiting/players id-keyed, usage, ppa, returning) + hometown; blended
  OVR = 0.45 recruiting + 0.45 production + 0.10 class, position-group-normalized, **NR (null)
  for no-data players — never a fake 70** (`src/data/rating/overall.ts`). 171 tests.
- **Hardening H1–H3 (2026-06-13, live)** — surfaced returning-production banner + usage/PPA +
  per-game log; derived `isRedshirt`; class-scaled projection penalty. 181 tests.
- **Pilot deepening — golden-record reconciliation (2026-06-13, live)** — Florida + Miami rebuilt
  as multi-source golden masters (`player-master.json` + `sources/*.json`): ESPN spine (2026
  roster + headshots) + official-site overlay (HS/prev-school/hometown) + CFBD (2025
  production/usage/ppa + 247 recruiting) + OurLads depth + On3 (degraded). Reconciliation engine
  (`scripts/collect/reconcile/`): crosswalk → field-level golden merge (provenance/confidence +
  conflict flags) → coverage report; every spine player → a record. FL 130 / MIA 115. 248 tests.
- **Gap closure — CFBD-native recruiting + pixel verification (2026-06-13, live)** — recruiting
  attaches to every spine player via CFBD-native feeds (national index 2019–26 + portal), no
  scraping; stubs FL 30→16 / MIA 15→4; transfers rated FL 89% / MIA 81%. `scripts/verify-screenshot.sh`
  works (headless chromium via micromamba NSS libs) — caught + fixed 2 UI bugs jsdom missed. **259 tests.**

## Explicitly deferred (dated)
- **2026-06-13** On3/Rivals scrape + NIL (source blocked; revisit only behind F3's engine framework — blueprint 6.6).
- **2026-06-13** Injury/measurables feeds (no reliable free source; pass through only what rosters expose — blueprint 6.6).
- **2026-06-13** Not-yet-enrolled 2026 signees — machinery built; F3's S8 signee source is the real fix.
- **2026-07-04** `_recovered/` deletion (S18) — gated on 33-team golden superseding every recovered asset + explicit sign-off.
- ESLint config (add if/when desired). API-key rotation (user chose to keep the existing key).

## Decisions log
- **2026-07-04** Adopted [FINALIZATION_BLUEPRINT.md](docs/FINALIZATION_BLUEPRINT.md) as the design
  reference. Committed to **full F0–F8** as plan-of-record; **33-team golden expansion (F3) is the
  spine** (execution user-gated per wave); F0 executes immediately. Pulled the canonical positions
  module (D6) forward from F3 into F1 to de-risk downstream; F0 is a same-day hygiene milestone
  (the netlify `npm run build` line is a standing pnpm-only-contract violation).
- **2026-06-12** Full TypeScript + zod; ACC+SEC 34-team scope; seed real captures only; pilots =
  Florida + Miami; reconnect to same public repo; keep CFBD key. App at repo root. Alabama dropped
  (mock placeholder); Miami re-collected from placeholder → pilot. (See RESTORATION.md §Decisions.)
