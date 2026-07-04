# PRD Phase 2: Eliminate Duplication and Decompose Components

**Status:** Proposed
**Priority:** High
**Scope:** `src/App.jsx`, new `src/components/` directory, new `src/utils/`
**Depends on:** Phase 1 (data split resolved)

---

## 1. Problem Statement

All UI code lives in a single 467-line file (`App.jsx`) containing 9 component definitions, inline data, utility functions, CSS keyframes, and the root application layout. Identical SVG markup and business logic are copy-pasted across multiple components. This monolithic structure makes the codebase difficult to navigate, test in isolation, and modify without risking unintended side effects.

---

## 2. Issues Identified

### 2.1 — Star SVG Path Duplicated 4 Times (High)

**Locations:**
- `src/App.jsx:101` — `Star` component (the reusable version)
- `src/App.jsx:262` — `PlayerModal` inline star rendering
- `src/App.jsx:351` — `RatingsView` inline star rendering
- `src/App.jsx:454` — Footer legend inline star rendering

The same 236-character SVG `<path>` element is repeated verbatim in 4 locations. The `Star` component already exists as a proper reusable component (line 99-103), but the other 3 locations inline the full SVG markup instead of using it.

**Impact:** Any visual change to the star icon (color, size, path) must be applied in 4 places. Missed updates create visual inconsistencies.

### 2.2 — Star Rating Calculation Duplicated 6 Times (High)

**Locations:**
- `src/App.jsx:108` — `PlayerCard` component
- `src/App.jsx:236` — `PlayerModal` component
- `src/App.jsx:305` — `RatingsView` filter logic
- `src/App.jsx:306` — `RatingsView` sort logic (appears twice, once for `a` and once for `b`)
- `src/App.jsx:335` — `RatingsView` render

The expression:
```js
player.isTransfer && player.transferStars ? player.transferStars : player.stars
```

This transfer-portal-aware star calculation is a business rule scattered across 6 call sites. If the logic changes (e.g., adding a `portalRating` field, changing the fallback), every instance must be found and updated.

### 2.3 — Monolithic Single-File Architecture (High)

**Location:** `src/App.jsx` (467 lines, 9 components)

Components defined in `App.jsx`:
1. `Star` (lines 99-103) — Star rating icon
2. `PlayerCard` (lines 105-171) — Individual player card with hover state
3. `PositionGroup` (lines 173-177) — Vertical stack of starter + backup
4. `OffenseFormation` (lines 179-204) — Full offensive formation layout
5. `DefenseFormation` (lines 206-232) — Full defensive formation layout
6. `PlayerModal` (lines 234-297) — Detail modal popup
7. `RatingsView` (lines 299-368) — List view with filters/sorting
8. `CompositeHeader` (lines 370-386) — Team metric badges
9. `MiamiRosterCompare` (lines 388-466) — Root application component

None of these components can be tested in isolation. Importing any one component requires loading the entire file and all its dependencies.

### 2.4 — `getClassColor` Recreated on Every Render (Medium)

**Location:** `src/App.jsx:112`

```js
const getClassColor = () => ({ FR: '#4ade80', SO: '#60a5fa', JR: '#fbbf24', SR: '#f87171' }[classYear] || '#94a3b8');
```

This pure function is defined inside the `PlayerCard` component body. It creates a new object and function on every render of every player card. With 44 player cards and potential re-renders on hover, this adds unnecessary garbage collection pressure.

### 2.5 — `CompositeHeader` Recalculates on Every Render (Medium)

**Location:** `src/App.jsx:370-386`

```js
const calc = (p, d) => { let t = 0, c = 0; Object.values(p).forEach(x => x.slice(0, d).forEach(y => { t += y.composite; c++; })); return (t / c).toFixed(1); };
```

This function iterates over all starters to compute offensive, defensive, and overall composite averages every time `CompositeHeader` renders. The input data (`offensiveStarters`, `defensiveStarters`) is static — the result never changes. After Phase 1 integrates the pipeline, this calculation should come from `pipeline.metrics` instead of being recomputed.

### 2.6 — Font Family Declared in 3+ Places (Low)

The Inter font stack is specified in:
- `index.html:9` — Google Fonts `<link>` (loads the font)
- `src/index.css:13` — `body { font-family: 'Inter', ... }` (applies to body)
- `tailwind.config.js:10` — `fontFamily: { sans: ['Inter', ...] }` (Tailwind's sans utility)
- `src/App.jsx:401` — `style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}` (inline override)

The `index.html` link tag is the only one that actually loads the font. The other three are competing declarations of which fallback stack to use. The inline style in `App.jsx` overrides both the CSS and Tailwind declarations, making the latter two ineffective.

### 2.7 — CSS Keyframes Defined in JSX (Low)

**Location:** `src/App.jsx:395-399`

```jsx
<style>{`
  @keyframes fadeSlideUp { ... }
  @keyframes fadeIn { ... }
  @keyframes modalSlideUp { ... }
`}</style>
```

Three CSS keyframe animations are injected via a `<style>` tag inside JSX. These are global styles that should live in `index.css` alongside other global CSS, not embedded in component markup.

---

## 3. Recommended Approach

### Step 1 — Create shared utilities

Extract duplicated logic into utility modules.

**New file:** `src/utils/playerHelpers.js`
```
- getEffectiveStars(player) — transfer-portal-aware star count
- getClassColor(classYear) — class year to color mapping
- getOvrColor(ovr) — overall rating to color mapping (currently unused, see Phase 3)
```

### Step 2 — Extract components into individual files

Create a `src/components/` directory and move each component into its own file:

| New File | Source | Lines |
|---|---|---|
| `src/components/Star.jsx` | `App.jsx:99-103` | Icon component |
| `src/components/PlayerCard.jsx` | `App.jsx:105-171` | Player card with hover |
| `src/components/PositionGroup.jsx` | `App.jsx:173-177` | Starter/backup stack |
| `src/components/OffenseFormation.jsx` | `App.jsx:179-204` | Offense layout |
| `src/components/DefenseFormation.jsx` | `App.jsx:206-232` | Defense layout |
| `src/components/PlayerModal.jsx` | `App.jsx:234-297` | Detail modal |
| `src/components/RatingsView.jsx` | `App.jsx:299-368` | List view with filters |
| `src/components/CompositeHeader.jsx` | `App.jsx:370-386` | Team metric badges |

After extraction, `App.jsx` should contain only the root `MiamiRosterCompare` component (~80 lines): state management, tab switching, layout, and component composition.

### Step 3 — Replace inline SVGs with the Star component

Update `PlayerModal`, `RatingsView`, and the footer legend to import and use the `Star` component instead of inlining the SVG path. Extend the `Star` component to accept a `size` prop for the different contexts (small in cards, medium in modal, etc.).

### Step 4 — Move keyframe animations to index.css

Move the three `@keyframes` definitions from the JSX `<style>` tag to `src/index.css`. Remove the `<style>` block from `App.jsx`.

### Step 5 — Consolidate font declaration

Remove the inline `fontFamily` style from `App.jsx:401`. Remove the manual `font-family` from `index.css:13`. Keep only:
- `index.html` Google Fonts `<link>` (loads the font)
- `tailwind.config.js` `fontFamily.sans` (applies it via Tailwind's `font-sans` class or default)

### Step 6 — Wire CompositeHeader to pipeline metrics (post-Phase 1)

After Phase 1 connects the pipeline, replace the inline `calc()` function with values from `pipeline.metrics.offense.avgStarterComposite`, `pipeline.metrics.defense.avgStarterComposite`, and `pipeline.metrics.team.avgStarterComposite`.

---

## 4. Success Criteria

- [ ] `App.jsx` is under 100 lines — only root component, state, and layout
- [ ] Each component is a separate file in `src/components/`
- [ ] Star SVG path appears exactly once in the codebase (in `Star.jsx`)
- [ ] `getEffectiveStars()` is called from one utility — no inline duplicates
- [ ] CSS keyframes live in `index.css`, not in JSX
- [ ] Font family is declared in exactly 2 places: `index.html` (load) and `tailwind.config.js` (apply)
- [ ] All existing UI behavior is preserved — visual regression check passes

---

## 5. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Component extraction breaks imports or circular dependencies | Extract leaf components first (Star, PlayerCard), then composites (PositionGroup, Formations), then views |
| Star component size prop doesn't match all existing inline sizes | Audit every inline SVG size before extraction; support explicit `className` pass-through |
| Removing inline fontFamily changes rendering | Test in Chrome/Firefox/Safari — Tailwind's sans default should match |
| Moving keyframes to CSS changes animation specificity | Keyframes are global by name; moving them changes nothing functionally |

---

## 6. Files In Scope

| File | Action |
|---|---|
| `src/App.jsx` | Reduce to ~80 lines; import from components/ |
| `src/components/Star.jsx` | **New** — extracted from App.jsx |
| `src/components/PlayerCard.jsx` | **New** — extracted from App.jsx |
| `src/components/PositionGroup.jsx` | **New** — extracted from App.jsx |
| `src/components/OffenseFormation.jsx` | **New** — extracted from App.jsx |
| `src/components/DefenseFormation.jsx` | **New** — extracted from App.jsx |
| `src/components/PlayerModal.jsx` | **New** — extracted from App.jsx |
| `src/components/RatingsView.jsx` | **New** — extracted from App.jsx |
| `src/components/CompositeHeader.jsx` | **New** — extracted from App.jsx |
| `src/utils/playerHelpers.js` | **New** — shared utility functions |
| `src/index.css` | Add keyframe animations |
| `tailwind.config.js` | Verify font config (no change expected) |
