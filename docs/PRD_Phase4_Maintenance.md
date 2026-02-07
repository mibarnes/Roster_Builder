# PRD Phase 4: Quality, Accessibility, and Maintainability

**Status:** Proposed
**Priority:** Medium
**Scope:** Project-wide — testing, accessibility, styling, configuration, caching
**Depends on:** Phase 1 (data unified), Phase 2 (components decomposed), Phase 3 (bugs fixed)

---

## 1. Problem Statement

The project has no automated tests, no accessibility support, a split styling paradigm (Tailwind + inline styles), unused dependencies, redundant configuration, and minor architectural issues that compound into long-term maintenance burden. While none of these individually block functionality, together they make the codebase fragile, inaccessible to users with disabilities, and harder to maintain as it grows.

---

## 2. Issues Identified

### 2.1 — Zero Test Coverage (High)

**Location:** Entire project — no `.test.js`, `.spec.js`, or test configuration files exist.

There is no testing framework installed, no test scripts in `package.json`, and no test files anywhere in the project. The only form of validation is the CLI scripts (`npm run check:data`, `npm run check:pipeline`) which verify data structure completeness but do not test:

- UI component rendering
- User interaction behavior (tab switching, filtering, sorting, modal open/close)
- Data transformation correctness (pipeline mapping, normalization)
- Edge cases (empty data, missing fields, null values)

**Impact:** Every code change is a manual QA exercise. Refactoring (especially Phase 1 and 2) carries high regression risk without test safety nets.

### 2.2 — No Accessibility Support (High)

**Location:** `src/App.jsx` — all interactive components

Specific violations:

| Component | Issue | WCAG Criterion |
|---|---|---|
| `PlayerCard` (line 116) | `div` with `onClick` — not keyboard focusable, no role | 2.1.1 Keyboard |
| `PlayerModal` (line 239) | No focus trap — Tab key escapes modal to background | 2.4.3 Focus Order |
| `PlayerModal` (line 239) | No Escape key handler to close | 2.1.1 Keyboard |
| `Star` (line 99) | Decorative SVG with no `aria-hidden` | 1.1.1 Non-text Content |
| Tab buttons (line 417) | No `role="tablist"` / `role="tab"` / `aria-selected` | 4.1.2 Name, Role, Value |
| Filter `<select>` elements (lines 322-329) | No `<label>` or `aria-label` | 1.3.1 Info and Relationships |
| Player name in RatingsView (line 343) | Only shows last name — screen reader loses context | 1.3.1 Info and Relationships |
| Star ratings | No text alternative (e.g., "4 out of 5 stars") | 1.1.1 Non-text Content |
| Color-coded class years (line 156) | Color is the only differentiator — fails for color-blind users | 1.4.1 Use of Color |

**Impact:** The application is unusable for keyboard-only users and screen reader users. Color-blind users cannot distinguish class years.

### 2.3 — Mixed Styling Paradigm: Tailwind + Inline Styles (Medium)

**Location:** Throughout `src/App.jsx`

The codebase uses Tailwind CSS utility classes and inline `style={{}}` props simultaneously on the same elements. Examples:

- `App.jsx:127-134` — `className="relative overflow-hidden ..."` paired with `style={{ background: '#000000', borderRadius: '10px', border: '...', boxShadow: '...' }}`
- `App.jsx:136` — `style={{ background: '#1a4d2e', padding: '6px 8px', position: 'relative' }}` — all of these are expressible in Tailwind (`bg-[#1a4d2e] px-2 py-1.5 relative`)
- `App.jsx:401` — `style={{ background: '#000000', fontFamily: "..." }}` on the root div

**Pattern:** Static color values like `#1a4d2e` (Miami green), `#0a0a0a`, `#1a1a1a` appear as inline styles 20+ times. These are design tokens that should be Tailwind custom colors.

**Impact:** Two competing styling systems make it unclear where to look when changing appearances. Inline styles cannot be overridden by responsive Tailwind utilities, breaking responsive design patterns. Design tokens scattered as hex strings are hard to update consistently.

### 2.4 — Unused TypeScript Type Packages (Low)

**Location:** `package.json:20-21`

```json
"devDependencies": {
  "@types/react": "^18.3.12",
  "@types/react-dom": "^18.3.1",
  ...
}
```

There are no TypeScript files (`.ts`, `.tsx`), no `tsconfig.json`, and no TypeScript tooling in the project. These packages were likely left from the Vite scaffold template and serve no purpose.

**Impact:** Adds ~2MB to `node_modules` with zero benefit. Misleads developers into thinking TypeScript is supported.

### 2.5 — Redundant CSS Reset (Low)

**Location:** `src/index.css:5-9`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

Tailwind's `@tailwind base` directive (line 1) includes Preflight, which is a comprehensive CSS reset based on modern-normalize. Preflight already:
- Sets `box-sizing: border-box` on all elements
- Removes default margins on `body`, `h1`-`h6`, `p`, etc.
- Removes default padding on `ul`, `ol`, etc.

The manual `*` rule is redundant and adds a universal selector that the browser must evaluate on every element.

### 2.6 — Cache Never Evicts Expired Entries (Low)

**Location:** `src/data/loadDataset.js:6-23`

```js
const cache = new Map();

const readCache = (key) => {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    return null;        // returns null but doesn't delete the expired entry
  }
  return cached.value;
};
```

When a cache entry expires, `readCache` returns `null` but the stale entry remains in the Map. Over time in a long-running process, the Map accumulates entries that are never cleaned up.

**Current exposure:** Low — there are only a few unique cache keys (`mock:default:default`, `connected:default:default`), so the Map stays small. But the pattern is incorrect and would become a real leak if more dynamic keys were introduced.

### 2.7 — Array Index Used as React Key (Low)

**Location:** `src/App.jsx:183` (OffenseFormation), `src/App.jsx:210` (DefenseFormation)

```jsx
{[offensiveStarters.LT, offensiveStarters.LG, ...].map((pos, i) => (
  <PositionGroup key={i} players={pos} ... />
))}
```

Position groups are identified by array index rather than a stable key. The arrays are static so this doesn't cause bugs today, but it's a React anti-pattern that would cause rendering issues if the array were ever reordered or filtered dynamically.

### 2.8 — Missing Custom Favicon (Low)

**Location:** `index.html:5`

```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```

References the default Vite logo. No custom favicon exists for the Miami Hurricanes / CFB Roster Portal branding.

---

## 3. Recommended Approach

### Step 1 — Add testing framework and foundational tests

**Install Vitest + React Testing Library:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Add to `vite.config.js`:**
```js
test: { environment: 'jsdom', globals: true }
```

**Priority test targets:**

| Test File | What to Test |
|---|---|
| `src/utils/playerHelpers.test.js` | `getEffectiveStars`, `getClassColor` — pure functions, easy wins |
| `src/data/pipeline/buildPlayerPipeline.test.js` | Pipeline transformation, coverage report, starter metrics |
| `src/data/normalize/depthChart.test.js` | WR slot normalization, edge cases |
| `src/data/validation/verifyDatasetComponents.test.js` | Missing/empty component detection |
| `src/components/PlayerCard.test.jsx` | Renders name, number, stars; click fires callback |
| `src/components/RatingsView.test.jsx` | Filtering by side/position/stars; sorting |
| `src/components/PlayerModal.test.jsx` | Opens with player data; close button works |

**Target:** 80%+ coverage on data pipeline; key interaction tests on UI components.

### Step 2 — Add core accessibility support

**Modal accessibility:**
- Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to PlayerModal
- Trap focus inside modal when open (use a focus-trap library or manual implementation)
- Close modal on Escape keypress
- Return focus to the triggering element on close

**Interactive elements:**
- Add `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space) to PlayerCard divs
- Add `role="tablist"` to nav, `role="tab"` + `aria-selected` to tab buttons
- Add `aria-label` to all `<select>` filter elements

**Screen reader support:**
- Add `aria-hidden="true"` to decorative Star SVGs
- Add `aria-label="X out of 5 stars"` to star rating containers
- Add text labels alongside color-coded class years (e.g., show "FR" text label that's already there — ensure sufficient contrast)

### Step 3 — Consolidate styling to Tailwind-only

**Define custom colors in `tailwind.config.js`:**
```js
theme: {
  extend: {
    colors: {
      'miami-green': '#1a4d2e',
      'surface': '#0a0a0a',
      'surface-border': '#1a1a1a',
      'card-bg': '#000000',
    }
  }
}
```

**Migration process:**
1. Audit all inline `style={{}}` props — catalog unique color/spacing values
2. Add values that aren't standard Tailwind to the theme config as custom tokens
3. Replace `style={{ background: '#1a4d2e' }}` with `className="bg-miami-green"`
4. Replace `style={{ borderBottom: '1px solid #1a1a1a' }}` with `className="border-b border-surface-border"`
5. Remove all `style={{}}` props that have Tailwind equivalents
6. Keep `style={{}}` only for truly dynamic values (e.g., animation delays, computed widths)

### Step 4 — Clean up configuration

**Remove unused type packages:**
```bash
npm uninstall @types/react @types/react-dom
```

**Remove redundant CSS reset from `index.css`:**
Delete the `* { margin: 0; padding: 0; box-sizing: border-box; }` block. Tailwind's Preflight handles this.

**Remove redundant body font-family from `index.css`:**
Tailwind's `fontFamily.sans` config already sets this when the `font-sans` class is applied (or when Preflight sets the body font).

### Step 5 — Fix cache eviction

Update `readCache` to delete expired entries:

```js
const readCache = (key) => {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};
```

### Step 6 — Replace index keys with stable identifiers

Use position names as keys instead of array indices:

```jsx
{[
  { key: 'LT', players: offensiveStarters.LT },
  { key: 'LG', players: offensiveStarters.LG },
  ...
].map(({ key, players }) => (
  <PositionGroup key={key} players={players} ... />
))}
```

### Step 7 — Add custom favicon

Create or source a Miami Hurricanes-themed favicon. Replace the `/vite.svg` reference in `index.html` with the custom icon.

---

## 4. Success Criteria

- [ ] `npm test` runs and passes — Vitest configured with jsdom environment
- [ ] Data pipeline has 80%+ test coverage (transformation, validation, normalization)
- [ ] Key UI interactions have integration tests (tab switching, filtering, modal open/close)
- [ ] Modal traps focus and closes on Escape
- [ ] All interactive elements are keyboard accessible (Tab, Enter, Space)
- [ ] Screen readers announce star ratings, player details, and filter state
- [ ] Zero inline `style={{}}` props for static values — all converted to Tailwind classes
- [ ] Custom design tokens defined in `tailwind.config.js` and used consistently
- [ ] `@types/react` and `@types/react-dom` removed from `package.json`
- [ ] Manual CSS reset removed from `index.css`
- [ ] Cache properly deletes expired entries
- [ ] No array-index keys on dynamic or reorderable lists
- [ ] Custom favicon renders in browser tab

---

## 5. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Adding Vitest increases dev dependency footprint | Vitest shares Vite's config and transformer — minimal overhead compared to Jest |
| Accessibility changes alter visual layout | A11y additions (ARIA attrs, focus styles) are non-visual by default; test visually after focus-trap implementation |
| Tailwind migration changes pixel rendering | Compare screenshots before/after; Tailwind utilities produce equivalent CSS |
| Removing `@types/*` breaks IDE IntelliSense | Only affects TypeScript IntelliSense; project uses plain JSX so no impact |
| Focus trap library adds a dependency | Consider lightweight options (<2KB): `focus-trap` or manual implementation with `MutationObserver` |

---

## 6. Files In Scope

| File | Action |
|---|---|
| `package.json` | Add vitest + testing-library; remove @types/* |
| `vite.config.js` | Add test configuration |
| `src/utils/playerHelpers.test.js` | **New** — unit tests |
| `src/data/pipeline/buildPlayerPipeline.test.js` | **New** — pipeline tests |
| `src/data/normalize/depthChart.test.js` | **New** — normalization tests |
| `src/data/validation/verifyDatasetComponents.test.js` | **New** — validation tests |
| `src/components/PlayerCard.test.jsx` | **New** — component tests |
| `src/components/RatingsView.test.jsx` | **New** — component tests |
| `src/components/PlayerModal.test.jsx` | **New** — component + a11y tests |
| `src/components/PlayerModal.jsx` | Add ARIA attrs, focus trap, Escape handler |
| `src/components/PlayerCard.jsx` | Add keyboard support (tabIndex, onKeyDown) |
| `src/App.jsx` | Add ARIA roles to tabs, labels to filters |
| `tailwind.config.js` | Add custom color tokens |
| `src/index.css` | Remove redundant reset and font-family |
| `src/data/loadDataset.js` | Fix cache eviction |
| `src/components/OffenseFormation.jsx` | Replace index keys with position keys |
| `src/components/DefenseFormation.jsx` | Replace index keys with position keys |
| `index.html` | Replace favicon |
