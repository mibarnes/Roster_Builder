#!/usr/bin/env bash
# guard-no-npm.sh — reject npm artifacts and enforce pnpm as the package manager.
#
# Part of the npm-CLI ban / supply-chain hardening (see ~/.AI_TOOLS/AGENTS.md §12 Node).
# Fails (exit 1) if a project tree contains an npm/yarn lockfile, or if any package.json
# declares a non-pnpm `packageManager` (or omits it). Read-only; never mutates anything.
#
# Canonical source: ~/.AI_TOOLS/bin/guard-no-npm.sh
# CI can't reach $HOME, so projects vendor a copy (e.g. Dashboard/scripts/guard-no-npm.sh);
# keep the vendored copy in sync with this one.
#
# Usage:
#   guard-no-npm.sh [DIR]              # DIR defaults to the current directory
#
# Wire-ups:
#   - CI step:        bash scripts/guard-no-npm.sh .
#   - local gate:     called from Scripts/ci_check.sh
#   - git pre-commit: once the repo is `git init`'d, point hooks at it, e.g.
#                       git config core.hooksPath .githooks
#                       printf '#!/usr/bin/env bash\nexec bash scripts/guard-no-npm.sh .\n' \
#                         > .githooks/pre-commit && chmod +x .githooks/pre-commit
set -euo pipefail

DIR="${1:-.}"
if [[ ! -d "$DIR" ]]; then
  echo "guard-no-npm: not a directory: $DIR" >&2
  exit 2
fi

fail=0

# Enumerate candidate files. Inside a git work tree, restrict to tracked + untracked-not-ignored
# (so gitignored backups/vendored copies don't trip the guard); otherwise fall back to find.
# Emits NUL-delimited paths to stdout.
list_files() {
  if git -C "$DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    ( cd "$DIR" && git ls-files --cached --others --exclude-standard -z )
  else
    find "$DIR" -type d -name node_modules -prune -o -type f -print0
  fi
}

mapfile -d '' -t CANDIDATES < <(list_files)

# 1) No npm/yarn lockfiles.
for f in "${CANDIDATES[@]}"; do
  case "${f##*/}" in
    package-lock.json|yarn.lock|npm-shrinkwrap.json)
      echo "guard-no-npm: FORBIDDEN lockfile present: $f" >&2; fail=1 ;;
  esac
done

# 2) Every package.json must pin pnpm via packageManager.
for pj in "${CANDIDATES[@]}"; do
  [[ "${pj##*/}" == package.json ]] || continue
  # git ls-files paths are relative to DIR; find paths are absolute/relative as given.
  path="$pj"; [[ -f "$path" ]] || path="$DIR/$pj"
  pm="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$path" | head -1)"
  if [[ -z "$pm" ]]; then
    echo "guard-no-npm: $pj is missing a \"packageManager\" field (must be pnpm@...)" >&2
    fail=1
  elif [[ "$pm" != pnpm@* ]]; then
    echo "guard-no-npm: $pj packageManager is \"$pm\" (must be pnpm@...)" >&2
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "guard-no-npm: FAILED — npm artifacts or non-pnpm package manager detected in $DIR" >&2
  exit 1
fi

# Silent on success (no news is good news) — keeps git GUIs from popping up a dialog on every
# commit. Set GUARD_VERBOSE=1 for an explicit PASS line (e.g. in CI logs).
[[ -n "${GUARD_VERBOSE:-}" ]] && echo "guard-no-npm: PASS — no npm artifacts; pnpm enforced in $DIR"
exit 0
