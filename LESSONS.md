# LESSONS.md — Roster_Builder (project scope)

Project-scoped lessons. Cross-project lessons promote up to `~/.AI_TOOLS/lessons_staging.md`.

## 2026-07-05 — A "scheme selector" was blocked by data reality; alignment ≠ personnel
- Date: 2026-07-05
- Area: data / workflow
- Context: Building U9 "multiple formation schemes (4-3 vs 3-4, 11 vs 12 personnel)" per the plan.
- Symptom: The CFBD depth chart is a **fixed 4-2-5 nickel personnel set** — exactly 11+11 named
  slots (`positions.ts` OFFENSE/DEFENSE_SLOT_ORDER), no SLB / 2nd TE / 4th LB. True personnel
  schemes would have rendered phantom empty slots.
- Root cause: The approved plan promised a feature the *data* can't honestly back; the constraint
  only surfaced when reading the slot canon, after the plan was approved.
- Resolution: Surfaced the finding to the user rather than faking slots; shipped **alignment
  presets** (Spread/Pro, Nickel/Base) that re-place the SAME real slots (nickel NB ↔ base SAM),
  via a data-driven `formations.ts` registry + generic `FormationField`. Recorded the true
  multi-personnel version as an explicit dated deferral (needs a deeper positional depth chart).
- Prevention: For any "selector/variant" feature, verify what the underlying data actually contains
  *before* implementing; distinguish alignment (re-placing existing entities) from personnel
  (needing entities the data lacks). Honest-partial > phantom slots.

## 2026-07-05 — Generalizing an OVR-hardwired metric: per-metric null/floor semantics
- Date: 2026-07-05
- Area: testing / workflow
- Context: U10 lifted the comparison stack's hard-wired `p.ovr` into a `MetricConfig` (OVR /
  composite / usage / PPA).
- Symptom: The existing `ovr > 0` "unrated" sentinel is WRONG for other metrics — a 0 snap-share
  usage is a real value, and PPA is legitimately negative; a blanket `> 0` filter would silently
  drop valid data and the radar's `v > 0` draw-gate would hide real zeros/negatives.
- Root cause: Scale/directionality/null-semantics are metric-specific, not universal.
- Resolution: Each metric owns an `isValid` predicate (OVR/composite `>0`; usage/PPA any finite),
  its own `normalize`/`roundAgg`/thresholds; `RadarChart` switched from `number[]`+`v>0` to
  `Array<number|null>`+`!=null`. Defaulting every `comparisonMath` fn to `OVR_METRIC` kept all
  prior call sites/tests byte-identical, so the refactor was provably behavior-preserving.
- Prevention: When parameterizing a hardwired quantity, make the "absent/invalid" rule part of the
  config, never a shared magic sentinel; add explicit tests for the 0-valid and negative-valid cases.

## 2026-06-12 — The recovered "frontier" lived only in an uncommitted working tree
- Date: 2026-06-12
- Area: data / workflow
- Context: Recovering the lost Roster_Builder build from GitHub + a D-drive backup.
- Symptom: GitHub `main` had only 2 teams and none of the advanced features; the real work
  (34 teams, TeamComparison/Radar/PositionDepth components, logos) appeared nowhere in git.
- Root cause: A large body of work was left **uncommitted/unpushed** on a `feat/*` branch's
  working tree; only the D-drive cold backup preserved it.
- Resolution: Found it via `git status` on the backup copy; staged it to `_recovered/` and
  immediately seeded the irreplaceable real team data into committed final homes.
- Prevention: Commit early/often on feature branches; a backup of a working tree can be *ahead*
  of the remote — always diff `git status` on recovered copies, don't trust HEAD alone.

## 2026-06-12 — "Complete-looking" anchor teams were the mock placeholders
- Date: 2026-06-12
- Area: data
- Context: Deciding which recovered team datasets to carry forward as real seed.
- Symptom: Miami + Alabama were the only teams with `ratings.json` + `manifest.json`, looking the
  most complete — but had exactly 44 players and `sourceId: internal-roster-v1`.
- Root cause: They were the original hardcoded-prototype scaffold (mock), never re-collected;
  the other 32 teams (`cfbd-roster-v1`, 95–185 players) were the genuine captures.
- Resolution: Classified by `sourceId` + player count + id format; seeded the 32 real teams,
  excluded Miami/Alabama. Miami becomes a re-collection pilot.
- Prevention: Verify data provenance by source id / shape, not by which files look most complete.

## 2026-06-12 — pnpm verifyDepsBeforeRun=error broke every script (set to warn)
- Date: 2026-06-12
- Area: tooling
- Context: M1 toolchain bring-up; pnpm-workspace.yaml as a settings file (single package).
- Symptom: every `pnpm <script>` → ERR_PNPM_VERIFY_DEPS_BEFORE_RUN even right after a clean install.
- Root cause: pnpm 11.5.2 bug — install writes a workspace-state its own verify rejects for single-package roots.
- Resolution: `verifyDepsBeforeRun: warn` in pnpm-workspace.yaml (documented inline). Supply-chain controls (minimumReleaseAge, onlyBuiltDependencies) kept at full strength.
- Prevention: re-test `error` when pnpm is upgraded; don't reinstall-thrash on this symptom.

## 2026-07-04 — Blueprint's official-site engine anchor drifted; verify data formats empirically
- Date: 2026-07-04
- Area: data
- Context: F3/P6 — implementing the "sidearm-json" official-roster engine the finalization blueprint
  described as the "dominant ACC/SEC CMS with a JSON island or /api/roster endpoint".
- Symptom: Building against the blueprint's description would have produced an engine for a format
  that mostly doesn't exist — most schools serve the SAME `__NUXT_DATA__` island as Florida.
- Root cause: The July-2026 audit inferred the engine landscape without fetching all 31 sites; the
  real split (probed live) is 15 camelCase-Nuxt (already handled), 8 snake_case-Nuxt (the actual
  "sidearm-json"), 1 wmt-presto, 7 genuinely-other/degrade.
- Resolution: Fetched all 31 official roster pages + ran the real parser over them BEFORE writing
  code; implemented `parseSidearmJsonRoster` for the snake_case variant of the same island;
  detection stays content-based (not registry-hint-based) so a CMS swap still resolves.
- Prevention: When a design doc names an external data format/CMS/endpoint, treat it as a hypothesis
  — fetch real samples and run the existing parser over them first. Anchors for third-party formats
  go stale between audit and implementation.
