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

*(Parts 1–9 follow — being appended in sequence.)*
