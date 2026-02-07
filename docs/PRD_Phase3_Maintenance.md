# PRD Phase 3: Fix Bugs and Correctness Issues

**Status:** Proposed
**Priority:** High
**Scope:** `src/App.jsx`, `src/data/loadDataset.js`, `src/data/normalize/depthChart.js`, `src/data/pipeline/buildPlayerPipeline.js`
**Depends on:** Phase 1 (data source unified), Phase 2 (components decomposed)

---

## 1. Problem Statement

The codebase contains several latent bugs and correctness issues that either silently produce wrong behavior today or will surface as errors under specific conditions. These range from browser runtime errors waiting to happen (`process.env` in client code) to data integrity problems (positions invisible to filters, defensive side-mapping silently swallowing unexpected values) to dead code that misleads future developers.

---

## 2. Issues Identified

### 2.1 — `process.env` Reference in Browser Code (High)

**Location:** `src/data/loadDataset.js:11`

```js
const getDataMode = (mode) =>
  mode ??
  process.env.DATA_MODE ??          // <-- will throw in browser
  import.meta.env?.VITE_DATA_MODE ??
  import.meta.env?.DATA_MODE ??
  'mock';
```

`process.env` is a Node.js global that does not exist in browser environments. Vite does **not** polyfill `process.env` — it only replaces `import.meta.env.*` references at build time.

**Current behavior:** The nullish coalescing chain (`??`) evaluates left-to-right. If `mode` is `undefined`, JavaScript evaluates `process.env.DATA_MODE`. In the browser, `process` is `undefined`, so `process.env` throws `TypeError: Cannot read properties of undefined (reading 'env')`.

**Why it hasn't crashed yet:** This code path is only reached when `loadDataset()` is called. Since `App.jsx` never imports or calls anything from `src/data/`, this code never executes in the browser. Once Phase 1 wires the pipeline to the UI, this will become a runtime crash.

**Node.js context:** The validation scripts (`validateDataset.js`, `validatePlayerPipeline.js`) run in Node.js where `process.env` works correctly. This is why `npm run check:data` succeeds.

### 2.2 — Position Filter Excludes Valid Players (High)

**Location:** `src/App.jsx:310` (filter list) vs. `src/App.jsx:30,38,42` (player data)

The position filter dropdown in `RatingsView` contains:
```js
const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
                   'DE', 'DT', 'NT', 'LB', 'CB', 'SS', 'FS', 'NB'];
```

Three backup players use position codes that are **not in this list**:

| Player | Position | Backup to | Line |
|---|---|---|---|
| Samson Okunlola (#63) | `OG` | LG group | `App.jsx:30` |
| Max Buchanan (#66) | `OG` | RG group | `App.jsx:38` |
| Tommy Kinsler IV (#62) | `OT` | RT group | `App.jsx:42` |

**Impact:** When a user selects any specific position filter, these 3 players are invisible. They only appear when "ALL" is selected. There is no way to filter to see them specifically. Additionally, if a user filters by "LG" expecting to see the LG backup, Okunlola won't appear because his `pos` is `OG`, not `LG`.

### 2.3 — Depth Chart Normalization Produces Undefined Properties (Medium)

**Location:** `src/data/sources/roster/adapter.js:43-48`

```js
depth_chart: {
  offense: {
    ...mockRosterSource.depthChart.offense,
    WRX: mockRosterSource.depthChart.offense.WR1,
    WRZ: mockRosterSource.depthChart.offense.WR2,
    SLOT: mockRosterSource.depthChart.offense.WR3,
    WR1: undefined,    // explicitly set to undefined
    WR2: undefined,    // explicitly set to undefined
    WR3: undefined     // explicitly set to undefined
  },
  ...
}
```

The adapter first spreads the original depth chart (which has `WR1`, `WR2`, `WR3`), then creates `WRX`, `WRZ`, `SLOT` from those values, then sets `WR1`, `WR2`, `WR3` to `undefined`.

**Problem:** Setting a key to `undefined` is not the same as deleting it. The object now has `WR1` as an own property with value `undefined`. When this object is spread or iterated with `Object.entries()`, these `undefined` entries appear. Downstream code like `collectStarterIds` in `buildPlayerPipeline.js:16` checks `if (!playerId) continue;` which catches `undefined`, but the entries still clutter the data and can confuse debugging/logging.

The normalizer at `depthChart.js:19` checks `!normalized[canonicalSlot]` — since `undefined` is falsy, the WRX→WR1 re-mapping does work, but only by coincidence. If someone changed the cleanup to use `delete` or `null`, the behavior would change.

### 2.4 — Side-Mapping Silently Defaults to 'DEFENSE' (Medium)

**Location:** `src/data/pipeline/buildPlayerPipeline.js:129-132`

```js
const starters = collectStarterIds(datasetBySource?.roster?.depthChart).map((entry) => ({
  ...entry,
  side: entry.side === 'OFFENSE' ? 'OFFENSE' : 'DEFENSE'
}));
```

This ternary maps any value that isn't exactly `'OFFENSE'` to `'DEFENSE'`. If a future change introduces a side like `'SPECIAL_TEAMS'` or `'ST'`, or if a casing inconsistency produces `'offense'` or `'Offense'`, it would silently be categorized as defense — corrupting starter metrics without any error.

**Current exposure:** `collectStarterIds` (line 18) does `side.toUpperCase()`, so the input comes from depth chart keys `'offense'` → `'OFFENSE'` and `'defense'` → `'DEFENSE'`. This works today, but the mapping is a latent trap.

### 2.5 — `getOvrColor` Defined but Never Called (Low)

**Location:** `src/App.jsx:311`

```js
const getOvrColor = (ovr) => ovr >= 90 ? '#fbbf24' : ovr >= 85 ? '#84cc16' : ovr >= 80 ? '#22c55e' : '#14b8a6';
```

This function is defined inside `RatingsView` but never called anywhere in the component's render output. The OVR badge in each row uses a static `#1a4d2e` background (line 339) rather than this dynamic color function.

**Impact:** Dead code that misleads developers into thinking OVR colors are dynamic. Either the function should be used or removed.

### 2.6 — `verifyMockDataset.js` Has No npm Script (Low)

**Location:** `src/data/mock/verifyMockDataset.js`

This file is a standalone verification script, but there is no npm script in `package.json` to run it. The existing `check:data` and `check:pipeline` scripts run different validation paths. This script is effectively unreachable unless someone knows to run `node src/data/mock/verifyMockDataset.js` directly.

---

## 3. Recommended Approach

### Step 1 — Remove `process.env` from browser-reachable code

Replace the `process.env.DATA_MODE` reference in `loadDataset.js` with only browser-safe alternatives:

```js
const getDataMode = (mode) =>
  mode ??
  import.meta.env?.VITE_DATA_MODE ??
  'mock';
```

For Node.js scripts (`validateDataset.js`, `validatePlayerPipeline.js`), pass the mode explicitly via the `{ mode }` parameter rather than relying on the shared `getDataMode()` function to read `process.env`. The scripts already do this — they read `process.env.DATA_MODE` at the top level and pass it as `{ mode }`.

### Step 2 — Normalize backup player positions

Two options:

**Option A — Add `OG` and `OT` to the filter list:**
```js
const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'LT', 'LG', 'C', 'RG', 'RT', 'OG',
                   'DE', 'DT', 'NT', 'LB', 'CB', 'SS', 'FS', 'NB'];
```

**Option B (recommended) — Normalize positions to match their depth chart group:**
Change Okunlola's `pos` from `OG` to `LG`, Buchanan's from `OG` to `RG`, and Kinsler's from `OT` to `RT`. The depth chart group already conveys their role, and using the specific position makes filter behavior consistent.

### Step 3 — Clean up undefined depth chart entries

In the roster adapter, use `delete` or destructuring to remove keys instead of setting them to `undefined`:

```js
const { WR1, WR2, WR3, ...rest } = mockRosterSource.depthChart.offense;
const offense = {
  ...rest,
  WRX: WR1,
  WRZ: WR2,
  SLOT: WR3
};
```

### Step 4 — Make side-mapping explicit with validation

Replace the ternary with a whitelist:

```js
const VALID_SIDES = new Set(['OFFENSE', 'DEFENSE']);

const starters = collectStarterIds(datasetBySource?.roster?.depthChart).map((entry) => {
  if (!VALID_SIDES.has(entry.side)) {
    console.warn(`Unknown depth chart side: "${entry.side}" for slot ${entry.slot}`);
  }
  return { ...entry };
});
```

### Step 5 — Use or remove `getOvrColor`

Either apply `getOvrColor` to the OVR badge background in `RatingsView` (making the rating badge color-coded) or delete the function entirely to eliminate dead code.

### Step 6 — Add npm script for mock verification

Add to `package.json` scripts:
```json
"check:mock": "node src/data/mock/verifyMockDataset.js"
```

---

## 4. Success Criteria

- [ ] `loadDataset.js` contains zero references to `process.env`
- [ ] All 44 players are visible and filterable in the Ratings view — no orphaned positions
- [ ] Depth chart objects contain no `undefined`-valued properties
- [ ] Side-mapping logs a warning for unrecognized values instead of silently mapping to DEFENSE
- [ ] Zero dead/unreachable function definitions in component code
- [ ] `npm run check:mock` runs the mock verification script
- [ ] `npm run build` succeeds without warnings

---

## 5. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Removing `process.env` breaks Node.js validation scripts | Scripts already pass mode explicitly; verify `npm run check:data` still works |
| Normalizing `OG`→`LG` changes how position appears on player card | Update the card to show the depth chart slot label (e.g., "LG") separately from the player's natural position if needed |
| Deleting undefined depth chart keys changes object shape | Run pipeline validation to confirm all starter IDs still resolve |
| Adding console.warn for unknown sides creates noise | Only triggers on invalid data; silence is worse than a warning |

---

## 6. Files In Scope

| File | Action |
|---|---|
| `src/data/loadDataset.js` | Remove `process.env` references |
| `src/App.jsx` (or `src/components/RatingsView.jsx` post-Phase 2) | Fix position filter list OR normalize player positions |
| `src/App.jsx` (or data source) | Normalize `OG`/`OT` positions to `LG`/`RG`/`RT` |
| `src/data/sources/roster/adapter.js` | Clean up undefined depth chart entries |
| `src/data/pipeline/buildPlayerPipeline.js` | Add side-mapping validation |
| `src/App.jsx` (or `src/components/RatingsView.jsx`) | Remove or use `getOvrColor` |
| `package.json` | Add `check:mock` script |
