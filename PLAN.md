# PLAN.md — Roster_Builder

> **Design reference:** [docs/FINALIZATION_BLUEPRINT.md](docs/FINALIZATION_BLUEPRINT.md) (Fable 5,
> 2026-07-03) — the four-track audit + full build-out design. This PLAN.md is the **execution
> ledger** against that blueprint. The blueprint carries file:line anchors from the July-2026
> audit; **re-verify anchors before editing** (code moves — e.g. `buildPlayerPipeline.ts` lives
> under `pipeline/`, `positions.ts` does not yet exist).

## Current state (2026-07-04)

**The app is live and hardened** at https://mibarnes.github.io/Roster_Builder/ (publishes from
`main`). The M1–M6 rebuild + Round-2 enrichment + golden-record reconciliation are complete (see
*Completed work* below). **494 tests; tsc strict clean.**

> **Deepening arc + hardening DONE (2026-07-04), pushed live:** D1+D1b (master is the ONLY data
> path; 270 legacy files retired) · F4 (league-calibrated ratings + `_baselines`/`_identity`/`_league`
> offline artifacts) · F6 (League view `#/league` + Team HQ `#/team/:id/hq`) · F5 (as-of framing +
> vintage snapshots + scheduled-collection workflow). Cross-team OVR is honest; the 54-team breadth
> is a real intelligence tool. **F0–F6 + D1 are LIVE** (F5's post-D1b changes are committed; push at
> will). **Remaining (all quota-gated):** finish Big 12 (13 teams); P7 origin-production; F5
> change-feed + Roster Moves ticker (need ≥2 snapshots); U6/U9/U10 polish; F7/F8.

We are executing the **F0–F8 finalization plan** — evolving the working demo into a polished,
zero-stub CFB intelligence tool. **Decisions locked 2026-07-04:** (1) full F0–F8 is the committed
plan-of-record; (2) the **golden expansion (F3) is the spine** — cross-team intelligence
(rating v2, League view, portal flow) depends on it; (3) scope grew from the original 33 (ACC+SEC+ND)
to the **full Power Four (67)** — Big Ten + Big 12 added 2026-07-04.

**Progress:** F0 (hygiene) ✅ · F1 (collector industrialization) ✅ · F2 (routing/UX) ✅ —
**F0–F2 PUSHED LIVE 2026-07-04** (deploy verified; live bundle serves the F2 hash-router). F3
collection: **P5 (registry backfill) ✅ · P6 (engine framework + sidearm-json) ✅ · original 33
teams ALL GOLDEN ✅** · **Power-Four expansion → 54 of 67 golden** (all ACC+SEC+ND + all 18 Big Ten +
Utah/Arizona State/Texas Tech). Every collected team ships a golden `player-master.json` (100%
spine→master coverage); ~9 waves ran clean until the **CFBD monthly call quota was exhausted**
(`429 "Monthly call quota exceeded."`) mid-Big-12-Wave-1. **13 Big 12 teams remain** (BYU, Baylor,
TCU, Oklahoma State, Kansas, Iowa State, Cincinnati, Houston, Colorado, Kansas State, Arizona, UCF,
West Virginia) — fully sourced, rows preserved in [docs/PENDING_TEAMS.md](docs/PENDING_TEAMS.md);
**re-add + collect when the CFBD quota resets (next month) or the plan is upgraded.** Registry was
trimmed to 54 (== teams with data) so app + tests stay green. 485 tests; tsc strict clean. **All F3
collection committed local-only.** **Next: D1 — app-side path unification** (legacy 3-file path is
dead for every team; delete it + `tier:'gold'` / retire `isPilot`), or finish Big 12 on quota reset.

> **P6 anchor-drift finding (2026-07-04):** the blueprint assumed `sidearm-json` was a distinct
> `/api/roster`-endpoint CMS. Empirical probe of all 31 non-pilot official sites showed the reality:
> the dominant engine is the **same `__NUXT_DATA__` island as Florida** — 15 schools use the
> camelCase variant (existing `nuxt-sidearm` parser already handles them), 8 use a **snake_case**
> variant of the *same* island (`first_name`/`high_school`/… — THIS is "sidearm-json", now
> implemented as `parseSidearmJsonRoster`), 1 is wmt-presto (Notre Dame), 7 degrade (Arkansas/Cal/
> GT/Kentucky/LSU/SMU/South Carolina — within the blueprint's 5–8 tolerance). Engine detection is by
> page content, not the registry hint (a CMS swap still resolves); the `officialEngine` hint drives
> preflight + telemetry only.

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

### F1 — Collector industrialization + canonical positions  ·  status: DONE (2026-07-04, one item deferred)
Correctness + makes every future refresh cheap/safe. (Blueprint 5.1, P1–P4, P9–P10, + D6 pulled forward, + S5 re-routed from F0.)
- [x] **Fetch substrate** `scripts/collect/net.ts` ✅ — `fetchWithPolicy(url,{host,ttlMs})`: retry/backoff/429-aware + Retry-After (P1), per-host min-interval rate limiter (P2), on-disk cache (`scripts/.cache`, gitignored) + conditional GET, revalidate-by-default so manual runs stay fresh; opt-in `ttlMs` for scheduled F5 (P4). Migrated cfbd/espn/ourlads/247/official; injectable seams; 7 net tests. *(on3's naked fetch remains — dies with S1.)*
- [x] **Atomic per-team writes** (P3) ✅ — stage all outputs in `<team>.staging`, `commitStaging()` rename-in only on full success, `finally` cleanup. Fixes the layer-1/master ordering gap; failure leaves teamDir last-good.
- [x] **Run telemetry artifact** `src/data/collected/_runReport.json` ✅ — run-level + net stats (`getNetStats`) + per-team coverage + P9-lite floor warnings. First canonical 2-team report committed (`1a36b7e`).
- [x] **D6 — one canonical `src/data/positions.ts`** ✅ — allowlist + PositionSchema/Position + ST alias/safePosition + POSITION_CLEANING_MAP/canonicalizePositionGroup + slot orders/aliases/overrides + group taxonomy (incl. new `ST_GROUPS` ready for U6/F6), unit-tested. All 6 scattered/duplicated sites repointed (app + collector); dead `normalize/positionMapping.ts` deleted. *(Note: `ourlads.ts` keeps its source-specific `OURLADS_POS_TO_BROAD` — parser-domain, intentionally not centralized.)*
- [x] **Dead-path cleanup (partial):** ✅ **S3** deleted `jerseyMatch`; ✅ **S4** deleted `matchesRosterName` (⚠ anchor drift: the blueprint's other S4 targets — `id247`/`fetchRecruitingNational`/`fetchPortalYear`/`reconcile` — are all LIVE); ✅ **S5** excised the dead ratings-join branch (removed source lookup/resolve + `schema/ratings.ts` + `DatasetBySource.ratings` while preserving the live derived `ratings.overall`). **S2** (stars-conflict tally) is inert-vs-On3 and dies with S1 — folded into the S1 deferral.
- **Gate:** ✅ **CLOSED (2026-07-04):** full pilot re-collect (FL + MIA) through the hardened collector — substrate 174 requests / 0 retries, atomic writes clean, canonical run report 0 warnings, master position distributions byte-identical (D6 holds); numbers track baseline; 272 tests + build green. Data + report committed (`1a36b7e`).

> **Deferred — S1 (On3 removal) + naked-fetch guard** *(dated 2026-07-04)*: fully removing the always-degraded On3 source is a **schema-boundary + 34-data-file + multi-test** change (threads through `schema/on3.ts` + `playerMaster.ts` enums/`on3Degraded`, 8 collector files, `masterToDataset`, 4 test files, and every `sources/on3.json`). It's inert at runtime (contributes nothing) and pairs naturally with **F3's D4/D5 schema cleanup** — deferred to that focused pass rather than started mid-slice. The naked-`fetch` grep gate waits with it (on3.ts holds the last naked fetch; all keepers are on the substrate). S2 dies with it.

### F2 — Routing + UX hardening  ·  status: DONE (2026-07-04)
Pure frontend, no quota. (Blueprint 3.3: U1–U5, U7, U11.) Each slice pixel-verified.
- [x] **U1** ✅ Dependency-free hash router (`src/router.ts`): `#/team/:id/:tab`, `#/compare/:a/:b`, `#/player/:teamId/:pid`. App is route-driven; comparison + player modal are shareable routes with back/forward; added stable `playerId` to UIPlayer. router.test.ts.
- [x] **U2** ✅ Dropped the `overflow-hidden` viewport lock (page scrolls; below-fold reachable); formation "field" is content-width in an `overflow-x-auto` container (centered desktop, horizontal-scroll mobile — metaphor preserved); PlayerCard type floor 6/7px→8px. Pixel-verified usable at 375px, desktop unchanged.
- [x] **U3** ✅ Comparison roster rows → in-place `PlayerModal` (both datasets loaded → local modal, not a route).
- [x] **U4** ✅ `usePersistentState` (localStorage): sticky ratings filters + resume last team/tab on empty-hash boot (URL wins). Hook tests.
- [x] **U5** ✅ `prefers-reduced-motion` guard; Ratings rows + radar spokes keyboard-accessible (role=button/tabIndex/keys/aria); inactive-tab contrast fix.
- [x] **U7** ✅ (partial) Within-team position rank chip in the modal ("QB1", title "#N of M by OVR"), computed in the pipeline. *Fuller reorder (phase-grouped stats + per-game sparklines) deferred — current order is coherent; no duplicate OVR tile exists (anchor was stale).*
- [x] **U11** ✅ Labeled dashed empty formation slots (S17) + Ratings "no players match" state.
- **Gate:** ✅ mobile usable at 375px (pixel-verified: offense field + ratings, no clip); tsc + 285 tests + build green across every slice. *(Lighthouse ≥90 a11y not run headless here — a11y items done to standard; formal Lighthouse deferred to CI perf-budget, 7.8.)*

> **Deferred from F2** *(dated 2026-07-04)*: U7 modal section-reorder + per-game sparklines (polish; current layout coherent). U6 special teams / U9 formations / U10 metric selector belong to **F6**; U8 team-theming-v2 and U12 search to **F6/F7** — never in F2 scope.

### ── DECISION GATE (locked: PROCEED) — 33-team golden expansion ──

### F3 — Golden expansion waves  ·  status: COLLECTION COMPLETE (all 33 golden; D1/D4/D5/S8 remain)
The tier collapse — collapses the two-path debt. (Blueprint 5.2, P5–P8, D1/D4/D5, S8–S10.)
- [x] **P5 Registry backfill** ✅ (2026-07-04) — `espnId` for all 33 (ESPN team API) + verified `officialRosterUrl` + `officialEngine` hint (empirically probed across all 30 resolving sites). Preflight validator (`scripts/collect/preflight.ts`): espnId/cfbdQuery/ourlads = errors (load-bearing); official URL/engine = degrade-warnings. Wired into `collect.ts` (fails fast, no network) + a `--teams=` wave selector.
- [x] **P6 Official-site engine framework** ✅ (2026-07-04) — added `sidearm-json` (snake_case Sidearm island; `parseSidearmJsonRoster`) routed from `parseOfficialHtml`; kept `nuxt-sidearm`/`wmt-presto`; unknown → degrade+telemetry, never throws. Engine map: **15 nuxt-sidearm / 8 sidearm-json / 1 wmt-presto / 7 unknown-degrade**. (See the P6 anchor-drift note above — "sidearm-json" turned out to be a snake_case variant of the *same* Nuxt island, not a separate endpoint CMS.)
- [x] **Wave rollout — ALL 33 GOLDEN** ✅ (2026-07-04) — 5 waves, all clean (0 failed / 0 retries / no rate-limit; ~950 CFBD requests total):
  - Wave 1: Clemson, Auburn, Texas A&M, Georgia, Tennessee · Wave 2: Oklahoma, Ole Miss, Texas, Missouri, Vanderbilt, Miss State · Wave 3: UNC, NC State, Duke, Wake, Louisville, Pitt · Wave 4: FSU, Virginia, VT, Syracuse, BC, Stanford, Notre Dame · Wave 5: Arkansas, Kentucky, LSU, South Carolina, Cal, Georgia Tech, SMU.
  - Official overlay: 24 full (16 nuxt-sidearm + 8 sidearm-json); 9 degraded to hometown+recruiting (Notre Dame presto + the 7 non-Sidearm sites — HS field only, non-load-bearing). Every team 100% spine→master. Pixel-verified golden (incl. a degraded team, LSU). **Committed local-only.**
  - Note: `loadTeamData` auto-serves any team with `player-master.json`, so collecting == flipping to gold (masterPipeline test derives the golden set from disk — now all 33). A formal registry `tier` field + `isPilot` retirement is folded into **D1** below.
- [ ] **D1 App-side unification** — delete the legacy 3-file path the milestone the last wave lands; `masterToDataset` becomes the only adapter. The `isTransfer`-always-false legacy bug (S10) dies with the path. Introduce `tier:'gold'` + retire `isPilot` here.
- [ ] **D4/D5 cleanup** — remove mock mode + `VITE_DATA_MODE` + legacy `STAT_ABBREVIATIONS` (S7); type the join engine against `z.infer`, drop runtime `.passthrough()`. **+ S1 On3 removal + naked-fetch guard land here** (deferred from F1).
- [ ] **S8 Signee source** — CFBD recruiting-commits synthetic spine → signed HS players get real records flagged `notYetEnrolled` instead of `ourlads-stub-*`.
- **Gate:** all 33 masters validate; legacy path deleted; 259+ tests green.

### F4 — Identity graph + rating v2  ·  status: DONE (2026-07-04, P7 deferred to quota reset)
Makes cross-team comparison honest — the payoff of the 54-team data. (Blueprint 5.4, 6.1, D2/D7.)
- [x] **D7 Rating v2 — league-calibrated** ✅ — `ratingConfig.ts` (documented single source: weight sets, projection penalty, z-score constants, `LeagueBaselines`); `computeTeamRatings(players, leagueBaselines?)` z-scores OVR vs the LEAGUE (`overall.ts` normContext sites), team-relative stays the fallback; golden/monotonicity/calibration tests. Added `RatingConfidence` (high/med/low from completeness), surfaced to `UIPlayer`. **Pixel-verified honest:** league avg-starter-OVR ranks Georgia/Notre Dame/LSU top, Rutgers/Syracuse bottom; Georgia 5-stars (85) now outrank Rutgers 4-stars (75) cross-team.
- [x] **Offline artifacts** ✅ — `scripts/buildLeagueArtifacts.ts` (`pnpm build:artifacts`, NO CFBD) reads all 54 masters via the exact app pipeline → `_baselines.json` (per-group mean/sd/n) + `_identity.json` (1200 portal edges, 563 in-league) + `_league.json` (per-team league-honest summary). App statically imports `_baselines.json`.
- [ ] **P7 Origin-production carry** — `priorProduction` from origin-team 2025 `/games/players`. **Deferred → CFBD quota reset** (needs the API). `newIn2026` fix rides with it.
- [~] **D2** `transferOrigin` → `{teamId?, name}` deep-links — partially in F6 (portal ledger/flow deep-link to in-registry origin teams); the per-player transfer-chip origin card is deferred polish.
- **Gate:** ✅ comparison honest cross-team; 494 tests; tsc clean.

### D1 — App-side path unification  ·  status: DONE (D1 + D1b) (2026-07-04)
- [x] ✅ **D1** — Master-only `loadTeamData` (legacy 3-file branch + globs + helper deleted); mock mode + `VITE_DATA_MODE` + `DataMode` plumbing removed (D4/S7 app-side); S10 `isTransfer`-false bug gone with the legacy path.
- [x] ✅ **D1b** — collector no longer writes the legacy 3+2 files (`recordHistory` tracks the master); **removed the 270 committed legacy files** (54×5) §17-safely (master path live+verified; git history = backup); `seed.test` consolidated onto master+sources. **Master is the only data path.** Kept `isPilot` (collector target concept; a uniform `tier:'gold'` would be vestigial now).

### F5 — Freshness loop  ·  status: PARTIAL (as-of + snapshots + workflow done; change-feed/ticker deferred) (2026-07-04)
"Live feel" without a server. (Blueprint 5.3, 7.2.)
- [x] **As-of framing** ✅ — `vintage` {collectedAt, rosterSeason, productionSeason} threaded master→pipeline→UIDataset→header; header reads "<roster> ROSTER · <stats> STATS · as of <date>" + a **DATA-AGING chip** >45d (dormant while fresh). **Kills S13** (the headshot heuristic).
- [x] **Vintage snapshots** ✅ — collector preserves the outgoing `player-master.json` → `collected/<team>/snapshots/<date>.json` (keep last 6) before overwrite; gitignored (local diffable-history cache). Effective on next collection.
- [x] **Scheduled `collect.yml`** ✅ — `.github/workflows/collect.yml`: monthly cron + on-demand; rebuilds artifacts, gates on typecheck/test/build, opens a **data PR** (never direct-push). **Inert until the `CFBD_API_KEY` repo secret + quota.**
- [ ] **Change feed** `collected/_changes.json` + **7.2 Roster Moves ticker** — **deferred: need ≥2 snapshots** (chicken-egg; unblocks after the next collection).
- **Gate:** one automated refresh PR merged end-to-end — pending CFBD quota reset.

### F6 — Intelligence surfaces  ·  status: DONE (core; U6/U9/U10 deferred) (2026-07-04)
Display → scouting tool. (Blueprint 6.2/6.3.)
- [x] **Team HQ** (`#/team/:id/hq`) ✅ — strength-vs-league bars (group avg OVR vs league mean 73), returning-production gauges, roster-construction class×position grid, incoming/outgoing portal ledger (`_identity.json`). New `hq` team tab.
- [x] **League view** (`#/league`) ✅ — conference-filterable, sortable board of all 54 teams (league-calibrated OVR + OFF/DEF/returning/portal-net) + a transfer-portal **flow panel** (net gainers/losers + top in-league moves), from the single small `_league.json` + `_identity.json`. "League" nav button. *(Design note: the portal "Sankey" is a ranked net-flow panel — a 54-node node-link diagram is unreadable; this is clearer.)*
- [ ] **U6 Special teams / U9 formations / U10 metric selector** — deferred polish (not needed for the League/HQ payoff). Recruiting-class trajectory (`classHistory.json`) also deferred.
- **Gate:** ✅ both routes live + pixel-verified; 494 tests; tsc clean. (CI data-QA gate for artifacts → future.)

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
| S1 | On3 source permanently degraded | **Deferred → F3/D4-D5** (schema + 34-file + tests; dated 2026-07-04) |
| S2 | Voided stars-conflict tally | Deferred with S1 (inert vs On3; dies on On3 removal) |
| S3 | `jerseyMatch` defined-then-voided | ✅ **F1 done (2026-07-04)** — deleted |
| S4 | Unused exports | ✅ **F1 done (2026-07-04)** — `matchesRosterName` deleted (rest were live) |
| S5 | Dead ratings-join branch + `schema/ratings.ts` | ✅ **F1 done (2026-07-04)** — excised, `ratings.overall` preserved |
| S6 | Dead `normalize/depthChart.ts` | ✅ **F0 done (2026-07-04)** |
| S7 | Mock mode + `VITE_DATA_MODE` (+ legacy `STAT_ABBREVIATIONS` kept — live in PlayerModal) | ✅ **D1 done (2026-07-04)** — mock/VITE_DATA_MODE removed |
| S8 | `ourlads-stub-*` placeholder players | Deferred (signee source; CFBD quota) |
| S9 | Legacy 31-team 3-file tier | ✅ **D1+D1b done (2026-07-04)** — path deleted; 270 files retired |
| S10 | Legacy `isTransfer` always-false bug | ✅ **D1 done (2026-07-04)** — died with the legacy path |
| S11 | Unwired comparison→modal drill-down | ✅ **F2/U3 done (2026-07-04)** |
| S12 | Invisible special-teams data | Deferred → U6 (F6 polish) |
| S13 | Header subtitle headshot-heuristic | ✅ **F5 done (2026-07-04)** — provenance-keyed as-of framing |
| S14 | Dead pilot legacy chunks in `dist/` | F3 (D9) |
| S15 | `npm run build` in netlify.toml | **F0 (immediate)** |
| S16 | Stale README | **F0 (immediate)** |
| S17 | Empty-slot blank formation columns | ✅ **F2/U11 done (2026-07-04)** — labeled dashed placeholder |
| S18 | `_recovered/` staging dir | Delete only after 33-team golden supersedes every recovered asset — **explicit user sign-off** (irreplaceable-data doctrine). Keep `_recovery/RECOVERY_REPORT.md`. |

---

## Completed work (history — condensed)

- **D1b + F5 (2026-07-04)** — **D1b:** collector stopped writing the legacy 3+2 files; **270 committed
  legacy files retired** §17-safely (master path live+verified, git history = backup); seed.test onto
  master+sources. Master is now the ONLY data path. **F5:** as-of framing (provenance-driven header +
  aging chip, kills S13) + vintage snapshots (collector, gitignored) + scheduled `collect.yml`
  (monthly/on-demand, opens a data PR, inert until CFBD secret+quota). 386 tests; tsc clean; all local.
- **Deepening arc D1 → F4 → F6 (2026-07-04)** — turned the app into a cross-team intelligence tool.
  **D1:** master-only data path (deleted the dead legacy 3-file loader + mock mode; S10 bug gone).
  **F4:** league-calibrated OVR (`computeTeamRatings(players, leagueBaselines?)` z-scores vs the
  league, not the team — pixel-verified honest: Georgia 5-stars now outrank Rutgers 4-stars
  cross-team) + `ratingConfig.ts` + `RatingConfidence` + an offline `buildLeagueArtifacts.ts`
  (`pnpm build:artifacts`, no CFBD) emitting `_baselines`/`_identity`/`_league.json`. **F6:** League
  view (`#/league`, sortable 54-team board + portal flow) + Team HQ (`#/team/:id/hq`, strength-vs-
  league + roster construction + portal ledger + returning gauges). 494 tests; tsc clean; all local.

- **Power-Four expansion → 54/67 golden; CFBD quota hit (2026-07-04)** — expanded the registry from
  33 (ACC+SEC+ND) to 67 by adding Big Ten (18) + Big 12 (16), each row sourced empirically (espnId via
  ESPN API, OurLads slug+id via the OurLads team index, official URL + engine probed: 23 nuxt-sidearm
  / 9 sidearm-json / 2 unknown). Collected all 18 Big Ten + 3 Big 12 (Utah/Arizona State/Texas Tech)
  golden across 4 clean waves (0 retries), then **CFBD returned `429 Monthly call quota exceeded`** on
  BYU/Baylor/TCU — atomic writes left no partial data. Trimmed the 13 uncollected Big 12 teams to
  [docs/PENDING_TEAMS.md](docs/PENDING_TEAMS.md) (ready-to-paste rows) so registry == data. **54 teams
  golden.** 485 tests; tsc strict clean.

- **F0–F2 pushed live + F3 collection complete — all 33 golden (2026-07-04)** — pushed the 22 local
  F0–F2 commits to `main` (Pages deploy verified). Backfilled the registry for all 33 (espnId +
  officialRosterUrl + officialEngine) with a preflight validator + `--teams=` wave selector; added
  the `sidearm-json` official-site engine (unlocks 8 snake_case-Sidearm schools). Ran **F3 Waves 1–5
  → every team golden**: 5 clean runs (0 failed / 0 retries / no CFBD rate-limit; ~950 requests),
  100% spine→master coverage each; 24 full official overlays (16 nuxt-sidearm + 8 sidearm-json), 9
  degraded to hometown+recruiting (Notre Dame presto + 7 non-Sidearm — HS-only gap, non-load-bearing).
  Pixel-verified golden incl. a degraded team (LSU). masterPipeline test generalized to a disk-derived
  golden set (now all 33). **359 tests; tsc strict clean.** All F3 data committed local-only.

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
- **2026-07-04** On3 source removal (S1 + S2 + naked-fetch guard) — deferred to F3's D4/D5 schema-cleanup pass (schema-boundary + 34 data files + tests; inert at runtime). See F1 note.
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
