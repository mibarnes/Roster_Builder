# PRD Phase 1: Eliminate the Data Split

**Status:** Proposed
**Priority:** Critical
**Scope:** `src/App.jsx`, `src/data/mock/*.js`, `src/data/pipeline/`, `src/data/sources/`

---

## 1. Problem Statement

The Roster Builder application maintains two completely independent data systems that have no connection to each other. The UI (`App.jsx`) renders from 44 hardcoded inline player objects, while a 13-file data layer (`src/data/`) provides adapters, pipelines, validation, caching, and normalization that are never imported or consumed by any React component.

This means roughly half the codebase is dead code, and every future feature must decide which system to update — or worse, update both and keep them manually synchronized.

---

## 2. Issues Identified

### 2.1 — Two Parallel Data Systems (Critical)

**Location:** `src/App.jsx:3-95` vs. `src/data/` (entire directory)

`App.jsx` defines `offensiveStarters` and `defensiveStarters` as top-level constants containing 44 fully-populated player objects. The entire `src/data/` directory — including `loadDataset.js`, 4 source adapters, 2 pipeline modules, 2 validation modules, normalization logic, identity registry, and 4 mock source files — is never imported by any `.jsx` file. From the running application's perspective, `src/data/` does not exist.

**Impact:** Any investment in the data layer (pipeline improvements, new adapters, validation rules) provides zero value to the user. Any roster updates must be made in `App.jsx` by hand, bypassing all validation and normalization.

### 2.2 — Incompatible Data Models (Critical)

**Location:** `src/App.jsx:5` vs. `src/data/mock/rosterSource.js:8`

The two systems use entirely different schemas for the same players:

| Concept | App.jsx Field | Data Layer Field |
|---|---|---|
| Player ID | `id` (numeric, 1-44) | `playerId` (string, 'QB-CBECK') |
| Position | `pos` | `position` |
| Class year | `year` | `classYear` |
| Height | `ht` | `height` |
| Weight | `wt` (number) | `weight` (number) |
| Overall rating | `ovr` | Separate source: `ratings.overall` |
| Composite score | `composite` (0-100 scale) | `compositeRating` (0.0-1.0 scale) |
| Stats | `stats` (inline object) | Separate source: `production.playerProduction` |
| Stars | `stars` + `transferStars` (inline) | Separate source: `recruiting.playerRecruitProfiles` |

These schemas cannot be substituted for one another without a deliberate mapping layer.

### 2.3 — Roster Content Mismatch (Critical)

**Location:** `src/App.jsx:3-95` vs. `src/data/mock/rosterSource.js:7-28`

- `App.jsx` contains 44 players (22 offense + 22 defense), including full starter/backup pairs for every position group.
- `rosterSource.js` contains only 20 players, with no backups. Many App.jsx players (e.g., OJ Frederique Jr., Jakobe Thomas, Zechariah Poyser, Bryce Fitzgerald, Keionte Scott, and 20+ others) do not exist anywhere in the data layer.
- Depth chart structure differs: App.jsx uses formation-specific keys (`LDE`, `RDE`, `NT`, `WLB`, `MLB`, `LCB`, `RCB`, `SS`, `FS`, `NB`), while the mock data uses numbered keys (`DE1`, `DE2`, `DT1`, `DT2`, `LB1`, `LB2`, `CB1`, `S1`).

### 2.4 — Adapters Perform No-Op Round Trips (High)

**Location:** `src/data/sources/roster/adapter.js:21-53`, and same pattern in `recruiting/adapter.js`, `ratings/adapter.js`, `production/adapter.js`

Each "connected" adapter:
1. Reads directly from the mock data source
2. Renames every field to simulate an external API response format (e.g., `playerId` → `pid`, `name` → `full_name`)
3. Renames every field back to the original format in `mapToCanonical()`

There is no actual external API. The output of the full adapter pipeline is structurally identical to the mock input. This creates maintenance overhead (4 field-mapping layers per source) with zero functional benefit.

---

## 3. Recommended Approach

**Strategy: Wire App.jsx to the data pipeline (Option A)**

This approach preserves the data layer architecture while making it the single source of truth.

### Step 1 — Expand mock data to full roster

Update `src/data/mock/rosterSource.js`, `recruitingSource.js`, `ratingsSource.js`, and `productionSource.js` to include all 44 players currently hardcoded in `App.jsx`. Ensure every player has entries across all four sources.

**Files changed:**
- `src/data/mock/rosterSource.js` — expand from 20 to 44 players, add backup depth chart entries
- `src/data/mock/recruitingSource.js` — expand to 44 recruit profiles
- `src/data/mock/ratingsSource.js` — expand to 44 rating entries
- `src/data/mock/productionSource.js` — expand to 44 production entries

### Step 2 — Align depth chart keys

Standardize depth chart position keys across the mock data and the UI. Adopt formation-specific keys (`LDE`, `RDE`, `NT`, `WLB`, `MLB`, `LCB`, `RCB`, `SS`, `FS`, `NB`, `WRX`, `WRZ`, `SLOT`) in the mock data and update the normalization layer to handle them cleanly.

**Files changed:**
- `src/data/mock/rosterSource.js` — update depth chart keys
- `src/data/normalize/depthChart.js` — extend normalization to handle defensive formation slots

### Step 3 — Create a UI mapping layer

Build a thin adapter that transforms pipeline output into the shape `App.jsx` components expect. This is the bridge between the canonical data model and the UI model.

**New file:** `src/data/mapPipelineToUI.js`

Responsibilities:
- Map `playerId` (string) to `id` (numeric, positional)
- Map `compositeRating` (0-1) to `composite` (0-100)
- Map `position` → `pos`, `classYear` → `year`, `height` → `ht`, `weight` → `wt`
- Flatten `ratings.overall` → `ovr`
- Flatten `production.stats` → `stats` (with abbreviated keys like PAS, TD, YDS)
- Restructure into `offensiveStarters` and `defensiveStarters` grouped by depth chart position

### Step 4 — Refactor App.jsx to consume the pipeline

Replace the hardcoded data block (lines 3-95) with an import from the pipeline. Use `useMemo` or `useEffect` + `useState` to load data on mount.

**Files changed:**
- `src/App.jsx` — remove hardcoded data, import from pipeline, add loading state

### Step 5 — Validate with existing check scripts

Run `npm run check:data` and `npm run check:pipeline` to confirm the expanded mock data passes all validation. The pipeline validation script already checks recruiting/ratings/production coverage against roster count — expanding the mock data should make these checks pass for all 44 players.

### Step 6 — Simplify adapters (optional, post-merge)

Once the pipeline is the single source of truth, consider simplifying the adapters to remove the mock-to-fake-API-to-canonical round trip. The adapters can pass mock data through directly until real APIs are available.

---

## 4. Success Criteria

- [ ] `App.jsx` imports data from `src/data/` — zero hardcoded player objects remain
- [ ] All 44 players render correctly in Offense, Defense, and Ratings views
- [ ] `npm run check:data` and `npm run check:pipeline` pass with zero errors
- [ ] Single source of truth: updating a player's stats in mock data automatically reflects in the UI
- [ ] No data duplication between `App.jsx` and `src/data/mock/`

---

## 5. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Composite score scale change (0-1 → 0-100) breaks UI rendering | UI mapping layer handles conversion; validate progress bars still render correctly |
| Missing players in expanded mock data cause blank cards | Pipeline `coverage` report identifies unmatched IDs; validate all 44 show coverage |
| Depth chart key changes break formation layouts | Map formation positions explicitly; add unit test for position-to-formation mapping |
| Async data loading adds flash of empty content | Add skeleton/loading state; data is local mock so load is near-instant |

---

## 6. Files In Scope

| File | Action |
|---|---|
| `src/App.jsx` | Remove hardcoded data (lines 3-95), import from pipeline |
| `src/data/mock/rosterSource.js` | Expand to 44 players, update depth chart |
| `src/data/mock/recruitingSource.js` | Expand to 44 profiles |
| `src/data/mock/ratingsSource.js` | Expand to 44 ratings |
| `src/data/mock/productionSource.js` | Expand to 44 production entries |
| `src/data/normalize/depthChart.js` | Extend for defensive formation slots |
| `src/data/mapPipelineToUI.js` | **New** — pipeline-to-UI transformation |
| `src/data/pipeline/buildPlayerPipeline.js` | Minor: review side-mapping logic |
