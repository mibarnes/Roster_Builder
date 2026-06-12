# LESSONS.md — Roster_Builder (project scope)

Project-scoped lessons. Cross-project lessons promote up to `~/.AI_TOOLS/lessons_staging.md`.

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
