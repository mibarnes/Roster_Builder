# RESTORATION.md — Roster_Builder hardened rebuild

**Start here.** This is the self-contained execution guide to rebuild the CFB Roster Portal as a
hardened TypeScript app. Phase 0 (scaffold) is done; this doc drives Phases 1–7. Background:
[_recovery/RECOVERY_REPORT.md](_recovery/RECOVERY_REPORT.md). Status: [PLAN.md](PLAN.md).

> **Execution sequencing:** the Phases 1–7 below are the *tactical* reference (port maps, schema
> specs, guardrails). The **authoritative build order is the milestone plan (M1–M6)** —
> contracts-first, then a Florida+Miami vertical slice with early collection + continuous deploy,
> then broaden, then cutover. Phase↔milestone map: P1→M1, P2→M2, P5(collector)→M3,
> P3+P4(pilots)→M4, P4(breadth)→M5, P6+P7→M6.

---

## Decisions (locked with user, 2026-06-12)
1. **Full TypeScript** (strict) + **zod** runtime validation at data boundaries.
2. **Scope = ACC + SEC (34 teams)**, built on **one canonical team registry** (no duplicated lists).
3. **Seed = recovered REAL captures only** (32 teams). Miami + Alabama recovered data are **mock
   placeholders** (`internal-roster-v1`, 44 players) → not seeded as real.
4. **Pilot teams = Florida Gators + Miami Hurricanes.** ALL re-collection / data-hardening targets
   only these two. **No live re-collection for the other 32** in this rebuild (deferred).
5. **Reconnect to the same public repo** `mibarnes/Roster_Builder`; hardened build replaces `main`.
6. **Keep the existing CFBD API key** as the core key (gitignored `.env`; never `VITE_`-prefixed).
7. App at **repo root**. pnpm-only. Env-driven Vite `base`.

---

## Where things are
- **Port FROM:** `_recovered/backup_frontier/` (gitignored, local) — the richer frontier copy
  (34 teams, 3 extra components). Old GitHub `main` state is also available via `git show main:<path>`.
- **Seeded already (committed):** `src/data/collected/<32 real teams>/{roster,recruiting,production}.json`
  and `src/assets/logos/*.png` (34). **Miami + Alabama are intentionally NOT in the committed seed.**
- **Scaffold in place:** all toolchain config (see PLAN.md "Recently completed"), placeholder
  `src/App.tsx` + `src/main.tsx` + `src/index.css`.
- **Original PRDs (reference):** `docs/phase-2-source-connections-prd.md`,
  `docs/phase-3-data-pipeline-prd.txt`, `docs/PRD_Phase{1..4}_Maintenance.md`.

---

## Phase 1 — Toolchain green
Goal: the placeholder app installs, type-checks, builds, runs, and tests — on pnpm.

```bash
cd ~/.AI_APPS/ROSTER_BUILDER
corepack enable
pnpm install                      # resolves lockfile (respects minimumReleaseAge 7d)
pnpm approve-builds esbuild       # clear the build-script gate (pnpm appends allowBuilds:)
corepack use pnpm@11.5.2          # hash-lock packageManager in package.json
pnpm typecheck                    # tsc --noEmit clean
pnpm dev                          # http://localhost:3000 → placeholder renders
pnpm build                        # tsc + vite build → dist/
```
Add a smoke test `src/App.test.tsx` (RTL renders the heading) → `pnpm test` green.
**Verify:** dev server renders the placeholder with Tailwind styling; `dist/` produced;
`pnpm test` passes; `bash scripts/guard-no-npm.sh .` exits 0 (no package-lock.json).
**Gotcha:** if the lockfile resolves versions <7 days old, pnpm errors — bump or add to
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

## Phase 2 — Typed contracts + team registry
Goal: encode the implicit cross-source contracts as TS types + zod, and collapse the duplicated
team tables into one registry.

### 2a. zod schemas — `src/data/schema/` (author from the PRDs + the seed JSON shapes)
- `roster.ts` — `RosterSourceSchema`: `{ sourceId, sourceType:'roster', asOf, team, season, version,
  players: Player[], depthChart:{offense,defense}, depthChartMeta }`. `Player = { playerId, name,
  number, side:'OFFENSE'|'DEFENSE', position, classYear, height, weight, eligibilityRemaining, isTransfer }`.
- `recruiting.ts` — `playerRecruitProfiles[]`: `{ playerId, stars, compositeRating(0–1), nationalRank,
  positionRank, transferPortalStars, transferRating?, fromSchool?, isTransfer?, years? }`.
- `production.ts` — `playerProduction[]`: `{ playerId, games, PAS,YDS,TD,REC,TKL,SCK,... }` (stat keys vary).
- `ratings.ts` — `playerRatings[]`: `{ playerId, overall, ... }`. **No real provider** — OVR is
  derived (recruiting composite ×100, unranked→70). Schema must allow the source to be absent.
- `pipeline.ts` — the joined `PlayerRecord` (bio + recruiting + ratings + production + dataCompleteness),
  `metrics` (per-side avg starter composite + `avgStarterOverall`), `coverage` (matched/unmatched +
  `stubCount`).
- `ui.ts` — `{ offensiveStarters, defensiveStarters, allPlayers }` UI player shape.
- Validate each seed file on import (dynamic import → `Schema.parse`). Fail loud in dev, degrade in prod.

### 2b. `src/data/teamRegistry.ts` — THE single source of truth
Replaces `teamConfig.js` (`TEAM_OPTIONS`), the collector's `TEAM_QUERY_BY_ID` /
`TEAM_247_SLUG_BY_ID` / `OURLADS_QUERY_BY_ID`, the hardcoded `TEAM_LOGOS` map, and
`ourladsTeamBannerColors.js`. One frozen array of:
```ts
interface Team {
  id: string            // 'florida-gators'
  label: string         // 'Florida Gators'
  conference: 'ACC' | 'SEC' | 'IND'
  cfbdQuery: string     // CFBD ?team= value
  slug247: string       // 247Sports slug
  ourlads: { slug: string; id: string }
  accentColor: string   // hex, from ourlads-team-banner-colors.csv
  logo: string          // new URL(`./assets/logos/${id}.png`, import.meta.url).href
  isPilot?: boolean      // florida-gators, miami-hurricanes
}
```
Source the 34 rows from `_recovered/backup_frontier/src/data/teamConfig.js` (ids, labels, ourlads
slug/id) + `ourlads-team-banner-colors.csv` (accent). Everything else derives from this — adding a
team = one row.

## Phase 3 — Data layer port (adapters → pipeline → UI)
Port `_recovered/backup_frontier/src/data/` to TS under `src/data/`. **Port map:**

| Recovered (`.js`) | New (`.ts`) | Notes |
|---|---|---|
| `loadDataset.js` | `loadDataset.ts` | **Rename modes** `connected`→`bundled` (reads per-team JSON), keep `mock`. Surface fallback as a visible warning, not silent. Drop `process.env`; use `import.meta.env.VITE_DATA_MODE`. |
| `sources/registry.js` + `sources/{roster,recruiting,ratings,production}/adapter.js` | `sources/…` | Keep adapter contract (`sourceId,sourceType,fetchRaw,mapToCanonical,validate,metadata`); add zod parse in `validate`. |
| `normalize/depthChart.js` + `positionMapping.js` | same `.ts` | Slot alias → canonical (WRX→WR1, DE1→LDE…). Port `depthChart.test.js`. |
| `pipeline/buildPlayerPipeline.js` | `pipeline/buildPlayerPipeline.ts` | The join engine (id→name→fuzzy ≥0.82 + coverage/`stubCount`). Highest bug risk — port its test + expand. |
| `pipeline/loadPlayerPipeline.js` | `.ts` | wraps loadDataset + buildPlayerPipeline. |
| `mapPipelineToUI.js` | `.ts` | slot-as-ground-truth DB override; sequential UI ids. |
| `validation/*` + `validateDataset.js` + `validatePlayerPipeline.js` | `.ts` | required-components checks; keep as `pnpm` scripts. |
| `identity/aliasRegistry.js` | `.ts` | mostly unused — port minimally or drop. |
| `collected/index.js` + `cfbdScaffoldData.js` | **DROP** | **Do not port the 266K-line monolith.** Replace with lazy per-team JSON: `loadTeamData(id)` does `import(\`./collected/${id}/roster.json\`)` etc., zod-validated. |
| `mock/*` | `mock/*.ts` | keep for `mock` mode; label clearly as synthetic. |

**Verify:** `loadTeamData('florida-gators')` returns a zod-valid dataset; `buildPlayerPipeline`
produces players + coverage; ported tests pass. No `cfbdScaffoldData` import anywhere.

## Phase 4 — UI port + frontier features
Port `_recovered/backup_frontier/src/{App.jsx,components/*.jsx,utils/*.js}` → TSX/TS under `src/`.
Replace the placeholder `src/App.tsx`. **Component port map (all → `.tsx`):**

| Existing on GitHub `main` | Frontier-only (backup) | Util |
|---|---|---|
| App, CompositeHeader, OffenseFormation, DefenseFormation, PositionGroup, PlayerCard, PlayerModal, RatingsView, Star | **TeamComparisonView** (~970 ln), **RadarChart**, **PositionDepthView** | `utils/playerHelpers.{ts}` (+ port its test) |

- Wire `App.tsx`: tabs (offense/defense/ratings), team `<select>` from `teamRegistry`, `--team-accent`
  CSS var, depth toggle (`starters`/`second-team`/`all`→PositionDepthView), `compareMode`→TeamComparisonView.
- 34 logos from `src/assets/logos/` via the registry's `logo` field.
- **Honest empty states**: teams with thin depth / no real ratings (the 31 carried teams, and any
  stub-heavy team) must render a clear "partial data" state, not blank cards. Surface mock-fallback.
- **Drop** dead `miami_roster_compare.jsx` (origin prototype, in `_recovered/` only) and the mock
  `collect-teams-scaffold` path.
**Verify:** `pnpm dev` — switch teams, toggle off/def/ratings, open a player modal, open Team
Comparison (radar + position groups render), depth "All" view works. `pnpm build` clean.

## Phase 5 — Pilot data re-collection & hardening (FLORIDA + MIAMI ONLY)
**Hard scope: only the two pilots.** Do not invoke the collector across all teams.
- Port `scripts/collect-cfbd-roster-stats.mjs` → TS. **Isolate** the OurLads/247Sports HTML
  scrapers behind a `parsers/` module with **fixtures + tests**. Add a per-team **status report**
  and **non-zero exit on failure** (current code only `console.warn`s).
- Read `CFBD_API_KEY` from `.env` (already present). Collect **miami-hurricanes** (replace the mock
  placeholder — it is NOT in the committed seed) and **florida-gators** (upgrade the seed capture) →
  gold standard: full depth chart, minimal `ourlads-stub-*`, consistent derived-OVR labeling.
- Commit the two pilots' regenerated JSON to `src/data/collected/`. Leave the other 31 untouched.
**Verify:** both pilots load with near-complete depth charts and low stub counts; collector exits
non-zero if a source fails; no network calls fire for non-pilot teams.

## Phase 6 — Testing & hardening
Vitest + RTL. Cover: `mapPipelineToUI` transform, the fuzzy name-resolver (highest risk), zod
schemas (valid + malformed), `loadDataset` cache + mock-fallback, key components (PlayerModal a11y,
RatingsView filters incl. the historic `OG`/`OT` omission bug, TeamComparison math). Carry forward
the recovered a11y (focus-trap modal, keyboard cards, ARIA tablist). Add a React error boundary.
**Verify:** meaningful coverage on `src/data/`; `pnpm test` green; `pnpm typecheck` clean.

## Phase 7 — Deploy & reconnect
- Rewrite CI `.github/workflows/deploy.yml` to **pnpm**: `corepack enable` + `actions/setup-node`
  (`node-version-file: .node-version`) + `pnpm install --frozen-lockfile` + `pnpm build`. Vendor
  `scripts/guard-no-npm.sh` as a CI step. Build Pages with `VITE_BASE=/Roster_Builder/`.
- Keep `netlify.toml` (root base). Update it + DEPLOYMENT docs off npm.
- **Before pushing (user confirmation required — public repo):** confirm `.env` untracked
  (`git ls-files | grep -c .env` → 0), key absent from `dist/` (`grep -r CFBD_API_KEY dist/` → none),
  guards pass. Then merge `rebuild/hardened-ts` → `main` and push to replace the old build.

---

## Guardrails (from AGENTS.md — don't relearn the hard way)
- **Never** commit `.env` / print the key / `VITE_`-prefix it.
- **Never** seed mock/randomized data into `src/data/collected/` — real captures only.
- **Never** hardcode `/Roster_Builder/` back into `vite.config.ts` — it's `VITE_BASE`-driven.
- **Never** invoke `npm`/`npx` — pnpm only.
- **Confirm before pushing** to the public repo; scrub secrets first.
- Don't re-collect beyond the 2 pilots without explicit user approval (rate limits + fragile scrapers).
